"use client"
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import {
  Search, TrendingUp, DollarSign, Target, Zap, BarChart2, RefreshCw, Loader2,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, Filter, Download,
  CheckCircle, XCircle, AlertCircle, Brain, Eye, Shield, Clock, Star, Users, MapPin,
  Phone, Globe, Activity, FileText, Trash2, LayoutGrid, Link2, Copy, Edit2, Plus, Settings
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

// ── Section Actions — delete + rerun buttons for every section ──────────────
function SectionActions({ onRerun, onDelete, rerunLabel = 'Rerun', deleteLabel = 'Clear Data', running = false }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
      {onRerun && (
        <button onClick={onRerun} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6,
          border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 600,
          cursor: running ? 'wait' : 'pointer', color: '#6b7280', opacity: running ? 0.5 : 1,
        }}>
          {running ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
          {rerunLabel}
        </button>
      )}
      {onDelete && (
        <button onClick={() => { if (confirm(`${deleteLabel}? This cannot be undone.`)) onDelete() }} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6,
          border: '1px solid #fecaca', background: '#fff', fontSize: 11, fontWeight: 600,
          cursor: 'pointer', color: '#dc2626',
        }}>
          <Trash2 size={11} /> {deleteLabel}
        </button>
      )}
    </div>
  )
}

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
  const [enrichment, setEnrichment] = useState(null)
  const [enrichLoading, setEnrichLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
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
  const [gridKw, setGridKw] = useState('')
  const [gridBiz, setGridBiz] = useState('')
  const [gridLat, setGridLat] = useState('')
  const [gridLng, setGridLng] = useState('')
  const [gridCity, setGridCity] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [gridRunning, setGridRunning] = useState(false)
  const [gridResult, setGridResult] = useState(null)
  const [compLandscape, setCompLandscape] = useState(null)
  const [compLandscapeLoading, setCompLandscapeLoading] = useState(false)
  const [selectedCompDomain, setSelectedCompDomain] = useState(null)
  const [compDomainKws, setCompDomainKws] = useState(null)
  const [compDomainLoading, setCompDomainLoading] = useState(false)
  const [gmbPosts, setGmbPosts] = useState([])
  const [generatingPosts, setGeneratingPosts] = useState(false)
  const [briefs, setBriefs] = useState([])
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefKeyword, setBriefKeyword] = useState('')
  const [briefPageType, setBriefPageType] = useState('service_page')
  const [activeBrief, setActiveBrief] = useState(null)
  const [generatingBrief, setGeneratingBrief] = useState(false)

  // OAuth callback state
  const [oauthStep, setOauthStep] = useState(null) // null | 'exchanging' | 'pick_properties' | 'saving' | 'done'
  const [oauthTokens, setOauthTokens] = useState(null)
  const [gscSites, setGscSites] = useState([])
  const [ga4Properties, setGa4Properties] = useState([])
  const [selectedGsc, setSelectedGsc] = useState('')
  const [selectedGa4, setSelectedGa4] = useState('')
  const [gscSearch, setGscSearch] = useState('')
  const [ga4Search, setGa4Search] = useState('')

  // Load clients
  const loadClients = useCallback(() => {
    if (!agencyId) return
    supabase.from('clients').select('id, name, website, primary_service, industry, status')
      .eq('agency_id', agencyId).is('deleted_at', null).order('name')
      .then(({ data }) => { if (Array.isArray(data)) setClients(data) })
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
      const action2 = editingClient?.id ? 'update_client' : 'create_client'
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action2, agency_id: agencyId,
          ...(editingClient?.id ? { client_id: editingClient.id } : {}),
          name: clientForm.name, website: clientForm.website || null, primary_service: clientForm.primary_service || null,
        }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setSavingClient(false); return }
      toast.success(editingClient ? 'Client updated' : 'Client added')
      setShowClientModal(false)
      setEditingClient(null)
      setClientForm({ name: '', website: '', primary_service: '', location: '' })
      loadClients()
      if (!editingClient && data.client?.id) setClientId(data.client.id)
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

  // Load enrichment
  const loadEnrichment = useCallback(() => {
    if (!clientId) return
    setEnrichLoading(true)
    fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_enrichment', client_id: clientId }) })
      .then(r => r.json()).then(res => { setEnrichment(res.enrichment); setEnrichLoading(false) })
      .catch(() => setEnrichLoading(false))
  }, [clientId])

  // Run deep enrich
  const runDeepEnrich = async () => {
    if (!clientId) return
    setEnriching(true)
    toast.loading('Running deep enrichment — 11 SEO tools in parallel...', { id: 'enrich' })
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deep_enrich', client_id: clientId, agency_id: agencyId }) })
      const data = await res.json()
      if (data.error) { toast.error(data.error, { id: 'enrich' }); setEnriching(false); return }
      toast.success(`Deep enrichment complete — ${data.tools_run?.length || 0} tools ran`, { id: 'enrich' })
      setEnrichment(data.enrichment)
      loadDashboard()
    } catch { toast.error('Deep enrichment failed', { id: 'enrich' }) }
    setEnriching(false)
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

  // Handle Google OAuth callback — exchange code for tokens, fetch properties
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const stateRaw = params.get('state')
    if (!code || !stateRaw) return

    // Clean URL
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, '', cleanUrl)

    try {
      const state = JSON.parse(decodeURIComponent(stateRaw))
      const oauthClientId = state.clientId
      if (oauthClientId) setClientId(oauthClientId)

      setTab('connect')
      setOauthStep('exchanging')
      toast.loading('Exchanging tokens...', { id: 'oauth' })

      const redirectUri = window.location.origin + '/kotoiq'
      fetch('/api/seo/google-exchange', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      }).then(r => r.json()).then(async tokens => {
        if (tokens.error || !tokens.access_token) {
          toast.error(tokens.details || tokens.error || 'Token exchange failed', { id: 'oauth' })
          setOauthStep(null)
          return
        }

        toast.success('Authenticated! Loading your accounts...', { id: 'oauth' })
        setOauthTokens({ ...tokens, clientId: oauthClientId })

        // Fetch GSC sites
        try {
          const gscRes = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
          })
          if (gscRes.ok) {
            const gscData = await gscRes.json()
            const sites = (gscData.siteEntry || []).filter(s => s.permissionLevel !== 'siteUnverifiedUser')
            setGscSites(sites)
          }
        } catch {}

        // Fetch GA4 properties — paginate through ALL pages
        try {
          let allSummaries = []
          let pageToken = null
          do {
            const url = 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries' + (pageToken ? `?pageToken=${pageToken}` : '?pageSize=200')
            const summaryRes = await fetch(url, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
            if (!summaryRes.ok) break
            const summaryData = await summaryRes.json()
            allSummaries = allSummaries.concat(summaryData.accountSummaries || [])
            pageToken = summaryData.nextPageToken || null
          } while (pageToken)

          if (allSummaries.length > 0) {
            const allProps = allSummaries.flatMap(acc =>
              (acc.propertySummaries || []).map(p => ({
                name: p.property, displayName: p.displayName, account: acc.displayName,
              }))
            )
            setGa4Properties(allProps)
          }
        } catch {}

        setOauthStep('pick_properties')
      }).catch(e => {
        toast.error('OAuth failed: ' + e.message, { id: 'oauth' })
        setOauthStep(null)
      })
    } catch { setOauthStep(null) }
  }, [])
  useEffect(() => { if (tab === 'keywords') loadKeywords() }, [tab, loadKeywords])
  useEffect(() => { if (tab === 'briefs') loadBriefs() }, [tab, loadBriefs])
  useEffect(() => { if (tab === 'ranks') loadRanks() }, [tab, loadRanks])
  useEffect(() => { if (tab === 'audit') loadEnrichment() }, [tab, loadEnrichment])
  useEffect(() => { if (tab === 'gmb') loadGMB() }, [tab, loadGMB])

  // Auto-fill grid tracker from client + GMB data
  useEffect(() => {
    if (!clientId || !clients.length) return
    const c = clients.find(x => x.id === clientId)
    if (!gridBiz && (gmb?.gbp?.name || c?.name)) setGridBiz(gmb?.gbp?.name || c?.name || '')
    if (!gridCity && c) {
      const city = [c.city, c.state].filter(Boolean).join(', ')
      if (city) setGridCity(city)
    }
  }, [clientId, clients, gmb])

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

  // Auth guard — must be logged into an agency
  if (!agencyId) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: GRY, fontFamily: FB }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Shield size={48} color={R} style={{ margin: '0 auto 16px', opacity: .4 }} />
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: BLK, marginBottom: 8 }}>Login Required</div>
            <div style={{ fontSize: 14, color: '#6b7280' }}>You need to be logged into an agency to use KotoIQ.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#ffffff', fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Fixed Header ─────────────────────────────────────── */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          {/* Top bar: logo + client selector + actions */}
          <div style={{ padding: '16px 40px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: BLK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={18} color="#fff" />
              </div>
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: BLK, letterSpacing: '-.02em' }}>SeoIQ</div>
            </div>

            {/* Client selector — prominent */}
            <select value={clientId} onChange={e => { setClientId(e.target.value); setDashboard(null) }}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontWeight: 600, fontFamily: FH, background: '#fff', cursor: 'pointer', color: clientId ? BLK : '#9ca3af', maxWidth: 400 }}>
              <option value="">Select a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Quick actions — always visible */}
            {clientId && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => { const c = clients.find(x => x.id === clientId); if (!c?.website) { toast.error('Add website first'); return }; runQuickScan() }}
                  disabled={syncing || enriching}
                  style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${R}30`, background: '#fff', fontSize: 12, fontWeight: 700, cursor: syncing ? 'wait' : 'pointer', color: R, display: 'flex', alignItems: 'center', gap: 4, opacity: syncing ? 0.5 : 1 }}>
                  {syncing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />} Scan
                </button>
                <button onClick={runDeepEnrich} disabled={enriching || syncing}
                  style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${AMB}30`, background: '#fff', fontSize: 12, fontWeight: 700, cursor: enriching ? 'wait' : 'pointer', color: AMB, display: 'flex', alignItems: 'center', gap: 4, opacity: enriching ? 0.5 : 1 }}>
                  {enriching ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={12} />} Audit
                </button>
                <button onClick={runSync} disabled={syncing}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: syncing ? '#e5e7eb' : BLK, fontSize: 12, fontWeight: 700, cursor: syncing ? 'wait' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {syncing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />} Sync
                </button>
              </div>
            )}

            {/* Settings */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {clientId && (
                <button onClick={() => {
                  const c = clients.find(x => x.id === clientId)
                  if (c) { setEditingClient(c); setClientForm({ name: c.name || '', website: c.website || '', primary_service: c.primary_service || '', location: '' }); setShowClientModal(true) }
                }} style={{ padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }} title="Edit Client">
                  <Edit2 size={14} color="#6b7280" />
                </button>
              )}
              <button onClick={() => { setEditingClient(null); setClientForm({ name: '', website: '', primary_service: '', location: '' }); setShowClientModal(true) }}
                style={{ padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }} title="Add Client">
                <Plus size={14} color="#6b7280" />
              </button>
            </div>
          </div>

          {/* Tab bar — grouped with dividers */}
          {clientId && (
            <div style={{ padding: '0 40px', display: 'flex', gap: 0, overflowX: 'auto' }}>
              {/* Analyze */}
              {[
                ['dashboard', 'Dashboard', BarChart2],
                ['keywords', 'Keywords', Search],
                ['aeo', 'AEO', Brain],
                ['competitors', 'Competitors', Target],
              ].map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)}
                  style={{ padding: '10px 14px', fontSize: 12, fontWeight: tab === key ? 700 : 500, fontFamily: FH, border: 'none', borderBottom: tab === key ? `2px solid ${BLK}` : '2px solid transparent', background: 'none', cursor: 'pointer', color: tab === key ? BLK : '#9ca3af', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
              <div style={{ width: 1, background: '#e5e7eb', margin: '6px 4px', flexShrink: 0 }} />
              {/* Build */}
              {[
                ['briefs', 'PageIQ', Zap],
                ['utm', 'UTM', Link2],
              ].map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)}
                  style={{ padding: '10px 14px', fontSize: 12, fontWeight: tab === key ? 700 : 500, fontFamily: FH, border: 'none', borderBottom: tab === key ? `2px solid ${BLK}` : '2px solid transparent', background: 'none', cursor: 'pointer', color: tab === key ? BLK : '#9ca3af', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
              <div style={{ width: 1, background: '#e5e7eb', margin: '6px 4px', flexShrink: 0 }} />
              {/* Track */}
              {[
                ['ranks', 'Rankings', TrendingUp],
                ['gmb', 'GMB', Star],
                ['visitors', 'Visitors', Eye],
                ['reports', 'Reports', BarChart2],
              ].map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)}
                  style={{ padding: '10px 14px', fontSize: 12, fontWeight: tab === key ? 700 : 500, fontFamily: FH, border: 'none', borderBottom: tab === key ? `2px solid ${BLK}` : '2px solid transparent', background: 'none', cursor: 'pointer', color: tab === key ? BLK : '#9ca3af', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
              <div style={{ width: 1, background: '#e5e7eb', margin: '6px 4px', flexShrink: 0 }} />
              {/* Settings */}
              {[
                ['audit', 'Audit', Shield],
                ['connect', 'Connect', Settings],
              ].map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)}
                  style={{ padding: '10px 14px', fontSize: 12, fontWeight: tab === key ? 700 : 500, fontFamily: FH, border: 'none', borderBottom: tab === key ? `2px solid ${BLK}` : '2px solid transparent', background: 'none', cursor: 'pointer', color: tab === key ? BLK : '#9ca3af', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable Content ────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px 48px' }}>

          {/* Action cards — show only when client has no data yet */}
          {clientId && !dashboard && tab === 'dashboard' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* Quick Scan */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: R + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={22} color={R} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Quick Scan</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>No login required</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, lineHeight: 1.7, marginBottom: 16 }}>
                  Scans the client's website, XML sitemap, and top competitors via Moz DA. Claude AI analyzes the content and extracts 30-60 target keywords with opportunity scores, intent classification, and ranking potential.
                </div>
                <ul style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8, marginBottom: 16, paddingLeft: 18 }}>
                  <li>Website content + sitemap crawl</li>
                  <li>Moz Domain Authority lookup</li>
                  <li>AI keyword extraction + scoring</li>
                  <li>Competitor identification</li>
                </ul>
                <button onClick={() => {
                  const c = clients.find(x => x.id === clientId)
                  if (!c?.website) { toast.error('Add a website URL first — click Edit Client'); return }
                  runQuickScan()
                }} disabled={syncing || enriching}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: R, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FH, cursor: syncing ? 'wait' : 'pointer', opacity: syncing || enriching ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {syncing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
                  Run Quick Scan
                </button>
              </div>

              {/* Deep Audit */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: AMB + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={22} color={AMB} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Deep Audit</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Technical SEO analysis</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, lineHeight: 1.7, marginBottom: 16 }}>
                  Comprehensive 11-point technical audit covering everything that affects your search rankings. Identifies issues and provides specific fix recommendations.
                </div>
                <ul style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8, marginBottom: 16, paddingLeft: 18 }}>
                  <li>PageSpeed + Core Web Vitals (CrUX)</li>
                  <li>SSL certificate + security headers</li>
                  <li>Schema markup + structured data</li>
                  <li>Tech stack + CMS detection</li>
                  <li>Domain age + authority signals</li>
                </ul>
                <button onClick={runDeepEnrich} disabled={enriching || syncing || !clientId}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: AMB, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FH, cursor: enriching ? 'wait' : 'pointer', opacity: enriching || syncing ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {enriching ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={16} />}
                  Run Deep Audit
                </button>
              </div>

              {/* Full Sync */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: T + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RefreshCw size={22} color={T} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Full Sync</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Requires Google OAuth</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, lineHeight: 1.7, marginBottom: 16 }}>
                  Pulls real keyword data from your connected Google accounts and merges everything into unified keyword profiles with cross-source scoring.
                </div>
                <ul style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8, marginBottom: 16, paddingLeft: 18 }}>
                  <li>Search Console: rankings, clicks, impressions</li>
                  <li>Google Ads: spend, CPC, conversions</li>
                  <li>GA4: sessions, conversions, revenue</li>
                  <li>Keyword Planner: volume, competition</li>
                </ul>
                <button onClick={runSync} disabled={syncing || !clientId}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: T, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FH, cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                  Run Full Sync
                </button>
              </div>
            </div>
          )}

        {/* Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
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

        {false && (
          <div>
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
                    <button onClick={() => {
                      const c = clients.find(x => x.id === clientId)
                      if (!c?.website) { toast.error('This client needs a website URL first — click the ✏️ edit button to add one'); return }
                      runQuickScan()
                    }} disabled={syncing}
                      style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <Zap size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Run Quick Scan
                    </button>
                  </div>
                  <div style={{ padding: '24px', borderRadius: 14, border: `2px solid ${T}20`, background: T + '04', maxWidth: 280, textAlign: 'center' }}>
                    <RefreshCw size={32} color={T} style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 6 }}>Full Sync</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>Requires Google OAuth. Pulls real data from Search Console, Google Ads, GA4. Connect at /seo/connect first.</div>
                    <button onClick={() => { setTab('connect') }} disabled={syncing}
                      style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: T, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Connect Google →
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
            {/* Header with actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Keyword Explorer ({kwTotal} keywords)</div>
              <SectionActions
                onRerun={() => { const c = clients.find(x => x.id === clientId); if (c?.website) runQuickScan(); else toast.error('Add a website URL first') }}
                onDelete={async () => {
                  await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_scan', client_id: clientId, scan_type: 'quick_scan' }) })
                  setKeywords([]); setKwTotal(0); setDashboard(null); toast.success('Keywords cleared')
                }}
                rerunLabel="Rescan"
                deleteLabel="Clear Keywords"
                running={syncing}
              />
            </div>
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

        {/* ══ AEO RESEARCH TAB ══ */}
        {clientId && tab === 'aeo' && (
          <AEOResearchTab clientId={clientId} />
        )}

        {/* ══ PAGE BUILDER TAB ══ */}
        {clientId && tab === 'briefs' && (
          <>
            {/* Page Builder Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>PageIQ — Content Builder</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>AI content briefs + multi-variant page generation with automatic rotation</div>
              </div>
              <SectionActions
                onDelete={() => { setBriefs([]); setActiveBrief(null); toast.success('Briefs cleared') }}
                deleteLabel="Clear Briefs"
              />
            </div>

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Rank Tracker</div>
              <SectionActions
                onRerun={loadRanks}
                onDelete={() => { setRankData(null); toast.success('Rank data cleared') }}
                rerunLabel="Refresh"
                deleteLabel="Clear"
                running={rankLoading}
              />
            </div>
            {rankLoading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div>}

            {!rankLoading && !rankData?.total_tracked && (
              <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
                <TrendingUp size={48} color={T} style={{ margin: '0 auto 16px', opacity: .3 }} />
                <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>No ranking data yet</div>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>Run a Quick Scan first to discover keywords, then check rankings here.</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={() => { const c = clients.find(x => x.id === clientId); if (!c?.website) { toast.error('Add a website URL first'); return }; runQuickScan() }}
                    disabled={syncing} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <Zap size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Quick Scan Keywords
                  </button>
                  <button onClick={runSync} disabled={syncing} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: T, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Full Sync (GSC + Ads)
                  </button>
                </div>
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

        {/* ══ DEEP AUDIT TAB ══ */}
        {clientId && tab === 'audit' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Deep Technical Audit</div>
              <SectionActions
                onRerun={runDeepEnrich}
                onDelete={() => { setEnrichment(null); toast.success('Audit data cleared') }}
                rerunLabel="Rerun Audit"
                deleteLabel="Clear"
                running={enriching}
              />
            </div>
            {enrichLoading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div>}

            {!enrichLoading && !enrichment && (
              <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
                <Shield size={48} color={AMB} style={{ margin: '0 auto 16px', opacity: .3 }} />
                <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>No deep audit data yet</div>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>Run a Deep Audit to analyze this client with 11 SEO tools in parallel — technical audit, on-page analysis, citations, AI visibility, content gaps, market density, and more.</div>
                <button onClick={runDeepEnrich} disabled={enriching}
                  style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: AMB, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  <Shield size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Run Deep Audit
                </button>
              </div>
            )}

            {!enrichLoading && enrichment && (
              <>
                {/* Tools run badge */}
                {enrichment.tools_run?.length > 0 && (
                  <div style={{ padding: '12px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontFamily: FH }}>
                      {enrichment.tools_run.length} Tools Ran · {enrichment.enriched_at ? new Date(enrichment.enriched_at).toLocaleDateString() : ''}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {enrichment.tools_run.map((t, i) => <span key={i} style={{ padding: '3px 10px', borderRadius: 5, background: '#fff', border: '1px solid #e5e7eb', fontSize: 10, color: '#6b7280' }}>{t}</span>)}
                    </div>
                  </div>
                )}

                {/* Score overview */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
                  {[
                    ['Technical', enrichment.technical_audit?.grade, enrichment.technical_audit?.score],
                    ['On-Page', enrichment.onpage_audit?.score ? (enrichment.onpage_audit.score >= 80 ? 'A' : enrichment.onpage_audit.score >= 60 ? 'B' : enrichment.onpage_audit.score >= 40 ? 'C' : 'D') : null, enrichment.onpage_audit?.score],
                    ['Citations', enrichment.citations?.score ? `${enrichment.citations.score}%` : null, enrichment.citations?.score],
                    ['AI Visibility', enrichment.ai_visibility?.grade, enrichment.ai_visibility?.score],
                    ['Market', enrichment.market_density?.opportunity_level?.toUpperCase(), enrichment.market_density?.saturation_score],
                  ].map(([label, grade, score]) => {
                    const numScore = typeof score === 'number' ? score : 0
                    const color = numScore >= 70 ? GRN : numScore >= 40 ? AMB : numScore > 0 ? R : '#d1d5db'
                    return (
                      <div key={label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{grade || '—'}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
                        {typeof score === 'number' && <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 2 }}>{score}/100</div>}
                      </div>
                    )
                  })}
                </div>

                {/* Technical Audit */}
                {enrichment.technical_audit && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertCircle size={18} color={R} /> Technical SEO Audit
                      <span style={{ marginLeft: 'auto', fontFamily: FH, fontSize: 24, fontWeight: 900, color: { A: GRN, B: GRN, C: AMB, D: R, F: R }[enrichment.technical_audit.grade] || '#6b7280' }}>{enrichment.technical_audit.grade}</span>
                    </div>
                    {enrichment.technical_audit.summary && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>{enrichment.technical_audit.summary}</div>}
                    {enrichment.technical_audit.critical_issues?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        {enrichment.technical_audit.critical_issues.map((issue, i) => (
                          <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: R + '06', borderLeft: `3px solid ${R}`, marginBottom: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{issue.issue} ({issue.count})</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{issue.fix}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {enrichment.technical_audit.priority_fixes?.length > 0 && (
                      <div style={{ fontSize: 12, color: '#374151' }}>
                        <strong>Priority fixes:</strong> {enrichment.technical_audit.priority_fixes.join(' · ')}
                      </div>
                    )}
                  </div>
                )}

                {/* On-Page Audit */}
                {enrichment.onpage_audit && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Eye size={18} color={T} /> On-Page SEO Audit
                      <span style={{ marginLeft: 'auto', fontFamily: FH, fontSize: 24, fontWeight: 900, color: enrichment.onpage_audit.score >= 70 ? GRN : enrichment.onpage_audit.score >= 40 ? AMB : R }}>{enrichment.onpage_audit.score}/100</span>
                    </div>
                    {enrichment.onpage_audit.ai_summary && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>{enrichment.onpage_audit.ai_summary}</div>}
                    {enrichment.onpage_audit.critical_fails?.length > 0 && enrichment.onpage_audit.critical_fails.map((f, i) => (
                      <div key={i} style={{ padding: '8px 12px', borderRadius: 6, background: R + '06', borderLeft: `3px solid ${R}`, marginBottom: 4, fontSize: 12, color: '#374151' }}>
                        <strong>{f.label}:</strong> {f.detail} — <span style={{ color: R }}>{f.fix}</span>
                      </div>
                    ))}
                    {enrichment.onpage_audit.local_seo_tips?.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: GRN }}><strong>Local SEO tips:</strong> {enrichment.onpage_audit.local_seo_tips.join(' · ')}</div>
                    )}
                  </div>
                )}

                {/* Citations */}
                {enrichment.citations && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={18} color={AMB} /> Citation Check
                      <span style={{ marginLeft: 'auto', fontFamily: FH, fontSize: 20, fontWeight: 900, color: enrichment.citations.score >= 70 ? GRN : enrichment.citations.score >= 40 ? AMB : R }}>{enrichment.citations.found}/{enrichment.citations.total} found</span>
                    </div>
                    {enrichment.citations.ai_summary && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>{enrichment.citations.ai_summary}</div>}
                    {enrichment.citations.directories && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {enrichment.citations.directories.map((d, i) => (
                          <span key={i} style={{ padding: '4px 10px', borderRadius: 6, background: d.found ? GRN + '10' : R + '10', color: d.found ? GRN : R, fontSize: 11, fontWeight: 600 }}>
                            {d.found ? '✓' : '✕'} {d.directory}
                          </span>
                        ))}
                      </div>
                    )}
                    {enrichment.citations.nap_issues > 0 && <div style={{ fontSize: 12, color: R }}><strong>{enrichment.citations.nap_issues} NAP inconsistencies</strong> found across directories</div>}
                  </div>
                )}

                {/* AI Visibility */}
                {enrichment.ai_visibility && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Brain size={18} color={'#8b5cf6'} /> AI Visibility Test
                      <span style={{ marginLeft: 'auto', fontFamily: FH, fontSize: 24, fontWeight: 900, color: { A: GRN, B: GRN, C: AMB, D: R, F: R }[enrichment.ai_visibility.grade] || '#6b7280' }}>{enrichment.ai_visibility.grade}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div style={{ padding: 14, borderRadius: 10, background: '#f9fafb', textAlign: 'center' }}>
                        <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: enrichment.ai_visibility.mention_rate >= 50 ? GRN : AMB }}>{enrichment.ai_visibility.mention_rate}%</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Mention Rate</div>
                      </div>
                      <div style={{ padding: 14, borderRadius: 10, background: '#f9fafb', textAlign: 'center' }}>
                        <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: enrichment.ai_visibility.positive_rate >= 50 ? GRN : AMB }}>{enrichment.ai_visibility.positive_rate}%</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Positive Rate</div>
                      </div>
                    </div>
                    {enrichment.ai_visibility.summary && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>{enrichment.ai_visibility.summary}</div>}
                    {enrichment.ai_visibility.optimization_tips?.length > 0 && (
                      <div>
                        {enrichment.ai_visibility.optimization_tips.map((tip, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: { high: R, medium: AMB, low: GRN }[tip.impact] + '15', color: { high: R, medium: AMB, low: GRN }[tip.impact] }}>{tip.impact}</span>
                            {tip.tip}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Market Density */}
                {enrichment.market_density && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BarChart2 size={18} color={T} /> Market Density
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                      {[
                        ['Competitors', enrichment.market_density.total_competitors, T],
                        ['Within 5km', enrichment.market_density.nearby_5km, AMB],
                        ['High Rated', enrichment.market_density.high_rated, GRN],
                        ['Saturation', `${enrichment.market_density.saturation_score}/100`, enrichment.market_density.saturation_score >= 70 ? R : enrichment.market_density.saturation_score >= 40 ? AMB : GRN],
                      ].map(([label, val, color]) => (
                        <div key={label} style={{ padding: 14, borderRadius: 10, background: '#f9fafb', textAlign: 'center' }}>
                          <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color }}>{val}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: { high: GRN, medium: AMB, low: R }[enrichment.market_density.opportunity_level] || '#6b7280' }}>
                      Opportunity: {enrichment.market_density.opportunity_level?.toUpperCase()} · Market: {enrichment.market_density.market_assessment?.replace(/_/g, ' ')}
                    </div>
                  </div>
                )}

                {/* Content Gap */}
                {enrichment.content_gap && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Zap size={18} color={R} /> Content Gap Analysis
                    </div>
                    {enrichment.content_gap.quick_content_wins?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: GRN, textTransform: 'uppercase', marginBottom: 8 }}>Quick Content Wins</div>
                        {enrichment.content_gap.quick_content_wins.map((w, i) => (
                          <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: GRN + '06', borderLeft: `3px solid ${GRN}`, marginBottom: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{w.title}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{w.why} · Target: "{w.target_keyword}" · {w.estimated_time}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {enrichment.content_gap.missing_page_types?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: R }}>Missing:</span>
                        {enrichment.content_gap.missing_page_types.map((p, i) => (
                          <span key={i} style={{ padding: '3px 10px', borderRadius: 6, background: R + '10', color: R, fontSize: 11, fontWeight: 600 }}>{p}</span>
                        ))}
                      </div>
                    )}
                    {enrichment.content_gap.content_calendar?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', marginBottom: 8 }}>Content Calendar</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                          {enrichment.content_gap.content_calendar.slice(0, 8).map((item, i) => (
                            <div key={i} style={{ padding: '10px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderTop: `2px solid ${T}` }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: T, textTransform: 'uppercase' }}>Week {item.week}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: BLK, marginTop: 4 }}>{item.title}</div>
                              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{item.type} · "{item.keyword}"</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Grid Scan */}
                {enrichment.grid_scan && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={18} color={R} /> Live Local Pack Grid — "{enrichment.grid_scan.keyword}"
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                      {[
                        ['Coverage', `${enrichment.grid_scan.coverage_pct}%`, enrichment.grid_scan.coverage_pct >= 60 ? GRN : enrichment.grid_scan.coverage_pct >= 30 ? AMB : R],
                        ['Best Rank', enrichment.grid_scan.best_rank ? `#${enrichment.grid_scan.best_rank}` : '—', enrichment.grid_scan.best_rank <= 3 ? GRN : AMB],
                        ['Avg Rank', enrichment.grid_scan.avg_rank ? `#${Math.round(enrichment.grid_scan.avg_rank)}` : '—', T],
                      ].map(([l, v, c]) => (
                        <div key={l} style={{ padding: 14, borderRadius: 10, background: '#f9fafb', textAlign: 'center' }}>
                          <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: c }}>{v}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {enrichment.grid_scan.results?.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${enrichment.grid_scan.grid_size || 3}, 1fr)`, gap: 4, maxWidth: 300, margin: '0 auto' }}>
                        {enrichment.grid_scan.results.map((g, i) => {
                          const color = !g.rank ? '#d1d5db' : g.rank <= 3 ? GRN : g.rank <= 10 ? AMB : R
                          return (
                            <div key={i} style={{ aspectRatio: '1', borderRadius: 6, background: color + '15', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color, fontFamily: FH }}>
                              {g.rank ? `#${g.rank}` : '—'}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Competitor Intel */}
                {enrichment.competitor_intel && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Target size={18} color={R} /> Competitor Intelligence
                    </div>
                    {enrichment.competitor_intel.market_position && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>{enrichment.competitor_intel.market_position}</div>}
                    {enrichment.competitor_intel.competitors?.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
                        {enrichment.competitor_intel.competitors.map((c, i) => (
                          <div key={i} style={{ padding: 12, borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{c.name}</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: T, fontFamily: FH }}>{c.score}/100</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{c.rating}★ · {c.reviews} reviews</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {enrichment.competitor_intel.quick_wins?.length > 0 && (
                      <div style={{ fontSize: 12, color: GRN }}><strong>Quick wins:</strong> {enrichment.competitor_intel.quick_wins.join(' · ')}</div>
                    )}
                  </div>
                )}

                {/* PPC Keywords */}
                {enrichment.ppc_keywords && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DollarSign size={18} color={GRN} /> PPC Keyword Strategy
                    </div>
                    {enrichment.ppc_keywords.campaign_strategy && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>{enrichment.ppc_keywords.campaign_strategy}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div style={{ padding: 14, borderRadius: 10, background: '#f9fafb', textAlign: 'center' }}>
                        <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 900, color: T }}>{enrichment.ppc_keywords.target_cpc_range}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Target CPC</div>
                      </div>
                      <div style={{ padding: 14, borderRadius: 10, background: '#f9fafb', textAlign: 'center' }}>
                        <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 900, color: GRN }}>{enrichment.ppc_keywords.monthly_budget_suggestion}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Budget Suggestion</div>
                      </div>
                    </div>
                    {['service_keywords', 'long_tail_keywords', 'negative_keywords'].map(type => {
                      const kws = enrichment.ppc_keywords[type]
                      if (!kws?.length) return null
                      const colors = { service_keywords: T, long_tail_keywords: AMB, negative_keywords: R }
                      return (
                        <div key={type} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: colors[type], textTransform: 'uppercase', marginBottom: 6 }}>{type.replace(/_/g, ' ')}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {kws.slice(0, 12).map((k, i) => <span key={i} style={{ padding: '3px 8px', borderRadius: 5, background: colors[type] + '10', color: colors[type], fontSize: 10, fontWeight: 600 }}>{k}</span>)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Domain Enrichment */}
                {enrichment.domain && (
                  <div style={card}>
                    <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Search size={18} color={T} /> Domain Intelligence
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                      {[
                        ['CMS', enrichment.domain.cms || '—', T],
                        ['Hosting', enrichment.domain.hosting || '—', T],
                        ['Email', enrichment.domain.email_provider || '—', T],
                      ].map(([l, v, c]) => (
                        <div key={l} style={{ padding: 12, borderRadius: 10, background: '#f9fafb', textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {enrichment.domain.tech_stack?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {enrichment.domain.tech_stack.map((t, i) => <span key={i} style={{ padding: '3px 8px', borderRadius: 5, background: '#f3f4f6', fontSize: 10, color: '#6b7280' }}>{t}</span>)}
                      </div>
                    )}
                    {Object.keys(enrichment.domain.social_links || {}).length > 0 && (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Social: {Object.entries(enrichment.domain.social_links).map(([k, v]) => `${k}: ✓`).join(' · ')}</div>
                    )}
                  </div>
                )}

                {/* Re-run button */}
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <button onClick={runDeepEnrich} disabled={enriching}
                    style={{ padding: '10px 24px', borderRadius: 10, border: `1.5px solid ${AMB}`, background: '#fff', color: AMB, fontSize: 13, fontWeight: 700, cursor: enriching ? 'wait' : 'pointer' }}>
                    {enriching ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6, verticalAlign: -2 }} /> : <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
                    Re-run Deep Audit
                  </button>
                </div>
              </>
            )}

            {/* Content Variant Modules — KP System */}
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <LayoutGrid size={18} color={AMB} /> Content Variant Modules
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
                Each page section has multiple content variants. The WP plugin automatically rotates variants every N page views, signaling freshness to Google and triggering re-indexing. Select which variants to include for each section.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { id: 'intro', label: 'Introduction', desc: 'Opening section with service + location headline', variants: 3, icon: '📝' },
                  { id: 'what_is', label: 'What Is This Service', desc: 'Educational content explaining the service', variants: 2, icon: '❓' },
                  { id: 'why_us', label: 'Why Choose Us', desc: 'Trust signals and differentiators', variants: 2, icon: '✅' },
                  { id: 'services', label: 'Services Offered', desc: 'Breakdown of specific services', variants: 2, icon: '📋' },
                  { id: 'local', label: 'Local Area Focus', desc: 'Hyperlocal content referencing the city', variants: 2, icon: '📍' },
                  { id: 'process', label: 'Our Process', desc: 'Step-by-step how-it-works', variants: 2, icon: '⚙️' },
                  { id: 'trust', label: 'Trust & Social Proof', desc: 'Reviews, testimonials, credibility', variants: 2, icon: '⭐' },
                  { id: 'comparison', label: 'Comparison / vs.', desc: 'Position against competitors or DIY', variants: 2, icon: '⚖️' },
                  { id: 'faq', label: 'FAQ Block', desc: 'AEO-optimized FAQ with schema markup', variants: 2, icon: '💬' },
                  { id: 'internal_links', label: 'Internal Links', desc: 'Related pages and service area links', variants: 2, icon: '🔗' },
                  { id: 'cta', label: 'Call to Action', desc: 'Closing section driving conversions', variants: 2, icon: '📞' },
                ].map(mod => (
                  <div key={mod.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                    borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff',
                  }}>
                    <span style={{ fontSize: 20, width: 36, textAlign: 'center' }}>{mod.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK }}>{mod.label}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{mod.desc}</div>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: T + '12', color: T }}>
                      {mod.variants} variants
                    </span>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: GRN + '12', color: GRN }}>
                      Auto-rotate
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 10, background: AMB + '06', border: `1px solid ${AMB}20`, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
                <strong>How rotation works:</strong> After publishing to WordPress via the KP plugin, each section's variants rotate every 10 page views. This updates the page's <code>last_modified</code> timestamp and pings Google/Bing for re-indexing — signaling freshness without manual content updates.
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 14, textAlign: 'center' }}>
                All variant editing and publishing happens right here — no separate page needed.
              </div>
            </div>
          </>
        )}

        {/* ══ COMPETITORS TAB ══ */}
        {clientId && tab === 'competitors' && (
          <>
            {/* Competitor Landscape — auto-discovers competitors via DataForSEO */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target size={18} color={T} /> Competitor Landscape
                  <SectionActions
                    onDelete={() => { setCompLandscape(null); setSelectedCompDomain(null); setCompDomainKws(null); toast.success('Competitor data cleared') }}
                    deleteLabel="Clear"
                  />
                </div>
                <button onClick={async () => {
                  setCompLandscapeLoading(true)
                  try {
                    const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'dfs_competitors', client_id: clientId }) })
                    const data = await res.json()
                    if (data.success) setCompLandscape(data)
                    else toast.error(data.error || 'Failed to load competitors')
                  } catch { toast.error('Failed to load competitors') }
                  setCompLandscapeLoading(false)
                }} disabled={compLandscapeLoading} style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none', background: compLandscapeLoading ? '#e5e7eb' : BLK,
                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: compLandscapeLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {compLandscapeLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={12} />}
                  {compLandscape ? 'Refresh' : 'Discover Competitors'}
                </button>
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                Find all domains competing for the same keywords as your client. Click any competitor to see which keywords they rank for.
              </div>

              {compLandscapeLoading && <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div>}

              {compLandscape && !compLandscapeLoading && (
                <>
                  {/* Client's own keywords summary */}
                  {compLandscape.client_keywords && (
                    <div style={{ padding: '14px 18px', background: T + '08', borderRadius: 10, border: `1px solid ${T}20`, marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 20 }}>
                        <div><span style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: T }}>{compLandscape.client_keywords.total || 0}</span><div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Total Keywords</div></div>
                        <div><span style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: BLK }}>{compLandscape.domain}</span><div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Your Domain</div></div>
                      </div>
                    </div>
                  )}

                  {/* Competitor table */}
                  {compLandscape.competitors?.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                            {['Competitor', 'Shared KWs', 'Organic KWs', 'Est. Traffic', 'Est. Traffic Value', 'Relevance', ''].map(h => (
                              <th key={h} style={{ padding: '8px 10px', fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, textAlign: h === 'Competitor' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {compLandscape.competitors.map((comp, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selectedCompDomain === comp.domain ? T + '06' : 'transparent' }}
                              onClick={async () => {
                                setSelectedCompDomain(comp.domain)
                                setCompDomainLoading(true)
                                try {
                                  const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'dfs_compare', domain1: compLandscape.domain, domain2: comp.domain }) })
                                  const data = await res.json()
                                  if (data.success) setCompDomainKws(data)
                                } catch {}
                                setCompDomainLoading(false)
                              }}>
                              <td style={{ padding: '10px', fontSize: 14, fontWeight: 700, color: BLK, fontFamily: FH }}>{comp.domain}</td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, fontWeight: 800, color: T }}>{comp.intersections || comp.keywords_count}</td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: BLK }}>{(comp.organic_count || 0).toLocaleString()}</td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: BLK }}>{Math.round(comp.organic_traffic || 0).toLocaleString()}</td>
                              <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, color: GRN }}>${Math.round(comp.organic_cost || 0).toLocaleString()}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ height: 6, borderRadius: 3, background: '#f3f4f6', width: 60, margin: '0 auto', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', borderRadius: 3, background: comp.competitor_relevance > 0.5 ? R : comp.competitor_relevance > 0.2 ? AMB : GRN, width: `${Math.min(comp.competitor_relevance * 100, 100)}%` }} />
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}><ChevronDown size={14} color="#9ca3af" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Selected competitor detail — keyword comparison */}
                  {selectedCompDomain && (
                    <div style={{ marginTop: 16, padding: '16px 20px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                      <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>
                        {compLandscape.domain} vs {selectedCompDomain} — Shared Keywords
                      </div>
                      {compDomainLoading && <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={20} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div>}
                      {compDomainKws && !compDomainLoading && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                {['Keyword', 'Volume', 'CPC', 'Your Pos', 'Their Pos', 'Gap'].map(h => (
                                  <th key={h} style={{ padding: '6px 10px', fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, textAlign: h === 'Keyword' ? 'left' : 'center' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(compDomainKws.intersection || []).slice(0, 30).map((kw, i) => {
                                const gap = (kw.domain1_position || 99) - (kw.domain2_position || 99)
                                return (
                                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, color: BLK }}>{kw.keyword}</td>
                                    <td style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>{(kw.search_volume || 0).toLocaleString()}</td>
                                    <td style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>${(kw.cpc || 0).toFixed(2)}</td>
                                    <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, fontWeight: 800, color: kw.domain1_position <= 3 ? GRN : kw.domain1_position <= 10 ? T : kw.domain1_position <= 20 ? AMB : R }}>
                                      {kw.domain1_position || '—'}
                                    </td>
                                    <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, fontWeight: 800, color: kw.domain2_position <= 3 ? GRN : kw.domain2_position <= 10 ? T : kw.domain2_position <= 20 ? AMB : R }}>
                                      {kw.domain2_position || '—'}
                                    </td>
                                    <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 13, fontWeight: 700, color: gap < 0 ? GRN : gap > 0 ? R : '#9ca3af' }}>
                                      {gap < 0 ? `+${Math.abs(gap)}` : gap > 0 ? `-${gap}` : '='}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Gap Analysis + Attack Opportunities */}
                      {compDomainKws?.intersection?.length > 0 && !compDomainLoading && (() => {
                        const intersection = compDomainKws.intersection || []
                        // Keywords where competitor outranks you
                        const losing = intersection.filter(kw => kw.domain1_position && kw.domain2_position && kw.domain1_position > kw.domain2_position)
                          .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
                        // Keywords where you're close (within 5 positions)
                        const strikingDistance = intersection.filter(kw => kw.domain1_position && kw.domain1_position > 3 && kw.domain1_position <= 10)
                          .sort((a, b) => (a.domain1_position || 99) - (b.domain1_position || 99))
                        // High-value keywords you don't rank for but they do
                        const gaps = (compDomainKws.domain2_keywords?.keywords || [])
                          .filter(kw => kw.position <= 10 && kw.search_volume >= 50 && !intersection.find(i => i.keyword === kw.keyword))
                          .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
                          .slice(0, 10)

                        return (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14 }}>Attack Opportunities</div>

                            {/* Opportunity cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                              <div style={{ padding: '16px', background: R + '06', borderRadius: 10, border: `1px solid ${R}15` }}>
                                <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: R }}>{losing.length}</div>
                                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>They Beat You</div>
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Keywords where competitor ranks higher</div>
                              </div>
                              <div style={{ padding: '16px', background: AMB + '06', borderRadius: 10, border: `1px solid ${AMB}15` }}>
                                <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: AMB }}>{strikingDistance.length}</div>
                                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>Striking Distance</div>
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>You're position 4-10 — push to top 3</div>
                              </div>
                              <div style={{ padding: '16px', background: T + '06', borderRadius: 10, border: `1px solid ${T}15` }}>
                                <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: T }}>{gaps.length}</div>
                                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>Keyword Gaps</div>
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>They rank, you don't — new opportunities</div>
                              </div>
                            </div>

                            {/* Top losing keywords — attack these first */}
                            {losing.length > 0 && (
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Priority Targets — They Outrank You ({losing.length})</div>
                                {losing.slice(0, 8).map((kw, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{kw.keyword}</div>
                                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{(kw.search_volume || 0).toLocaleString()}/mo · ${(kw.cpc || 0).toFixed(2)} CPC</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <span style={{ fontSize: 12, fontFamily: FH, fontWeight: 800, color: R }}>You: #{kw.domain1_position}</span>
                                      <span style={{ fontSize: 10, color: '#9ca3af' }}>vs</span>
                                      <span style={{ fontSize: 12, fontFamily: FH, fontWeight: 800, color: GRN }}>Them: #{kw.domain2_position}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Keyword gaps — they rank, you don't */}
                            {gaps.length > 0 && (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Untapped Keywords — They Rank, You Don't ({gaps.length})</div>
                                {gaps.map((kw, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{kw.keyword}</div>
                                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{(kw.search_volume || 0).toLocaleString()}/mo · ${(kw.cpc || 0).toFixed(2)} CPC</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <span style={{ fontSize: 12, fontFamily: FH, fontWeight: 800, color: '#d1d5db' }}>You: —</span>
                                      <span style={{ fontSize: 10, color: '#9ca3af' }}>vs</span>
                                      <span style={{ fontSize: 12, fontFamily: FH, fontWeight: 800, color: GRN }}>Them: #{kw.position}</span>
                                      <span style={{ padding: '2px 8px', borderRadius: 12, background: T + '12', fontSize: 10, fontWeight: 700, color: T }}>NEW OPP</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </>
              )}

              {!compLandscape && !compLandscapeLoading && (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 13 }}>
                  Click "Discover Competitors" to find all domains competing for the same keywords.
                </div>
              )}
            </div>

            {/* Per-keyword page analysis */}
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={18} color={R} /> Competitor Page Analysis
                <SectionActions
                  onDelete={() => { setCompAnalysis(null); toast.success('Analysis cleared') }}
                  deleteLabel="Clear"
                />
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Google Business Profile</div>
              <SectionActions
                onRerun={loadGMB}
                onDelete={() => { setGmb(null); setGmbPosts([]); toast.success('GMB data cleared') }}
                rerunLabel="Refresh"
                deleteLabel="Clear"
                running={gmbLoading}
              />
            </div>
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

                  {/* GBP Post Generator + Content Calendar */}
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={18} color={R} /> GBP Content Calendar
                        <SectionActions
                          onDelete={() => { setGmbPosts([]); toast.success('Posts cleared') }}
                          onRerun={generatePosts}
                          rerunLabel="Regenerate"
                          running={generatingPosts}
                          deleteLabel="Clear Posts"
                        />
                      </div>
                      <button onClick={generatePosts} disabled={generatingPosts}
                        style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: generatingPosts ? '#e5e7eb' : R, color: '#fff', fontSize: 12, fontWeight: 700, cursor: generatingPosts ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {generatingPosts ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                        {generatingPosts ? 'Generating...' : 'Generate 4 Posts'}
                      </button>
                    </div>

                    {gmbPosts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {gmbPosts.map((post, i) => {
                          const typeColors = { offer: R, tips: T, team: GRN, seasonal: AMB, update: T, event: AMB }
                          const color = typeColors[post.type] || '#6b7280'
                          const schedDate = post.scheduled_date ? new Date(post.scheduled_date) : new Date(Date.now() + i * 7 * 86400000)

                          return (
                            <div key={i} style={{ padding: '20px 24px', borderRadius: 14, background: '#fff', border: '1px solid #e5e7eb', borderLeft: `4px solid ${color}` }}>
                              {/* Header */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: color + '12', color, textTransform: 'uppercase' }}>{post.type}</span>
                                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Week {i + 1} · {schedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: post._approved ? GRN + '12' : '#f3f4f6', color: post._approved ? GRN : '#9ca3af' }}>
                                    {post._approved ? '✓ Approved' : 'Draft'}
                                  </span>
                                </div>
                              </div>

                              {/* Image + Text side by side */}
                              <div style={{ display: 'flex', gap: 16 }}>
                                {/* Image area */}
                                <div style={{ width: 160, flexShrink: 0 }}>
                                  {post._imageUrl ? (
                                    <img src={post._imageUrl} alt="" style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                                  ) : (
                                    <div style={{ width: 160, height: 120, borderRadius: 10, background: '#f3f4f6', border: '1px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                                      <Eye size={20} color="#d1d5db" />
                                      <span style={{ fontSize: 10, color: '#9ca3af' }}>No image</span>
                                    </div>
                                  )}
                                  <button onClick={async () => {
                                    const pexelsKey = 'jaoJot7PGna546LXEjXxCNwv7nqivFKvKKK7dMKimp3DDANeffaLpUco'
                                    const query = post.image_query || (post.type === 'offer' ? g.primary_category?.replace(/_/g, ' ') : post.text?.slice(0, 30)) || g.name || 'business'
                                    try {
                                      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`, { headers: { Authorization: pexelsKey } })
                                      const data = await res.json()
                                      const photos = data.photos || []
                                      if (photos.length > 0) {
                                        const img = photos[Math.floor(Math.random() * Math.min(photos.length, 3))]
                                        const updated = [...gmbPosts]
                                        updated[i] = { ...updated[i], _imageUrl: img.src?.medium || img.src?.small }
                                        setGmbPosts(updated)
                                        toast.success('Image found!')
                                      } else { toast.error('No images found for this topic') }
                                    } catch { toast.error('Image search failed') }
                                  }} style={{ width: '100%', marginTop: 6, padding: '5px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', color: '#6b7280' }}>
                                    Find Image
                                  </button>
                                </div>

                                {/* Text area */}
                                <div style={{ flex: 1 }}>
                                  <textarea value={post._editText ?? post.text} onChange={e => {
                                    const updated = [...gmbPosts]
                                    updated[i] = { ...updated[i], _editText: e.target.value }
                                    setGmbPosts(updated)
                                  }} rows={4} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FB, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <span style={{ fontSize: 11, fontWeight: 700, color }}>{post.cta}</span>
                                      {post.url && <span style={{ fontSize: 11, color: T }}>{post.url}</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button onClick={() => { navigator.clipboard.writeText(post._editText || post.text); toast.success('Post text copied to clipboard!') }}
                                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#6b7280' }}>Copy Text</button>
                                      <button onClick={() => {
                                        const updated = [...gmbPosts]
                                        updated[i] = { ...updated[i], _approved: !updated[i]._approved }
                                        setGmbPosts(updated)
                                        toast.success(updated[i]._approved ? 'Post approved!' : 'Approval removed')
                                      }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: post._approved ? '#e5e7eb' : GRN, color: post._approved ? '#6b7280' : '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                        {post._approved ? 'Unapprove' : 'Approve'}
                                      </button>
                                      {post._approved && (
                                        <button onClick={() => {
                                          navigator.clipboard.writeText(post._editText || post.text)
                                          window.open('https://business.google.com/posts', '_blank')
                                          toast.success('Text copied — paste it in the GBP post editor')
                                        }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#4285F4', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                          Post to GBP →
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {gmbPosts.length === 0 && !generatingPosts && (
                      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <Zap size={32} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
                        <div style={{ fontSize: 14, color: '#6b7280', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                          Generate a 4-week content calendar with AI-written posts. Each post includes type (offer, tips, team, seasonal), editable text, image suggestions from Pexels, and approval workflow.
                        </div>
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

                    {/* Live Grid Scan Form */}
                    {(() => {
                      const runGrid = async () => {
                        if (!gridKw || !gridBiz || !gridLat || !gridLng) { toast.error('Fill in all fields'); return }
                        setGridRunning(true)
                        toast.loading('Running 5x5 grid scan via DataForSEO...', { id: 'grid' })
                        try {
                          const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'dfs_grid_scan', client_id: clientId, agency_id: agencyId, keyword: gridKw, business_name: gridBiz, lat: gridLat, lng: gridLng }) })
                          const data = await res.json()
                          if (data.success) { setGridResult(data.result); toast.success(`Grid scan complete — ${data.result.coverage_pct}% coverage`, { id: 'grid' }) }
                          else { toast.error(data.error || 'Grid scan failed', { id: 'grid' }) }
                        } catch { toast.error('Grid scan failed', { id: 'grid' }) }
                        setGridRunning(false)
                      }

                      return (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Keyword</label>
                              <input value={gridKw} onChange={e => setGridKw(e.target.value)} placeholder="e.g. water damage restoration"
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
                              {keywords.length > 0 && !gridKw && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                                  {keywords.filter(k => k.intent === 'transactional' || k.intent === 'commercial' || k.kp_monthly_volume > 100).slice(0, 6).map((k, i) => (
                                    <button key={i} onClick={() => setGridKw(k.keyword)} style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: T }}>{k.keyword}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Business Name</label>
                              <input value={gridBiz} onChange={e => setGridBiz(e.target.value)} placeholder={g.name}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>City / Address (we'll find the coordinates)</label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input value={gridCity} onChange={e => setGridCity(e.target.value)}
                                  placeholder="e.g. Fort Lauderdale, FL or 123 Main St, Miami"
                                  onKeyDown={async e => {
                                    if (e.key !== 'Enter' || !gridCity.trim()) return
                                    setGeocoding(true)
                                    try {
                                      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''
                                      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(gridCity)}&key=${apiKey}`)
                                      const data = await res.json()
                                      if (data.results?.[0]?.geometry?.location) {
                                        setGridLat(String(data.results[0].geometry.location.lat))
                                        setGridLng(String(data.results[0].geometry.location.lng))
                                        toast.success(`Found: ${data.results[0].formatted_address}`)
                                      } else { toast.error('Location not found — try a more specific address') }
                                    } catch { toast.error('Geocoding failed') }
                                    setGeocoding(false)
                                  }}
                                  style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
                                <button onClick={async () => {
                                  if (!gridCity.trim()) { toast.error('Enter a city or address'); return }
                                  setGeocoding(true)
                                  try {
                                    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''
                                    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(gridCity)}&key=${apiKey}`)
                                    const data = await res.json()
                                    if (data.results?.[0]?.geometry?.location) {
                                      setGridLat(String(data.results[0].geometry.location.lat))
                                      setGridLng(String(data.results[0].geometry.location.lng))
                                      toast.success(`Found: ${data.results[0].formatted_address}`)
                                    } else { toast.error('Location not found') }
                                  } catch { toast.error('Geocoding failed') }
                                  setGeocoding(false)
                                }} disabled={geocoding} style={{
                                  padding: '10px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
                                  fontSize: 13, fontWeight: 700, cursor: geocoding ? 'wait' : 'pointer', color: BLK, whiteSpace: 'nowrap',
                                  display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                  {geocoding ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={12} />}
                                  Find Location
                                </button>
                              </div>
                              {gridLat && gridLng && (
                                <div style={{ fontSize: 11, color: GRN, fontWeight: 600, marginTop: 6 }}>
                                  Coordinates: {parseFloat(gridLat).toFixed(4)}, {parseFloat(gridLng).toFixed(4)}
                                </div>
                              )}
                            </div>
                          </div>
                          <button onClick={runGrid} disabled={gridRunning} style={{
                            padding: '10px 24px', borderRadius: 10, border: 'none', background: gridRunning ? '#e5e7eb' : BLK, color: '#fff',
                            fontSize: 13, fontWeight: 700, cursor: gridRunning ? 'wait' : 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {gridRunning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={14} />}
                            {gridRunning ? 'Scanning 25 points...' : 'Run Live Grid Scan'}
                          </button>

                          {/* Grid results */}
                          {gridResult && (
                            <>
                              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                                {[['Coverage', `${gridResult.coverage_pct}%`, gridResult.coverage_pct >= 60 ? GRN : gridResult.coverage_pct >= 30 ? AMB : R],
                                  ['Avg Rank', gridResult.avg_rank || '—', gridResult.avg_rank <= 3 ? GRN : gridResult.avg_rank <= 10 ? AMB : R],
                                  ['Best', `#${gridResult.best_rank || '—'}`, gridResult.best_rank <= 3 ? GRN : AMB],
                                  ['Found', `${gridResult.ranked_cells}/${gridResult.total_cells}`, GRN],
                                ].map(([label, val, color]) => (
                                  <div key={label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color }}>{val}</div>
                                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>{label}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridResult.grid_size || 5}, 1fr)`, gap: 4, maxWidth: 400, margin: '0 auto 16px' }}>
                                {(gridResult.cells || []).map((cell, i) => {
                                  const rank = cell.rank
                                  const color = rank === null ? '#e5e7eb' : rank <= 3 ? GRN : rank <= 10 ? AMB : R
                                  const isCenter = cell.row === Math.floor((gridResult.grid_size || 5) / 2) && cell.col === Math.floor((gridResult.grid_size || 5) / 2)
                                  return (
                                    <div key={i} style={{
                                      aspectRatio: '1', borderRadius: 8,
                                      background: isCenter ? BLK : rank === null ? '#f3f4f6' : color + '15',
                                      border: `2px solid ${isCenter ? BLK : color}`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: isCenter ? 14 : 12, fontWeight: 800,
                                      color: isCenter ? '#fff' : rank === null ? '#d1d5db' : color, fontFamily: FH,
                                    }} title={cell.top_3?.map(t => `#${t.rank} ${t.title}`).join('\n') || 'Not found'}>
                                      {isCenter ? '📍' : rank ? `#${rank}` : '·'}
                                    </div>
                                  )
                                })}
                              </div>
                            </>
                          )}

                          {!gridResult && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, maxWidth: 400, margin: '0 auto 16px' }}>
                              {Array.from({ length: 25 }).map((_, i) => (
                                <div key={i} style={{ aspectRatio: '1', borderRadius: 8, background: '#f3f4f6', border: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#d1d5db', fontFamily: FH, fontWeight: 800 }}>
                                  {i === 12 ? '📍' : '·'}
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
                            {[['#1-3 (In Pack)', GRN], ['#4-10 (Visible)', AMB], ['#11+ (Invisible)', R], ['📍 Your Business', BLK]].map(([label, color]) => (
                              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7280' }}>
                                <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label}
                              </div>
                            ))}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </>
              )
            })()}
          </>
        )}

        {/* ══ UTM BUILDER TAB ══ */}
        {clientId && tab === 'utm' && (
          <UTMBuilderTab clientId={clientId} clientName={clients.find(c => c.id === clientId)?.name} clientWebsite={clients.find(c => c.id === clientId)?.website} />
        )}

        {/* ══ VISITORS TAB (Pixel Tracking embedded) ══ */}
        {clientId && tab === 'visitors' && (
          <div>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 8 }}>Visitor Intelligence</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Real-time visitor tracking, browser fingerprinting, and behavioral analysis for your client's website.
            </div>
            <div style={{ padding: '20px 24px', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
                <strong>To get started:</strong> Install the tracking pixel on the client's website. The pixel tracks visitors, identifies companies via IP lookup, and builds behavioral profiles automatically.
              </div>
              <button onClick={() => navigate('/kotoiq/pixels')} style={{
                marginTop: 14, padding: '12px 24px', borderRadius: 10, border: 'none',
                background: BLK, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Open Visitor Intelligence Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ══ CONNECT TAB ══ */}
        {clientId && tab === 'connect' && (
          <div>
            <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>Connect Data Sources</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
              Connect your Google accounts to pull real keyword data, analytics, and business profile information. All connections are read-only and encrypted.
            </div>

            {/* Sitemap URL */}
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={18} color={T} /> Sitemap URL
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Adding your sitemap helps KotoIQ discover all indexed pages and analyze your site structure. We'll also try to auto-detect it from your website.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  defaultValue={clients.find(c => c.id === clientId)?.sitemap_url || ''}
                  placeholder="https://example.com/sitemap.xml"
                  id="sitemap-input"
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={async () => {
                  const url = document.getElementById('sitemap-input')?.value
                  if (!url) return
                  await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_client', client_id: clientId, agency_id: agencyId, sitemap_url: url }) })
                  toast.success('Sitemap URL saved')
                }} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: BLK, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Save
                </button>
              </div>
            </div>

            {/* Google Services — one-click OAuth */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={18} color={GRN} /> Google Services
                </div>
                <button onClick={() => {
                  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim()
                  if (!googleClientId) { toast.error('Google OAuth not configured'); return }
                  const scopes = 'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
                  const redirectUri = window.location.origin + '/seo/connect'
                  const state = encodeURIComponent(JSON.stringify({ clientId, ts: Date.now(), returnTo: '/kotoiq?tab=connect' }))
                  const params = new URLSearchParams({
                    client_id: googleClientId, redirect_uri: redirectUri, response_type: 'code',
                    scope: scopes, access_type: 'offline', prompt: 'consent select_account', state,
                  })
                  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10,
                  border: 'none', background: '#4285F4', color: '#fff', fontSize: 14, fontWeight: 700,
                  fontFamily: FH, cursor: 'pointer',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Sign in with Google
                </button>
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                One sign-in connects Search Console, Analytics, Ads, and Business Profile for <strong>{clients.find(c => c.id === clientId)?.name}</strong>. Read-only access — Koto cannot modify your accounts.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { key: 'search_console', label: 'Search Console', desc: 'Keyword rankings, clicks, impressions, CTR', color: '#4285F4', icon: Search },
                  { key: 'analytics', label: 'Google Analytics 4', desc: 'Sessions, conversions, revenue, bounce rate', color: '#F4B400', icon: BarChart2 },
                  { key: 'ads', label: 'Google Ads', desc: 'Spend, CPC, conversions, quality score', color: '#34A853', icon: DollarSign },
                  { key: 'gmb', label: 'Business Profile', desc: 'Reviews, local visibility, performance', color: '#EA4335', icon: MapPin },
                ].map(svc => (
                  <div key={svc.key} style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: svc.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svc.icon size={18} color={svc.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK }}>{svc.label}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{svc.desc}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#f3f4f6', color: '#9ca3af' }}>Pending</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Property picker — shown after OAuth */}
            {oauthStep === 'pick_properties' && oauthTokens && (
              <div style={{ ...card, borderLeft: `4px solid ${GRN}` }}>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: GRN, marginBottom: 16 }}>
                  Authenticated — Select Properties to Connect
                </div>

                {/* GSC picker */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Search size={14} color="#4285F4" /> Search Console Site
                  </div>
                  {gscSites.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#9ca3af', padding: '10px 14px', background: '#f9fafb', borderRadius: 8 }}>No verified GSC sites found for this account</div>
                  ) : (
                    <>
                      <input value={gscSearch} onChange={e => setGscSearch(e.target.value)} placeholder={`Search ${gscSites.length} sites...`}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, marginBottom: 6, outline: 'none', boxSizing: 'border-box' }} />
                      <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                        {gscSites.filter(s => !gscSearch || s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase())).map(s => (
                          <div key={s.siteUrl} onClick={() => setSelectedGsc(s.siteUrl)}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: selectedGsc === s.siteUrl ? 700 : 400, background: selectedGsc === s.siteUrl ? '#eff6ff' : '#fff', borderBottom: '1px solid #f3f4f6', borderLeft: selectedGsc === s.siteUrl ? '3px solid #4285F4' : '3px solid transparent', color: selectedGsc === s.siteUrl ? '#4285F4' : BLK }}>
                            {s.siteUrl.replace('sc-domain:', '★ ').replace('https://', '').replace(/\/$/, '')}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* GA4 picker */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart2 size={14} color="#F4B400" /> Google Analytics 4 Property
                  </div>
                  {ga4Properties.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#9ca3af', padding: '10px 14px', background: '#f9fafb', borderRadius: 8 }}>No GA4 properties found for this account</div>
                  ) : (
                    <>
                      <input value={ga4Search} onChange={e => setGa4Search(e.target.value)} placeholder={`Search ${ga4Properties.length} properties...`}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, marginBottom: 6, outline: 'none', boxSizing: 'border-box' }} />
                      <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                        {ga4Properties.filter(p => !ga4Search || p.displayName.toLowerCase().includes(ga4Search.toLowerCase())).map(p => {
                          const propId = p.name.replace('properties/', '')
                          return (
                            <div key={p.name} onClick={() => setSelectedGa4(propId)}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: selectedGa4 === propId ? 700 : 400, background: selectedGa4 === propId ? '#fef3c7' : '#fff', borderBottom: '1px solid #f3f4f6', borderLeft: selectedGa4 === propId ? '3px solid #F4B400' : '3px solid transparent', color: selectedGa4 === propId ? '#d97706' : BLK }}>
                              {p.displayName} <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 6 }}>{propId} · {p.account}</span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Save button */}
                <button onClick={async () => {
                  if (!selectedGsc && !selectedGa4) { toast.error('Select at least one property'); return }
                  setOauthStep('saving')
                  const { access_token, refresh_token, expires_in, scope } = oauthTokens
                  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
                  try {
                    if (selectedGsc) {
                      await supabase.from('seo_connections').upsert({
                        client_id: clientId, provider: 'search_console', access_token, refresh_token: refresh_token || null,
                        token_expires_at: expiresAt, scope, site_url: selectedGsc, connected: true, updated_at: new Date().toISOString(),
                      }, { onConflict: 'client_id,provider' })
                    }
                    if (selectedGa4) {
                      await supabase.from('seo_connections').upsert({
                        client_id: clientId, provider: 'analytics', access_token, refresh_token: refresh_token || null,
                        token_expires_at: expiresAt, scope, property_id: selectedGa4, connected: true, updated_at: new Date().toISOString(),
                      }, { onConflict: 'client_id,provider' })
                    }
                    // Auto-save GBP + Ads if scope includes them
                    if (scope?.includes('business.manage')) {
                      await supabase.from('seo_connections').upsert({
                        client_id: clientId, provider: 'gmb', access_token, refresh_token: refresh_token || null,
                        token_expires_at: expiresAt, scope, connected: true, updated_at: new Date().toISOString(),
                      }, { onConflict: 'client_id,provider' })
                    }
                    if (scope?.includes('adwords')) {
                      await supabase.from('seo_connections').upsert({
                        client_id: clientId, provider: 'ads', access_token, refresh_token: refresh_token || null,
                        token_expires_at: expiresAt, scope, connected: true, updated_at: new Date().toISOString(),
                      }, { onConflict: 'client_id,provider' })
                    }
                    toast.success('Google services connected!')
                    setOauthStep('done')
                  } catch (e) { toast.error('Failed to save: ' + e.message); setOauthStep('pick_properties') }
                }} disabled={oauthStep === 'saving' || (!selectedGsc && !selectedGa4)}
                  style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: (!selectedGsc && !selectedGa4) ? '#e5e7eb' : GRN, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FH, cursor: 'pointer' }}>
                  {oauthStep === 'saving' ? 'Saving...' : `Save Connections${selectedGsc && selectedGa4 ? ' (2)' : selectedGsc || selectedGa4 ? ' (1)' : ''}`}
                </button>
              </div>
            )}

            {oauthStep === 'done' && (
              <div style={{ ...card, borderLeft: `4px solid ${GRN}`, background: GRN + '04' }}>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: GRN, marginBottom: 8 }}>Connected Successfully</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
                  {selectedGsc && <div>Search Console: {selectedGsc.replace('sc-domain:', '').replace('https://', '')}</div>}
                  {selectedGa4 && <div>GA4 Property: {selectedGa4}</div>}
                </div>
                <button onClick={() => { setTab('dashboard'); setOauthStep(null) }}
                  style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: BLK, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Go to Dashboard →
                </button>
              </div>
            )}

            {oauthStep === 'exchanging' && (
              <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
                <Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 14, color: '#6b7280' }}>Exchanging tokens with Google...</div>
              </div>
            )}

            {/* DataForSEO */}
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color={AMB} /> DataForSEO API
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Powers SERP feature detection, AI Overview analysis, competitor intelligence, GMB grid tracking, and bulk rank checking.
              </div>
              <div style={{ padding: '12px 16px', background: GRN + '06', borderRadius: 8, border: `1px solid ${GRN}20`, fontSize: 13, color: GRN, fontWeight: 600 }}>
                ✓ Connected — API key configured in environment
              </div>
            </div>

            {/* Moz API */}
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color={T} /> Moz API
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Domain Authority, Page Authority, backlink counts, spam score — used in Quick Scan and competitor analysis.
              </div>
              <div style={{ padding: '12px 16px', background: GRN + '06', borderRadius: 8, border: `1px solid ${GRN}20`, fontSize: 13, color: GRN, fontWeight: 600 }}>
                ✓ Connected — API key configured in environment
              </div>
            </div>
          </div>
        )}

        {/* ══ REPORTS TAB ══ */}
        {clientId && tab === 'reports' && (
          <ReportsTab clientId={clientId} keywords={keywords} dashboard={dashboard} />
        )}

        {/* ══ REPORTS TAB PLACEHOLDER — replaced by component ══ */}
        {false && clientId && tab === 'reports_old' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {[
                { title: 'Position Distribution', desc: 'Keywords by rank bucket: #1-3, #4-10, #11-20, #21+', icon: BarChart2, color: T, source: 'GSC' },
                { title: 'CTR by Position', desc: 'Click-through rate at each ranking position vs expected', icon: TrendingUp, color: GRN, source: 'GSC' },
                { title: 'Impression Trends', desc: 'Keywords gaining or losing impressions week-over-week', icon: TrendingUp, color: AMB, source: 'GSC Daily' },
                { title: 'Rank Movement', desc: 'Biggest gainers and losers in the last 7/30 days', icon: ArrowUpRight, color: R, source: 'GSC' },
                { title: 'Pages by Traffic', desc: 'Top landing pages ranked by organic sessions', icon: FileText, color: T, source: 'GSC + GA4' },
                { title: 'Conversion by Page', desc: 'Which pages drive the most conversions and revenue', icon: DollarSign, color: GRN, source: 'GA4' },
                { title: 'Paid vs Organic', desc: 'Keywords where you rank organically AND pay for ads', icon: Target, color: R, source: 'GSC + Ads' },
                { title: 'Cost per Acquisition', desc: 'CPA by keyword — find the most efficient converters', icon: DollarSign, color: AMB, source: 'Ads' },
                { title: 'Quality Score Map', desc: 'Ad quality score distribution — where to improve', icon: Star, color: AMB, source: 'Ads' },
                { title: 'AI Overview Coverage', desc: 'Which keywords trigger AI Overviews — are you cited?', icon: Brain, color: '#7c3aed', source: 'DataForSEO' },
                { title: 'Featured Snippets', desc: 'Snippet opportunities you can win with content updates', icon: Zap, color: T, source: 'DataForSEO' },
                { title: 'Local Pack Map', desc: 'Geographic heatmap of local pack visibility', icon: MapPin, color: GRN, source: 'DataForSEO Grid' },
                { title: 'Competitor Gap', desc: 'Keywords competitors rank for that you don\'t', icon: Target, color: R, source: 'DataForSEO' },
                { title: 'Domain Authority', desc: 'DA trend over time vs competitor domains', icon: Shield, color: T, source: 'Moz' },
                { title: 'Backlink Growth', desc: 'New and lost backlinks tracked over time', icon: TrendingUp, color: GRN, source: 'Moz' },
                { title: 'Page Speed Scores', desc: 'Performance scores for all tracked URLs', icon: Zap, color: AMB, source: 'CrUX' },
                { title: 'Core Web Vitals', desc: 'LCP, FID, CLS — pass/fail by page', icon: Activity, color: R, source: 'CrUX' },
                { title: 'GBP Impressions', desc: 'Search vs Maps views of your business profile', icon: Eye, color: '#EA4335', source: 'GBP API' },
                { title: 'GBP Actions', desc: 'Calls, directions, website clicks from your listing', icon: Phone, color: GRN, source: 'GBP API' },
                { title: 'Review Velocity', desc: 'Review growth rate + sentiment analysis', icon: Star, color: AMB, source: 'GBP + Places' },
                { title: 'Content Gaps', desc: 'Topics competitors cover that you\'re missing', icon: FileText, color: R, source: 'DataForSEO' },
                { title: 'Search Intent Map', desc: 'Keywords classified by intent: transactional, info, nav', icon: Brain, color: T, source: 'AI' },
                { title: 'Opportunity Matrix', desc: 'Keywords scored by volume × rank gap × conversion', icon: Target, color: GRN, source: 'Composite' },
                { title: 'ROI Calculator', desc: 'Organic traffic value vs equivalent paid cost', icon: DollarSign, color: '#7c3aed', source: 'GSC + Ads' },
                { title: 'Seasonal Trends', desc: 'Keywords with seasonal patterns + peak predictions', icon: Clock, color: AMB, source: 'GSC + KP' },
                { title: 'Technical Issues', desc: 'SEO errors found in the last deep audit', icon: AlertCircle, color: R, source: 'Deep Audit' },
                { title: 'Schema Coverage', desc: 'Which pages have structured data and which don\'t', icon: FileText, color: T, source: 'Scrape' },
                { title: 'Internal Links', desc: 'Link distribution + orphan page detection', icon: Globe, color: AMB, source: 'Scrape' },
                { title: 'Entity Coverage', desc: 'Core entities in your niche — coverage vs competitors', icon: Brain, color: '#7c3aed', source: 'AI + DFS' },
                { title: 'Monthly Summary', desc: 'Auto-generated performance report across all metrics', icon: FileText, color: BLK, source: 'All' },
              ].map((report, i) => (
                <div key={i} style={{ padding: '18px 20px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = report.color; e.currentTarget.style.boxShadow = `0 4px 16px ${report.color}10` }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}
                  onClick={() => toast('Report coming soon — data sources need to be connected first')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <report.icon size={16} color={report.color} />
                    <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK }}>{report.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 8 }}>{report.desc}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: report.color + '10', color: report.color }}>{report.source}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
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

/* ══════════════════════════════════════════════════════════════════════════
   AEO RESEARCH TAB — Search Google, extract AI Overview + gaps + opportunities
   ══════════════════════════════════════════════════════════════════════════ */
function AEOResearchTab({ clientId }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const runResearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aeo_research', keyword: query.trim(), client_id: clientId }) })
      const data = await res.json()
      if (data.success) setResult(data)
      else toast.error(data.error || 'Research failed')
    } catch { toast.error('Research failed') }
    setLoading(false)
  }

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }
  const GRN = '#16a34a', AMB = '#f59e0b', R = '#E6007E', T = '#00C2CB', BLK = '#111111'
  const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
  const FB = "'Raleway','Helvetica Neue',sans-serif"

  return (
    <>
      {/* Search input */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={18} color={T} /> AEO Research — AI Overview Gap Finder
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
          Search any keyword to see what Google's AI Overview says, which companies it mentions, what information it misses, and which new pages you should create to get cited.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runResearch() }}
            placeholder="Enter a keyword or phrase to research..."
            style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 15, fontFamily: FH, fontWeight: 600, outline: 'none' }} />
          <button onClick={runResearch} disabled={loading || !query.trim()}
            style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: loading ? '#e5e7eb' : BLK, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
            {loading ? 'Searching...' : 'Research'}
          </button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} color={T} style={{ animation: 'spin 1s linear infinite' }} /><div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>Searching Google + analyzing AI Overview...</div></div>}

      {result && !loading && (
        <>
          {/* AI Overview */}
          <div style={{ ...card, borderLeft: result.ai_overview ? `4px solid ${T}` : '4px solid #e5e7eb' }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brain size={16} color={T} />
              {result.ai_overview ? 'AI Overview Present' : 'No AI Overview for This Query'}
            </div>
            {result.ai_overview ? (
              <>
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 12, padding: '12px 16px', background: T + '06', borderRadius: 10 }}>
                  {result.ai_overview.text || 'AI Overview text not extracted'}
                </div>
                {result.mentioned_companies?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Companies Cited in AI Overview</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {result.mentioned_companies.map((c, i) => (
                        <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 12px', borderRadius: 20, background: '#f3f4f6', fontSize: 12, fontWeight: 600, color: BLK, textDecoration: 'none' }}>
                          {c.domain}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#6b7280', padding: '12px 16px', background: '#f9fafb', borderRadius: 10 }}>
                No AI Overview for this query — this is an opportunity. Content targeting this keyword has a clear path to ranking without competing against an AI summary.
              </div>
            )}
          </div>

          {/* Gap Analysis */}
          {result.gap_analysis && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Information Gap Analysis</div>
              {result.gap_analysis.information_gaps?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Gaps in Current Content (Your Opportunity)</div>
                  {result.gap_analysis.information_gaps.map((gap, i) => (
                    <div key={i} style={{ padding: '8px 14px', background: R + '04', borderRadius: 8, borderLeft: `3px solid ${R}`, marginBottom: 6, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                      {gap}
                    </div>
                  ))}
                </div>
              )}
              {result.gap_analysis.content_opportunities?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: GRN, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Content Opportunities</div>
                  {result.gap_analysis.content_opportunities.map((opp, i) => (
                    <div key={i} style={{ padding: '8px 14px', background: GRN + '04', borderRadius: 8, borderLeft: `3px solid ${GRN}`, marginBottom: 6, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                      {opp}
                    </div>
                  ))}
                </div>
              )}
              {result.gap_analysis.aeo_strategy && (
                <div style={{ padding: '14px 18px', background: T + '06', borderRadius: 10, border: `1px solid ${T}20`, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>AEO Strategy</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{result.gap_analysis.aeo_strategy}</div>
                </div>
              )}
              {result.gap_analysis.entity_map?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Core Entities</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {result.gap_analysis.entity_map.map((e, i) => (
                      <span key={i} style={{ padding: '3px 10px', borderRadius: 20, background: '#f0f9ff', fontSize: 12, fontWeight: 600, color: '#0369a1' }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggested Pages */}
          {(result.gap_analysis?.suggested_pages?.length > 0 || result.related_searches?.length > 0) && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Suggested New Pages to Create</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(result.gap_analysis?.suggested_pages || result.related_searches || []).map((page, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: BLK }}>{page}</div>
                    <button onClick={() => setQuery(page)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: T }}>Research This</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* People Also Ask */}
          {result.people_also_ask?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>People Also Ask ({result.people_also_ask.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.people_also_ask.map((q, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>{q}</span>
                    <button onClick={() => setQuery(q)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, cursor: 'pointer', color: T }}>Research</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Organic Results */}
          {result.top_results?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Top 10 Organic Results</div>
              {result.top_results.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < result.top_results.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <span style={{ fontFamily: FH, fontSize: 16, fontWeight: 900, color: r.position <= 3 ? GRN : r.position <= 10 ? AMB : R, minWidth: 30, textAlign: 'center' }}>#{r.position}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: T }}>{r.domain}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Featured Snippet */}
          {result.featured_snippet && (
            <div style={{ ...card, borderLeft: `4px solid ${AMB}` }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 8 }}>Featured Snippet</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>{result.featured_snippet.description}</div>
              <div style={{ fontSize: 12, color: AMB, fontWeight: 700 }}>{result.featured_snippet.domain} — {result.featured_snippet.type}</div>
            </div>
          )}

          {/* Related Searches */}
          {result.related_searches?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Related Searches ({result.related_searches.length})</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {result.related_searches.map((s, i) => (
                  <button key={i} onClick={() => setQuery(s)} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: BLK }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   REPORTS TAB — Real data views from keywords + connected sources
   ══════════════════════════════════════════════════════════════════════════ */
function ReportsTab({ clientId, keywords, dashboard }) {
  const [activeReport, setActiveReport] = useState(null)
  const kws = keywords || []
  const GRN = '#16a34a', AMB = '#f59e0b', R = '#E6007E', T = '#00C2CB', BLK = '#111111'
  const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"

  // Pre-compute report data from keywords
  const ranked = kws.filter(k => k.sc_position || k.position)
  const posGroups = {
    top3: ranked.filter(k => (k.sc_position || k.position) <= 3),
    top10: ranked.filter(k => (k.sc_position || k.position) > 3 && (k.sc_position || k.position) <= 10),
    top20: ranked.filter(k => (k.sc_position || k.position) > 10 && (k.sc_position || k.position) <= 20),
    beyond: ranked.filter(k => (k.sc_position || k.position) > 20),
    unranked: kws.filter(k => !k.sc_position && !k.position),
  }
  const aiOverviewKws = kws.filter(k => k.ai_overview)
  const paidKws = kws.filter(k => k.ads_spend_cents > 0 || k.ads_clicks > 0)
  const organicPaidOverlap = kws.filter(k => (k.sc_position || k.position) && (k.ads_spend_cents > 0))

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }

  if (kws.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <BarChart2 size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>No Data Yet</div>
        <div style={{ fontSize: 14, color: '#6b7280', maxWidth: 400, margin: '0 auto' }}>Run a Quick Scan or Full Sync first to populate keyword data. Reports will generate automatically from your data.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>Data Reports</div>
      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>{kws.length} keywords tracked · {ranked.length} with ranking data</div>

      {/* Position Distribution */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Position Distribution</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            ['#1-3', posGroups.top3.length, GRN],
            ['#4-10', posGroups.top10.length, T],
            ['#11-20', posGroups.top20.length, AMB],
            ['#21+', posGroups.beyond.length, R],
            ['Not Ranked', posGroups.unranked.length, '#9ca3af'],
          ].map(([label, count, color]) => (
            <div key={label} style={{ textAlign: 'center', padding: '16px', background: color + '08', borderRadius: 10 }}>
              <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color }}>{count}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
        {/* Bar visualization */}
        <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden' }}>
          {[[posGroups.top3.length, GRN], [posGroups.top10.length, T], [posGroups.top20.length, AMB], [posGroups.beyond.length, R], [posGroups.unranked.length, '#d1d5db']].map(([count, color], i) => (
            count > 0 ? <div key={i} style={{ flex: count, background: color, transition: 'flex .3s' }} title={`${count} keywords`} /> : null
          ))}
        </div>
      </div>

      {/* AI Overview Coverage */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>AI Overview Coverage</div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 900, color: '#7c3aed' }}>{aiOverviewKws.length}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Keywords with AI Overview</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 900, color: '#9ca3af' }}>{kws.length - aiOverviewKws.length}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Without AI Overview</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 900, color: T }}>{kws.length > 0 ? Math.round((aiOverviewKws.length / kws.length) * 100) : 0}%</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Coverage Rate</div>
          </div>
        </div>
        {aiOverviewKws.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Keywords with AI Overview</div>
            {aiOverviewKws.slice(0, 10).map((kw, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{kw.keyword}</span>
                <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: (kw.sc_position || kw.position) <= 10 ? GRN : AMB }}>#{kw.sc_position || kw.position || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paid vs Organic Overlap */}
      {organicPaidOverlap.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Paid vs Organic Overlap — Cannibal Keywords</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Keywords where you rank organically AND pay for ads. Consider reducing bids on keywords where organic rank is strong.</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Keyword', 'Organic Pos', 'Ad Spend', 'Ad CPC', 'Volume', 'Action'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', fontFamily: FH, textAlign: h === 'Keyword' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {organicPaidOverlap.slice(0, 15).map((kw, i) => {
                const pos = kw.sc_position || kw.position || 99
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, color: BLK }}>{kw.keyword}</td>
                    <td style={{ textAlign: 'center', fontFamily: FH, fontSize: 14, fontWeight: 800, color: pos <= 3 ? GRN : pos <= 10 ? T : AMB }}>#{pos}</td>
                    <td style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>${((kw.ads_spend_cents || 0) / 100).toFixed(0)}</td>
                    <td style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>${((kw.ads_cpc_cents || 0) / 100).toFixed(2)}</td>
                    <td style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>{(kw.kp_monthly_volume || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: pos <= 3 ? R + '12' : AMB + '12', color: pos <= 3 ? R : AMB }}>
                        {pos <= 3 ? 'Pause Ad' : pos <= 10 ? 'Reduce Bid' : 'Keep'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Opportunity Matrix */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Top Opportunities by Score</div>
        {kws.filter(k => k.opportunity_score > 0).sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0)).slice(0, 15).map((kw, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 900, color: T, minWidth: 36 }}>{Math.round(kw.opportunity_score)}</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
              <div style={{ width: `${kw.opportunity_score}%`, height: '100%', borderRadius: 3, background: kw.opportunity_score >= 70 ? GRN : kw.opportunity_score >= 40 ? AMB : '#d1d5db' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: BLK, minWidth: 200 }}>{kw.keyword}</span>
            <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 60 }}>#{kw.sc_position || kw.position || '—'}</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{(kw.kp_monthly_volume || 0).toLocaleString()}/mo</span>
          </div>
        ))}
        {kws.filter(k => k.opportunity_score > 0).length === 0 && (
          <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Run a Quick Scan to generate opportunity scores</div>
        )}
      </div>

      {/* Search Intent Distribution */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Search Intent Distribution</div>
        {(() => {
          const intents = {}
          kws.forEach(k => { const i = k.intent || 'unknown'; intents[i] = (intents[i] || 0) + 1 })
          const intentColors = { transactional: R, commercial: AMB, informational: T, navigational: '#7c3aed', unknown: '#9ca3af' }
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {Object.entries(intents).map(([intent, count]) => (
                <div key={intent} style={{ textAlign: 'center', padding: '14px', background: (intentColors[intent] || '#9ca3af') + '08', borderRadius: 10 }}>
                  <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: intentColors[intent] || '#9ca3af' }}>{count}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize', marginTop: 4 }}>{intent}</div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Category Breakdown */}
      {dashboard?.categories && Object.keys(dashboard.categories).length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Keyword Categories</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {Object.entries(dashboard.categories).map(([cat, count]) => (
              <div key={cat} style={{ padding: '14px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: BLK }}>{count}</div>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize', marginTop: 4 }}>{cat.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured Snippet Opportunities */}
      {kws.filter(k => k.featured_snippet).length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Featured Snippet Opportunities</div>
          {kws.filter(k => k.featured_snippet).slice(0, 10).map((kw, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{kw.keyword}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{(kw.kp_monthly_volume || 0).toLocaleString()}/mo</span>
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: AMB + '12', color: AMB }}>Snippet</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ROI Calculator */}
      {paidKws.length > 0 && (() => {
        const totalPaidSpend = paidKws.reduce((s, k) => s + (k.ads_spend_cents || 0), 0) / 100
        const organicValue = ranked.reduce((s, k) => {
          const vol = k.kp_monthly_volume || 0
          const pos = k.sc_position || k.position || 99
          const ctr = pos <= 1 ? 0.285 : pos <= 3 ? 0.12 : pos <= 5 ? 0.065 : pos <= 10 ? 0.025 : 0.005
          const cpc = (k.ads_cpc_cents || k.kp_bid_high_cents || 200) / 100
          return s + (vol * ctr * cpc)
        }, 0)
        return (
          <div style={card}>
            <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>ROI: Organic Value vs Paid Cost</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div style={{ padding: '18px', background: GRN + '06', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: GRN }}>${Math.round(organicValue).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Organic Value/mo</div>
              </div>
              <div style={{ padding: '18px', background: R + '06', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: R }}>${Math.round(totalPaidSpend).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Ad Spend/mo</div>
              </div>
              <div style={{ padding: '18px', background: T + '06', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: T }}>{totalPaidSpend > 0 ? `${(organicValue / totalPaidSpend).toFixed(1)}x` : '∞'}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>ROI Multiple</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Volume Distribution */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Search Volume Distribution</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            ['High (1K+)', kws.filter(k => (k.kp_monthly_volume || 0) >= 1000).length, GRN],
            ['Medium (100-999)', kws.filter(k => (k.kp_monthly_volume || 0) >= 100 && (k.kp_monthly_volume || 0) < 1000).length, T],
            ['Low (10-99)', kws.filter(k => (k.kp_monthly_volume || 0) >= 10 && (k.kp_monthly_volume || 0) < 100).length, AMB],
            ['Very Low (<10)', kws.filter(k => (k.kp_monthly_volume || 0) < 10).length, '#9ca3af'],
          ].map(([label, count, color]) => (
            <div key={label} style={{ padding: '16px', background: color + '08', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color }}>{count}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Local Pack Keywords */}
      {kws.filter(k => k.local_pack).length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Local Pack Keywords ({kws.filter(k => k.local_pack).length})</div>
          {kws.filter(k => k.local_pack).slice(0, 10).map((kw, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{kw.keyword}</span>
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: GRN + '12', color: GRN }}>Local Pack</span>
            </div>
          ))}
        </div>
      )}

      {/* Top Pages by Keyword Count */}
      {(() => {
        const pageMap = {}
        kws.forEach(k => { if (k.url) { if (!pageMap[k.url]) pageMap[k.url] = { url: k.url, count: 0, avgPos: 0, totalVol: 0 }; pageMap[k.url].count++; pageMap[k.url].avgPos += (k.sc_position || k.position || 0); pageMap[k.url].totalVol += (k.kp_monthly_volume || 0) } })
        const pages = Object.values(pageMap).map(p => ({ ...p, avgPos: p.count > 0 ? Math.round(p.avgPos / p.count) : 0 })).sort((a, b) => b.count - a.count).slice(0, 10)
        if (pages.length === 0) return null
        return (
          <div style={card}>
            <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16 }}>Top Pages by Keyword Count</div>
            {pages.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 900, color: T, minWidth: 30 }}>{p.count}</span>
                <div style={{ flex: 1, fontSize: 12, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.url?.replace(/https?:\/\/[^/]+/, '') || '/'}
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Avg #{p.avgPos}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{p.totalVol.toLocaleString()} vol</span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   UTM BUILDER TAB
   ══════════════════════════════════════════════════════════════════════════ */
function UTMBuilderTab({ clientId, clientName, clientWebsite }) {
  const [baseUrl, setBaseUrl] = useState(clientWebsite || '')
  const [source, setSource] = useState('')
  const [medium, setMedium] = useState('')
  const [campaign, setCampaign] = useState('')
  const [content, setContent] = useState('')
  const [term, setTerm] = useState('')
  const [history, setHistory] = useState([])

  const GRN = '#16a34a', AMB = '#f59e0b', R = '#E6007E', T = '#00C2CB', BLK = '#111111'
  const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
  const FB = "'Raleway','Helvetica Neue',sans-serif"
  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }

  const buildUrl = () => {
    if (!baseUrl) return ''
    const params = new URLSearchParams()
    if (source) params.set('utm_source', source)
    if (medium) params.set('utm_medium', medium)
    if (campaign) params.set('utm_campaign', campaign)
    if (content) params.set('utm_content', content)
    if (term) params.set('utm_term', term)
    const qs = params.toString()
    if (!qs) return baseUrl
    const sep = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${sep}${qs}`
  }

  const generatedUrl = buildUrl()

  const presets = [
    { label: 'GBP Post', source: 'google', medium: 'organic', campaign: 'gbp_post' },
    { label: 'Google Ads', source: 'google', medium: 'cpc', campaign: 'brand' },
    { label: 'Facebook Ad', source: 'facebook', medium: 'paid_social', campaign: 'awareness' },
    { label: 'Email Blast', source: 'email', medium: 'email', campaign: 'newsletter' },
    { label: 'Instagram Bio', source: 'instagram', medium: 'social', campaign: 'bio_link' },
    { label: 'LinkedIn Post', source: 'linkedin', medium: 'social', campaign: 'organic_post' },
    { label: 'QR Code', source: 'qr_code', medium: 'offline', campaign: 'print_material' },
    { label: 'SMS Campaign', source: 'sms', medium: 'sms', campaign: 'promo' },
  ]

  return (
    <div>
      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 8 }}>UTM Builder</div>
      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
        Create UTM-tagged URLs to track which marketing channels drive traffic. Every link is trackable in Google Analytics.
      </div>

      {/* Quick Presets */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 12 }}>Quick Presets</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => { setSource(p.source); setMedium(p.medium); setCampaign(p.campaign) }}
              style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid #e5e7eb', background: source === p.source && medium === p.medium ? T + '12' : '#fff', color: source === p.source && medium === p.medium ? T : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .12s' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Builder Form */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 16 }}>Build Your URL</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Landing Page URL *
            </label>
            <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://example.com/services/plumbing"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Source * <span style={{ fontWeight: 400, textTransform: 'none' }}>— where traffic comes from</span>
              </label>
              <input value={source} onChange={e => setSource(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="google, facebook, newsletter"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Medium * <span style={{ fontWeight: 400, textTransform: 'none' }}>— marketing channel type</span>
              </label>
              <input value={medium} onChange={e => setMedium(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="cpc, email, social, organic"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Campaign * <span style={{ fontWeight: 400, textTransform: 'none' }}>— campaign name</span>
              </label>
              <input value={campaign} onChange={e => setCampaign(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="spring_promo, brand_awareness"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Content <span style={{ fontWeight: 400, textTransform: 'none' }}>— ad/link variant (optional)</span>
              </label>
              <input value={content} onChange={e => setContent(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="banner_top, sidebar, cta_button"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Term <span style={{ fontWeight: 400, textTransform: 'none' }}>— paid keyword (optional)</span>
            </label>
            <input value={term} onChange={e => setTerm(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder="emergency_plumber, water_damage"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      {/* Generated URL */}
      {generatedUrl && source && (
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 12 }}>Generated URL</div>
          <div style={{ padding: '14px 18px', background: '#111', borderRadius: 10, marginBottom: 14, position: 'relative' }}>
            <code style={{ fontSize: 13, color: '#a3e635', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.6 }}>
              {generatedUrl}
            </code>
            <button onClick={() => { navigator.clipboard.writeText(generatedUrl); toast.success('URL copied!'); setHistory(prev => [{ url: generatedUrl, source, medium, campaign, date: new Date().toISOString() }, ...prev.slice(0, 19)]) }}
              style={{ position: 'absolute', top: 10, right: 10, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Copy size={12} /> Copy
            </button>
          </div>

          {/* Parameter breakdown */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {source && <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: T + '12', color: T }}>source: {source}</span>}
            {medium && <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: GRN + '12', color: GRN }}>medium: {medium}</span>}
            {campaign && <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: AMB + '12', color: AMB }}>campaign: {campaign}</span>}
            {content && <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#7c3aed12', color: '#7c3aed' }}>content: {content}</span>}
            {term && <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: R + '12', color: R }}>term: {term}</span>}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 12 }}>Recently Generated ({history.length})</div>
          {history.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < history.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.url}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{h.source} / {h.medium} / {h.campaign}</div>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(h.url); toast.success('Copied!') }}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}>Copy</button>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div style={{ ...card, background: '#f9fafb' }}>
        <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 10 }}>UTM Best Practices</div>
        <ul style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
          <li>Always use lowercase — GA4 treats "Google" and "google" as different sources</li>
          <li>Use underscores instead of spaces (e.g. <code>spring_promo</code> not <code>spring promo</code>)</li>
          <li>Be consistent — use the same source/medium naming across all campaigns</li>
          <li>Never use UTM parameters on internal links (it breaks session attribution)</li>
          <li>For GBP posts, always use <code>source=google&medium=organic&campaign=gbp_post</code></li>
          <li>Tag every external link — untagged traffic shows as "direct" in GA4</li>
        </ul>
      </div>
    </div>
  )
}
