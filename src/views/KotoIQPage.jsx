"use client"
import { useState, useEffect } from 'react'
import {
  Search, TrendingUp, Globe, MapPin, BarChart2, FileText, Zap, Target,
  RefreshCw, Loader2, Plus, ChevronRight, ChevronDown, Check, X, Eye,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, Brain, Shield,
  Monitor, Hash, Star, Clock, Activity, Settings, DollarSign, Layers
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

const W = '#ffffff'
const API = '/api/kotoiq'

async function apiGet(action, params = {}) {
  const url = new URL(API, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, String(v))
  return (await fetch(url)).json()
}
async function apiPost(body) {
  return (await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()
}

const card = { background: W, borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }
const cardInner = { ...card, padding: '20px 24px' }

function posColor(pos) {
  if (!pos) return '#9ca3af'
  if (pos <= 3) return GRN
  if (pos <= 10) return T
  if (pos <= 20) return AMB
  return R
}

export default function KotoIQPage() {
  const { agencyId } = useAuth()

  // Tab state persisted in URL
  const [tab, setTab] = (() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const initial = params?.get('tab') || 'dashboard'
    const [t, setter] = useState(initial)
    const wrappedSet = (v) => { setter(v); const url = new URL(window.location.href); url.searchParams.set('tab', v); window.history.replaceState({}, '', url.toString()) }
    return [t, wrappedSet]
  })()

  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [keywords, setKeywords] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [gridScans, setGridScans] = useState([])
  const [stats, setStats] = useState({})
  const [balance, setBalance] = useState(null)

  // Modals / inputs
  const [scanning, setScanning] = useState(false)
  const [scanKeywords, setScanKeywords] = useState('')
  const [gridKeyword, setGridKeyword] = useState('')
  const [gridBusiness, setGridBusiness] = useState('')
  const [gridLat, setGridLat] = useState('')
  const [gridLng, setGridLng] = useState('')
  const [showAddKeywords, setShowAddKeywords] = useState(false)
  const [newKeywords, setNewKeywords] = useState('')

  const selectedClient = clients.find(c => c.id === selectedClientId)

  useEffect(() => { loadClients() }, [])
  useEffect(() => { if (selectedClientId) loadClientData() }, [selectedClientId])

  async function loadClients() {
    setLoading(true)
    const res = await apiGet('get_clients', { agency_id: agencyId })
    setClients(res.data || [])
    setLoading(false)
  }

  async function loadClientData() {
    const [kwRes, snapRes, gridRes, statsRes] = await Promise.all([
      apiGet('get_keywords', { client_id: selectedClientId }),
      apiGet('get_snapshots', { client_id: selectedClientId }),
      apiGet('get_grid_scans', { client_id: selectedClientId }),
      apiGet('get_stats', { client_id: selectedClientId }),
    ])
    setKeywords(kwRes.data || [])
    setSnapshots(snapRes.data || [])
    setGridScans(gridRes.data || [])
    setStats(statsRes)
  }

  async function runSERPScan() {
    if (!scanKeywords.trim() || !selectedClient?.website) { toast.error('Enter keywords and select a client with a website'); return }
    setScanning(true)
    const kws = scanKeywords.split('\n').map(k => k.trim()).filter(Boolean)
    const domain = selectedClient.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    const res = await apiPost({ action: 'bulk_serp_scan', agency_id: agencyId, client_id: selectedClientId, keywords: kws, domain })
    if (res.success) {
      toast.success(`Scanned ${res.scanned} keywords`)
      loadClientData()
    } else {
      toast.error(res.error || 'Scan failed')
    }
    setScanning(false)
    setScanKeywords('')
  }

  async function runGridScan() {
    if (!gridKeyword || !gridBusiness || !gridLat || !gridLng) { toast.error('All grid fields required'); return }
    setScanning(true)
    const res = await apiPost({
      action: 'gmb_grid_scan', agency_id: agencyId, client_id: selectedClientId,
      keyword: gridKeyword, business_name: gridBusiness,
      lat: parseFloat(gridLat), lng: parseFloat(gridLng),
    })
    if (res.success) {
      toast.success(`Grid scan complete — ${res.result.coverage_pct}% coverage`)
      loadClientData()
    } else {
      toast.error(res.error || 'Grid scan failed')
    }
    setScanning(false)
  }

  async function addKeywords() {
    const kws = newKeywords.split('\n').map(k => k.trim()).filter(Boolean)
    if (!kws.length) return
    await apiPost({ action: 'add_keywords', agency_id: agencyId, client_id: selectedClientId, keywords: kws })
    toast.success(`Added ${kws.length} keywords`)
    setShowAddKeywords(false)
    setNewKeywords('')
    loadClientData()
  }

  const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: Activity },
    { key: 'keywords', label: `Keywords${keywords.length ? ` (${keywords.length})` : ''}`, icon: Search },
    { key: 'serp', label: 'SERP Features', icon: Eye },
    { key: 'grid', label: 'GMB Grid', icon: MapPin },
    { key: 'ranks', label: 'Rank Tracker', icon: TrendingUp },
  ]

  // ── No client selected — show selector ──
  if (!selectedClientId) {
    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: W, fontFamily: FB }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: BLK, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Brain size={24} color={W} />
          </div>
          <h1 style={{ fontFamily: FH, fontSize: 32, fontWeight: 800, color: BLK, margin: '0 0 8px', letterSpacing: '-.03em' }}>KotoIQ</h1>
          <p style={{ fontSize: 16, color: '#6b7280', fontFamily: FB, marginBottom: 36, textAlign: 'center', maxWidth: 500 }}>
            AI-powered search intelligence — SERP features, AI Overview detection, GMB grid tracking, and rank monitoring.
          </p>

          <div style={{ width: '100%', maxWidth: 600 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Select a client to get started</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={24} color={BLK} style={{ animation: 'spin 1s linear infinite' }} /></div>
              ) : clients.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No clients found — add clients first</div>
              ) : clients.filter(c => c.status !== 'deleted').map(client => (
                <button key={client.id} onClick={() => setSelectedClientId(client.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderRadius: 14,
                  border: '1px solid #e5e7eb', background: W, cursor: 'pointer', textAlign: 'left',
                  transition: 'all .15s', width: '100%',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = BLK; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}>
                  {client.logo_url ? (
                    <img src={client.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain', border: '1px solid #f3f4f6' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 16, fontWeight: 800, color: T }}>
                      {(client.name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FH, color: BLK }}>{client.name}</div>
                    <div style={{ fontSize: 13, color: client.website ? T : '#9ca3af', fontFamily: FB, marginTop: 2 }}>
                      {client.website || 'No website set'}
                    </div>
                  </div>
                  {client.website && <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: GRN + '12', color: GRN }}>Ready</span>}
                  {!client.website && <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: '#f3f4f6', color: '#9ca3af' }}>Needs URL</span>}
                  <ChevronRight size={18} color="#d1d5db" />
                </button>
              ))}
            </div>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  // ── Client selected — main view ──
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: W, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ background: W, borderBottom: '1px solid #e5e7eb', padding: '24px 40px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: BLK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={20} color={W} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 800, color: BLK, margin: 0 }}>KotoIQ</h1>
                  <span style={{ fontSize: 13, color: '#6b7280', fontFamily: FB }}>·</span>
                  <button onClick={() => setSelectedClientId(null)} style={{
                    fontSize: 14, fontWeight: 700, fontFamily: FH, color: T, background: 'none', border: 'none', cursor: 'pointer',
                  }}>{selectedClient?.name}</button>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, marginTop: 2 }}>
                  {selectedClient?.website || 'No website'} · {keywords.length} keywords tracked
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSelectedClientId(null)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: W,
                fontSize: 13, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#6b7280',
              }}>Switch Client</button>
              <button onClick={() => setShowAddKeywords(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
                border: 'none', background: BLK, color: W, fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
              }}>
                <Plus size={14} /> Add Keywords
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Keywords', value: stats.keywords || 0, accent: T, icon: Search },
              { label: 'SERP Scans', value: stats.snapshots || 0, accent: R, icon: Eye },
              { label: 'Grid Scans', value: stats.grid_scans || 0, accent: AMB, icon: MapPin },
              { label: 'Avg Position', value: keywords.length > 0 ? Math.round(keywords.filter(k => k.position).reduce((s, k) => s + k.position, 0) / Math.max(keywords.filter(k => k.position).length, 1)) : '—', accent: GRN, icon: TrendingUp },
              { label: 'AI Overview', value: keywords.filter(k => k.ai_overview).length, accent: '#7c3aed', icon: Brain },
            ].map(s => (
              <div key={s.label} style={{ padding: '12px 16px', background: W, borderRadius: 10, border: '1px solid #e5e7eb', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.accent, opacity: 0.6 }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, fontFamily: FH, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                  </div>
                  <s.icon size={14} color={s.accent} />
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontSize: 13,
                fontWeight: tab === t.key ? 700 : 500, fontFamily: FH,
                border: 'none', borderBottom: tab === t.key ? `2px solid ${BLK}` : '2px solid transparent',
                background: 'none', cursor: 'pointer', color: tab === t.key ? BLK : '#9ca3af',
              }}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px 48px' }}>

          {/* ══ DASHBOARD ════════════════════════════════════════ */}
          {tab === 'dashboard' && (
            <div>
              {/* Quick scan */}
              <div style={{ ...cardInner, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <Zap size={16} color={T} />
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: BLK }}>Quick SERP Scan</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <textarea value={scanKeywords} onChange={e => setScanKeywords(e.target.value)}
                    placeholder="Enter keywords (one per line)&#10;e.g. drug rehab fort lauderdale&#10;alcohol treatment center near me"
                    rows={3} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FB, resize: 'vertical', outline: 'none' }} />
                  <button onClick={runSERPScan} disabled={scanning} style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none', background: BLK, color: W,
                    fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer', alignSelf: 'flex-end',
                    opacity: scanning ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {scanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                    {scanning ? 'Scanning...' : 'Scan SERP'}
                  </button>
                </div>
              </div>

              {/* Top keywords table */}
              {keywords.length > 0 && (
                <div style={{ ...card }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Search size={16} color={T} />
                      <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK }}>Tracked Keywords</span>
                    </div>
                    <button onClick={() => setTab('keywords')} style={{ fontSize: 12, fontWeight: 700, color: T, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FH }}>
                      View all <ChevronRight size={12} />
                    </button>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Keyword', 'Position', 'AI Overview', 'Featured Snippet', 'Local Pack', 'PAA', 'Last Checked'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.slice(0, 15).map(kw => (
                        <tr key={kw.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{kw.keyword}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {kw.position ? (
                              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: posColor(kw.position) }}>{kw.position}</span>
                            ) : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {kw.ai_overview ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: '#7c3aed12', color: '#7c3aed' }}>AI Overview</span> : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {kw.featured_snippet ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: AMB + '12', color: AMB }}>Featured</span> : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {kw.local_pack ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FH, background: GRN + '12', color: GRN }}>Local Pack</span> : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280', fontFamily: FB }}>{kw.paa_count || 0}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af', fontFamily: FB }}>{kw.last_checked ? new Date(kw.last_checked).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {keywords.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Search size={28} color="#d1d5db" />
                  </div>
                  <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: '0 0 8px' }}>No Keywords Tracked Yet</h3>
                  <p style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, maxWidth: 440, margin: '0 auto' }}>
                    Enter keywords above and click "Scan SERP" to start tracking positions, AI Overviews, and SERP features.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══ KEYWORDS ═════════════════════════════════════════ */}
          {tab === 'keywords' && (
            <div>
              <div style={{ ...card }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK }}>{keywords.length} Keywords</span>
                  <button onClick={() => setShowAddKeywords(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
                    border: '1px solid #e5e7eb', background: W, fontSize: 12, fontWeight: 600, fontFamily: FH, cursor: 'pointer', color: BLK,
                  }}><Plus size={12} /> Add</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Keyword', 'Position', 'URL', 'AI Overview', 'Featured', 'Local Pack', 'PAA', 'Results', 'Last Checked'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map(kw => (
                      <tr key={kw.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{kw.keyword}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: posColor(kw.position) }}>{kw.position || '—'}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: T, fontFamily: FB, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.url || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{kw.ai_overview ? <Check size={14} color="#7c3aed" /> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                        <td style={{ padding: '10px 14px' }}>{kw.featured_snippet ? <Check size={14} color={AMB} /> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                        <td style={{ padding: '10px 14px' }}>{kw.local_pack ? <Check size={14} color={GRN} /> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280' }}>{kw.paa_count || 0}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>{kw.total_results ? kw.total_results.toLocaleString() : '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>{kw.last_checked ? new Date(kw.last_checked).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {keywords.length === 0 && <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No keywords — add some or run a SERP scan</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ SERP FEATURES ═════════════════════════════════════ */}
          {tab === 'serp' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Eye size={18} color="#7c3aed" />
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>SERP Feature Detection</span>
              </div>

              {/* Feature summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'AI Overview', count: keywords.filter(k => k.ai_overview).length, total: keywords.length, color: '#7c3aed', icon: Brain },
                  { label: 'Featured Snippet', count: keywords.filter(k => k.featured_snippet).length, total: keywords.length, color: AMB, icon: Star },
                  { label: 'Local Pack', count: keywords.filter(k => k.local_pack).length, total: keywords.length, color: GRN, icon: MapPin },
                  { label: 'People Also Ask', count: keywords.filter(k => (k.paa_count || 0) > 0).length, total: keywords.length, color: T, icon: Hash },
                ].map(f => (
                  <div key={f.label} style={{ ...cardInner }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <f.icon size={16} color={f.color} />
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: BLK }}>{f.label}</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FH, color: f.color }}>{f.count}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>of {f.total} keywords</div>
                    <div style={{ height: 4, borderRadius: 2, background: '#f3f4f6', marginTop: 10, overflow: 'hidden' }}>
                      <div style={{ width: f.total > 0 ? `${(f.count / f.total) * 100}%` : '0%', height: '100%', background: f.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Keywords with AI Overview */}
              {keywords.filter(k => k.ai_overview).length > 0 && (
                <div style={{ ...card, marginBottom: 20 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Brain size={16} color="#7c3aed" />
                    <span style={{ fontSize: 15, fontWeight: 800, fontFamily: FH, color: BLK }}>Keywords with AI Overview</span>
                  </div>
                  <div style={{ padding: '8px 20px' }}>
                    {keywords.filter(k => k.ai_overview).map(kw => (
                      <div key={kw.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{kw.keyword}</span>
                          {kw.serp_features?.ai_overview?.text && (
                            <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, marginTop: 4, maxWidth: 500 }}>
                              {kw.serp_features.ai_overview.text.slice(0, 150)}...
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: posColor(kw.position) }}>{kw.position || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ GMB GRID ══════════════════════════════════════════ */}
          {tab === 'grid' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <MapPin size={18} color={AMB} />
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>GMB Grid Tracker</span>
              </div>

              {/* Grid scan form */}
              <div style={{ ...cardInner, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: BLK, marginBottom: 12 }}>Run Grid Scan</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Keyword</label>
                    <input value={gridKeyword} onChange={e => setGridKeyword(e.target.value)} placeholder="e.g. drug rehab"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FB, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Business Name</label>
                    <input value={gridBusiness} onChange={e => setGridBusiness(e.target.value)} placeholder="e.g. Sunrise Recovery"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FB, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Center Latitude</label>
                    <input value={gridLat} onChange={e => setGridLat(e.target.value)} placeholder="26.1224"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FB, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Center Longitude</label>
                    <input value={gridLng} onChange={e => setGridLng(e.target.value)} placeholder="-80.1373"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FB, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <button onClick={runGridScan} disabled={scanning} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
                  border: 'none', background: BLK, color: W, fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                  opacity: scanning ? 0.5 : 1,
                }}>
                  {scanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={14} />}
                  {scanning ? 'Scanning grid...' : 'Run 5x5 Grid Scan'}
                </button>
              </div>

              {/* Grid scan results */}
              {gridScans.map(scan => (
                <div key={scan.id} style={{ ...cardInner, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FH, color: BLK }}>"{scan.keyword}" — {scan.business_name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB, marginTop: 2 }}>{new Date(scan.scanned_at).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: GRN }}>{scan.coverage_pct}%</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: FH }}>Coverage</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: T }}>{scan.avg_rank || '—'}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: FH }}>Avg Rank</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: posColor(scan.best_rank) }}>{scan.best_rank || '—'}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: FH }}>Best</div>
                      </div>
                    </div>
                  </div>

                  {/* Grid heatmap */}
                  {scan.grid_data?.cells && (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scan.grid_size || 5}, 1fr)`, gap: 3 }}>
                      {scan.grid_data.cells.map((cell, i) => {
                        const rank = cell.rank
                        const bg = rank === null ? '#f3f4f6' : rank <= 3 ? GRN : rank <= 10 ? T + '80' : rank <= 20 ? AMB + '60' : R + '40'
                        return (
                          <div key={i} style={{
                            aspectRatio: '1', borderRadius: 6, background: bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800, fontFamily: FH,
                            color: rank === null ? '#d1d5db' : rank <= 3 ? W : BLK,
                          }} title={`${cell.lat?.toFixed(3)}, ${cell.lng?.toFixed(3)} — Rank: ${rank || 'Not found'}`}>
                            {rank || '·'}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}

              {gridScans.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', fontSize: 14, color: '#9ca3af' }}>
                  No grid scans yet — enter a keyword and coordinates above to run your first scan.
                </div>
              )}
            </div>
          )}

          {/* ══ RANK TRACKER ══════════════════════════════════════ */}
          {tab === 'ranks' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TrendingUp size={18} color={GRN} />
                  <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: BLK }}>Rank Distribution</span>
                </div>
                <button onClick={async () => {
                  if (!selectedClient?.website || !keywords.length) { toast.error('Need website + keywords'); return }
                  setScanning(true)
                  const domain = selectedClient.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
                  const res = await apiPost({ action: 'rank_check', agency_id: agencyId, client_id: selectedClientId, domain, keywords: keywords.map(k => k.keyword) })
                  if (res.success) { toast.success('Rankings updated'); loadClientData() }
                  else toast.error(res.error || 'Failed')
                  setScanning(false)
                }} disabled={scanning} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
                  border: 'none', background: BLK, color: W, fontSize: 13, fontWeight: 700, fontFamily: FH, cursor: 'pointer',
                }}>
                  {scanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                  Check Rankings
                </button>
              </div>

              {/* Position distribution */}
              {keywords.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
                  {[
                    { label: 'Top 3', count: keywords.filter(k => k.position && k.position <= 3).length, color: GRN },
                    { label: '4-10', count: keywords.filter(k => k.position && k.position > 3 && k.position <= 10).length, color: T },
                    { label: '11-20', count: keywords.filter(k => k.position && k.position > 10 && k.position <= 20).length, color: AMB },
                    { label: '21+', count: keywords.filter(k => k.position && k.position > 20).length, color: R },
                    { label: 'Not Ranked', count: keywords.filter(k => !k.position).length, color: '#9ca3af' },
                  ].map(d => (
                    <div key={d.label} style={{ ...cardInner, textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FH, color: d.color }}>{d.count}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FH, marginTop: 4 }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Keywords sorted by position */}
              <div style={{ ...card }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['#', 'Keyword', 'Position', 'URL', 'Last Checked'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...keywords].sort((a, b) => (a.position || 999) - (b.position || 999)).map((kw, i) => (
                      <tr key={kw.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af', fontFamily: FH }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>{kw.keyword}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: posColor(kw.position) }}>{kw.position || '—'}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: T, fontFamily: FB, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.url || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>{kw.last_checked ? new Date(kw.last_checked).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Add Keywords Modal ──────────────────────────────── */}
        {showAddKeywords && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: W, borderRadius: 16, padding: 32, width: 500, maxWidth: '95vw' }}>
              <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: '0 0 16px' }}>Add Keywords</h3>
              <textarea value={newKeywords} onChange={e => setNewKeywords(e.target.value)}
                placeholder="Enter keywords (one per line)"
                rows={8} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: FB, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => setShowAddKeywords(false)} style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid #e5e7eb', background: W, fontSize: 14, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#6b7280' }}>Cancel</button>
                <button onClick={addKeywords} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: BLK, color: W, fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: 'pointer' }}>Add Keywords</button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
