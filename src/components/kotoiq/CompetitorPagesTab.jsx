"use client"
import { useState, useEffect, useMemo } from 'react'
import {
  Globe, Loader2, Zap, Plus, X, RefreshCw, Trash2, ExternalLink,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff,
  ThumbsUp, ThumbsDown, FileText, DollarSign, Sparkles, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import HowItWorks from './HowItWorks'

// ─────────────────────────────────────────────────────────────
// Koto Design tokens (DESIGN.md, 2026-05-13)
// ─────────────────────────────────────────────────────────────
const DISPLAY = "'Bebas Neue', 'Arial Narrow', sans-serif"
const BODY    = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

const INK     = '#201b51'
const DIM     = '#4a4674'
const MID     = '#6b6789'
const HAIR    = '#e8e6ef'
const SUBHAIR = '#F0ECE8'
const SOFT    = '#f5f3ee'

const PINK       = '#cb1c6b'
const PINK_LIGHT = 'rgba(203, 28, 107, 0.07)'
const TEAL       = '#00C2CB'
const SUCCESS    = '#16A34A'
const WARNING    = '#D97706'
const DANGER     = '#DC2626'
const INFO       = '#2563EB'

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)'

const PAGE_TYPE_LABEL = {
  home: 'Home',
  pricing: 'Pricing',
  features: 'Features',
  blog_post: 'Blog',
  landing: 'Landing',
  about: 'About',
  other: 'Other',
}
const PAGE_TYPE_COLOR = {
  home: INK,
  pricing: PINK,
  features: INFO,
  blog_post: DIM,
  landing: TEAL,
  about: MID,
  other: MID,
}
const PAGE_TYPE_ICON = {
  home: Globe,
  pricing: DollarSign,
  features: Sparkles,
  blog_post: FileText,
  landing: ExternalLink,
  about: FileText,
  other: FileText,
}

const SEVERITY_COLOR = { high: DANGER, medium: WARNING, low: MID, null: MID }
const SEVERITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }

// ─────────────────────────────────────────────────────────────
// Style primitives
// ─────────────────────────────────────────────────────────────
const card = {
  background: '#fff', borderRadius: 12, border: `1px solid ${HAIR}`,
  padding: '20px 22px', marginBottom: 14, fontFamily: BODY, boxShadow: CARD_SHADOW,
}
const labelStyle = {
  fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase',
  letterSpacing: '.06em', fontFamily: BODY, marginBottom: 6,
}
const sectionTitle = {
  fontFamily: BODY, fontSize: 16, fontWeight: 600, color: INK,
  marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
}
const inkButton = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
  background: PINK, color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, fontFamily: BODY, cursor: 'pointer',
  transition: 'background 200ms ease-out',
}
const ghostButton = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px',
  background: '#fff', color: INK, border: `1px solid ${HAIR}`, borderRadius: 8,
  fontSize: 13, fontWeight: 500, fontFamily: BODY, cursor: 'pointer',
  transition: 'background 200ms ease-out',
}
const subtleInput = {
  width: '100%', padding: '10px 12px', border: `1px solid ${HAIR}`,
  borderRadius: 8, fontSize: 14, fontFamily: BODY, color: INK, outline: 'none',
  boxSizing: 'border-box',
}

async function api(action, body) {
  const res = await fetch('/api/kotoiq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  return res.json()
}
function relative(ts) {
  if (!ts) return 'never'
  const ms = Date.now() - new Date(ts).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function CompetitorPagesTab({ clientId, agencyId }) {
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [discovering, setDiscovering] = useState(false)

  const [pages, setPages] = useState([])
  const [changes, setChanges] = useState([])
  const [noiseChanges, setNoiseChanges] = useState([])
  const [showNoise, setShowNoise] = useState(false)

  const [addUrl, setAddUrl] = useState('')
  const [addPageType, setAddPageType] = useState('')
  const [addDomain, setAddDomain] = useState('')

  const [showAddPage, setShowAddPage] = useState(false)
  const [showAddDomain, setShowAddDomain] = useState(false)

  const refresh = async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [p, m, n] = await Promise.all([
        api('list_tracked_pages', { client_id: clientId }),
        api('get_page_changes', { client_id: clientId, classification: 'meaningful', days: 30, limit: 50 }),
        api('get_page_changes', { client_id: clientId, classification: 'all', days: 7, limit: 100 }),
      ])
      setPages(p?.pages || [])
      setChanges(m?.changes || [])
      // noise = anything in n that isn't 'meaningful'
      setNoiseChanges((n?.changes || []).filter(c => c.classification !== 'meaningful'))
    } catch (e) {
      console.warn('[pages] refresh', e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [clientId])

  // ── Actions
  const runScan = async () => {
    setScanning(true)
    try {
      const r = await api('run_page_diff_now', { client_id: clientId, agency_id: agencyId })
      if (r.error) throw new Error(r.error)
      toast.success(`${r.pages_scanned} pages scanned, ${r.meaningful_changes} meaningful changes`)
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const addPage = async () => {
    if (!addUrl.trim()) return
    const r = await api('track_page', { client_id: clientId, url: addUrl.trim(), page_type: addPageType || undefined })
    if (r.error) return toast.error(r.error)
    setAddUrl(''); setAddPageType(''); setShowAddPage(false)
    toast.success('Page tracked')
    refresh()
  }

  const discoverFromDomain = async () => {
    if (!addDomain.trim()) return
    setDiscovering(true)
    try {
      const r = await api('discover_pages', { client_id: clientId, domain: addDomain.trim(), auto_track: true })
      if (r.error) throw new Error(r.error)
      toast.success(`Found ${r.pages?.length || 0} pages, tracking ${r.tracked || 0}`)
      setAddDomain(''); setShowAddDomain(false)
      refresh()
    } catch (e) {
      toast.error(e.message || 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  const untrack = async (id) => {
    if (!confirm('Stop tracking this page?')) return
    await api('untrack_page', { id })
    toast.success('Stopped tracking')
    refresh()
  }

  const reclassify = async (id, label) => {
    await api('reclassify_change', { id, user_reclassification: label })
    toast.success(`Marked as ${label}`)
    refresh()
  }

  // ── Empty state
  if (!loading && pages.length === 0) {
    return (
      <div>
        <HowItWorks tool="competitor_pages" />
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: PINK_LIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Globe size={26} color={PINK} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>
            Watch what competitors change
          </div>
          <div style={{ fontFamily: BODY, fontSize: 14, color: DIM, maxWidth: 540, margin: '0 auto 24px', lineHeight: 1.55 }}>
            Paste a competitor domain and we'll auto-discover their home, pricing, features, about, and a recent blog post — then snapshot all five daily and alert you only on real changes (Claude filters out A/B tests, widget noise, and timestamps).
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowAddDomain(true)} style={{ ...inkButton, padding: '12px 22px', fontSize: 14 }}>
              <Sparkles size={16} /> Auto-discover from competitor domain
            </button>
            <button onClick={() => setShowAddPage(true)} style={{ ...ghostButton, padding: '12px 22px', fontSize: 14 }}>
              <Plus size={16} /> Add a single page
            </button>
          </div>
          {showAddDomain && (
            <AddDomainInline value={addDomain} onChange={setAddDomain} onSubmit={discoverFromDomain} onCancel={() => setShowAddDomain(false)} busy={discovering} />
          )}
          {showAddPage && (
            <AddPageInline url={addUrl} setUrl={setAddUrl} pageType={addPageType} setPageType={setAddPageType} onSubmit={addPage} onCancel={() => setShowAddPage(false)} />
          )}
        </div>
      </div>
    )
  }

  // ── Stats for top row
  const pagesTracked = pages.length
  const meaningful7d = useMemo(() => changes.filter(c => Date.now() - new Date(c.detected_at).getTime() < 7 * 86400000).length, [changes])
  const lastScanTs = useMemo(() => {
    const ts = pages.map(p => p.last_checked_at).filter(Boolean).sort().pop()
    return ts || null
  }, [pages])
  const competitorCount = new Set(pages.map(p => p.competitor_domain)).size

  return (
    <div>
      <HowItWorks tool="competitor_pages" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 400, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Competitor Pages</div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: DIM, marginTop: 4 }}>
            Daily snapshots of competitor pages, with a Claude noise filter so you only see meaningful changes.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: BODY, fontSize: 12, color: MID }}>Last scan {relative(lastScanTs)}</span>
          <button onClick={refresh} style={ghostButton} title="Refresh"><RefreshCw size={14} /></button>
          <button onClick={() => setShowAddDomain(s => !s)} style={ghostButton}><Sparkles size={14} /> Auto-discover</button>
          <button onClick={() => setShowAddPage(s => !s)} style={ghostButton}><Plus size={14} /> Add page</button>
          <button onClick={runScan} disabled={scanning} style={{ ...inkButton, opacity: scanning ? 0.6 : 1 }}>
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {scanning ? 'Scanning...' : 'Run scan now'}
          </button>
        </div>
      </div>

      {/* Add forms inline */}
      {showAddDomain && (
        <div style={card}>
          <AddDomainInline value={addDomain} onChange={setAddDomain} onSubmit={discoverFromDomain} onCancel={() => setShowAddDomain(false)} busy={discovering} compact />
        </div>
      )}
      {showAddPage && (
        <div style={card}>
          <AddPageInline url={addUrl} setUrl={setAddUrl} pageType={addPageType} setPageType={setAddPageType} onSubmit={addPage} onCancel={() => setShowAddPage(false)} compact />
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Kpi label="Pages Tracked" value={pagesTracked} sub={`${competitorCount} competitors`} />
        <Kpi label="Meaningful (7d)" value={meaningful7d} sub="real changes worth knowing" valueColor={meaningful7d > 0 ? PINK : INK} />
        <Kpi label="Noise filtered (7d)" value={noiseChanges.length} sub="A/B tests, widgets, typos" />
        <Kpi label="Last scan" value={lastScanTs ? relative(lastScanTs) : '—'} sub="auto-scans daily" />
      </div>

      {/* Meaningful changes timeline */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={sectionTitle}><AlertCircle size={16} color={INK} /> Meaningful changes (30d)</div>
          <span style={{ fontFamily: BODY, fontSize: 12, color: MID }}>{changes.length} total</span>
        </div>
        {changes.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: MID, fontSize: 13, fontFamily: BODY }}>
            No meaningful changes yet. Run a scan or wait for tomorrow's cron.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {changes.map(c => (
              <ChangeRow key={c.id} change={c} onUseful={() => reclassify(c.id, 'meaningful')} onNoise={() => reclassify(c.id, 'noise')} />
            ))}
          </div>
        )}
      </div>

      {/* Tracked pages table */}
      <div style={card}>
        <div style={sectionTitle}><Globe size={16} color={INK} /> Tracked pages ({pagesTracked})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: BODY, minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                <th style={thLeft}>Competitor</th>
                <th style={thLeft}>Page</th>
                <th style={thLeft}>Type</th>
                <th style={thLeft}>Last check</th>
                <th style={thLeft}>Last meaningful change</th>
                <th style={thRight}></th>
              </tr>
            </thead>
            <tbody>
              {pages.map(p => {
                const Icon = PAGE_TYPE_ICON[p.page_type] || FileText
                const tColor = PAGE_TYPE_COLOR[p.page_type] || MID
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${SUBHAIR}` }}>
                    <td style={{ padding: '12px 6px', fontWeight: 600, color: INK, fontFamily: BODY }}>{p.competitor_domain}</td>
                    <td style={{ padding: '12px 6px', maxWidth: 360 }}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: DIM, fontFamily: BODY, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }} title={p.url}>
                        {tryPathname(p.url)} <ExternalLink size={11} color={MID} />
                      </a>
                    </td>
                    <td style={{ padding: '12px 6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: tColor, fontWeight: 600, fontSize: 12, fontFamily: BODY }}>
                        <Icon size={12} /> {PAGE_TYPE_LABEL[p.page_type] || p.page_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 6px', color: MID, fontFamily: BODY, fontSize: 12 }}>{relative(p.last_checked_at)}</td>
                    <td style={{ padding: '12px 6px', fontFamily: BODY, fontSize: 13 }}>
                      {p.latest_change ? (
                        <span>
                          <SeverityDot severity={p.latest_change.severity} />
                          <span style={{ color: INK, marginLeft: 6 }}>{p.latest_change.diff_summary?.slice(0, 80) || 'Change detected'}</span>
                          <span style={{ color: MID, marginLeft: 6, fontSize: 12 }}>· {relative(p.latest_change.detected_at)}</span>
                        </span>
                      ) : (
                        <span style={{ color: MID }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 6px', textAlign: 'right' }}>
                      {p.fetch_blocked_until && new Date(p.fetch_blocked_until) > new Date() && (
                        <span title="Fetch blocked; will retry">{<EyeOff size={14} color={MID} />}</span>
                      )}
                      <button onClick={() => untrack(p.id)} style={iconBtn} title="Stop tracking">
                        <Trash2 size={14} color={DANGER} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Noise — collapsible */}
      <div style={card}>
        <button onClick={() => setShowNoise(s => !s)} style={collapseHeader}>
          <div style={sectionTitle}>
            <EyeOff size={16} color={MID} /> Filtered as noise (last 7d) — {noiseChanges.length}
          </div>
          {showNoise ? <ChevronUp size={16} color={MID} /> : <ChevronDown size={16} color={MID} />}
        </button>
        {showNoise && (
          <div style={{ marginTop: 4 }}>
            {noiseChanges.length === 0 ? (
              <div style={{ padding: 18, color: MID, fontSize: 13, fontFamily: BODY }}>Nothing filtered yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {noiseChanges.map(c => (
                  <NoiseRow key={c.id} change={c} onMarkUseful={() => reclassify(c.id, 'meaningful')} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, valueColor = INK }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 170, marginBottom: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 400, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontFamily: BODY, fontSize: 12, color: MID, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function ChangeRow({ change, onUseful, onNoise }) {
  const sev = change.severity || 'medium'
  const sevColor = SEVERITY_COLOR[sev] || MID
  const page = change.kotoiq_tracked_pages || {}
  const reclassified = change.user_reclassification
  return (
    <div style={{ padding: '14px 16px', background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 10, fontFamily: BODY }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ ...sevPill(sevColor) }}>{SEVERITY_LABEL[sev] || sev}</span>
            <span style={{ fontWeight: 600, color: INK, fontSize: 14 }}>{page.competitor_domain}</span>
            <span style={{ color: MID, fontSize: 12 }}>· {PAGE_TYPE_LABEL[page.page_type] || page.page_type || 'page'}</span>
            <span style={{ color: MID, fontSize: 12 }}>· {relative(change.detected_at)}</span>
          </div>
          <div style={{ color: INK, fontSize: 14, lineHeight: 1.5, marginBottom: 6 }}>
            {change.diff_summary || 'Change detected'}
          </div>
          {change.classifier_reason && (
            <div style={{ color: MID, fontSize: 12, fontStyle: 'italic' }}>{change.classifier_reason}</div>
          )}
          {page.url && (
            <a href={page.url} target="_blank" rel="noopener noreferrer" style={{ color: PINK, fontSize: 12, fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              Open page <ExternalLink size={11} />
            </a>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={onUseful} style={iconBtn} title="Confirm useful">
            <ThumbsUp size={14} color={reclassified === 'meaningful' ? SUCCESS : MID} />
          </button>
          <button onClick={onNoise} style={iconBtn} title="Mark as noise">
            <ThumbsDown size={14} color={reclassified === 'noise' ? DANGER : MID} />
          </button>
        </div>
      </div>
    </div>
  )
}

function NoiseRow({ change, onMarkUseful }) {
  const page = change.kotoiq_tracked_pages || {}
  return (
    <div style={{ padding: '10px 14px', background: SOFT, border: `1px solid ${SUBHAIR}`, borderRadius: 8, fontFamily: BODY, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {change.classification?.replace('_', ' ')}
      </span>
      <span style={{ color: DIM, fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {page.competitor_domain} · {change.diff_summary || 'change'}
      </span>
      <span style={{ color: MID, fontSize: 12 }}>{relative(change.detected_at)}</span>
      <button onClick={onMarkUseful} style={iconBtn} title="Actually useful">
        <ThumbsUp size={13} color={MID} />
      </button>
    </div>
  )
}

function AddDomainInline({ value, onChange, onSubmit, onCancel, busy, compact }) {
  return (
    <div style={{ marginTop: compact ? 0 : 24, padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : 'center' }}>
      <input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="competitor.com"
        style={{ ...subtleInput, maxWidth: 320 }}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
      />
      <button onClick={onSubmit} disabled={busy || !value.trim()} style={{ ...inkButton, opacity: busy ? 0.6 : 1 }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {busy ? 'Discovering...' : 'Discover + track top 5'}
      </button>
      <button onClick={onCancel} style={ghostButton}><X size={14} /></button>
    </div>
  )
}

function AddPageInline({ url, setUrl, pageType, setPageType, onSubmit, onCancel, compact }) {
  return (
    <div style={{ marginTop: compact ? 0 : 18, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : 'center' }}>
      <input
        autoFocus
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://competitor.com/pricing"
        style={{ ...subtleInput, maxWidth: 360 }}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
      />
      <select value={pageType} onChange={e => setPageType(e.target.value)} style={{ ...subtleInput, width: 170, flex: '0 0 auto' }}>
        <option value="">Auto-detect type</option>
        {Object.entries(PAGE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <button onClick={onSubmit} disabled={!url.trim()} style={inkButton}><Plus size={14} /> Track</button>
      <button onClick={onCancel} style={ghostButton}><X size={14} /></button>
    </div>
  )
}

function SeverityDot({ severity }) {
  const c = SEVERITY_COLOR[severity] || MID
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, verticalAlign: 'middle' }} />
}

const sevPill = (color) => ({
  display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999,
  background: color + '14', color, fontSize: 11, fontWeight: 700, fontFamily: BODY,
  letterSpacing: '.04em', textTransform: 'uppercase',
})

const thLeft  = { textAlign: 'left',  padding: '10px 6px', fontWeight: 600, color: MID, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: BODY }
const thRight = { textAlign: 'right', padding: '10px 6px', fontWeight: 600, color: MID, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: BODY }
const iconBtn = { background: 'none', border: 'none', color: MID, cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }
const collapseHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: BODY }

function tryPathname(url) {
  try { return new URL(url).pathname || '/' }
  catch { return url }
}
