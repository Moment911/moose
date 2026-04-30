"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Loader2, ArrowUp, ArrowDown, ArrowRight, Skull, Sparkles,
  FileText, Clock, AlertTriangle, CheckCircle, Filter, ChevronDown, ChevronUp,
  Zap, Eye, Image, Code, HelpCircle, Link2, TrendingDown, TrendingUp, BarChart2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const FRESHNESS_COLORS = { fresh: GRN, aging: AMB, stale: '#f97316', critical: R }
const FRESHNESS_LABELS = { fresh: 'Fresh', aging: 'Aging', stale: 'Stale', critical: 'Critical' }
const PRIORITY_COLORS = { urgent: R, soon: '#f97316', scheduled: AMB, ok: GRN }
const PRIORITY_LABELS = { urgent: 'Urgent', soon: 'Soon', scheduled: 'Scheduled', ok: 'OK' }

const TRAJECTORY_CONFIG = {
  improving: { icon: ArrowUp, color: GRN, label: 'Improving' },
  stable: { icon: ArrowRight, color: '#1f1f22', label: 'Stable' },
  declining: { icon: ArrowDown, color: R, label: 'Declining' },
  dead: { icon: Skull, color: '#991b1b', label: 'Dead' },
  new: { icon: Sparkles, color: T, label: 'New' },
}

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'urgent', label: 'Urgent', type: 'priority' },
  { key: 'declining', label: 'Declining', type: 'trajectory' },
  { key: 'stale', label: 'Stale', type: 'freshness' },
  { key: 'thin', label: 'Thin Content', type: 'thin' },
]

const SORT_OPTIONS = [
  { key: 'priority', label: 'Priority' },
  { key: 'days', label: 'Days Old' },
  { key: 'position', label: 'Position Change' },
  { key: 'traffic', label: 'Traffic' },
]

function truncateUrl(url, maxLen = 45) {
  try {
    const u = new URL(url)
    const path = u.pathname + u.search
    return path.length > maxLen ? path.substring(0, maxLen) + '...' : path
  } catch { return url?.substring(0, maxLen) || '' }
}

export default function ContentRefreshTab({ clientId, agencyId }) {
  const [inventory, setInventory] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [sortDir, setSortDir] = useState('asc')
  const [plans, setPlans] = useState([])
  const [planLoading, setPlanLoading] = useState(false)
  const [selectedUrls, setSelectedUrls] = useState(new Set())
  const [expandedPlan, setExpandedPlan] = useState(null)

  const api = useCallback(async (action, extra = {}) => {
    const res = await fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, client_id: clientId, agency_id: agencyId, ...extra }),
    })
    return res.json()
  }, [clientId, agencyId])

  const loadInventory = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await api('get_content_inventory')
      setInventory(res.inventory || [])
      setSummary(res.summary || null)
    } catch { /* skip */ }
    setLoading(false)
  }, [clientId, api])

  useEffect(() => { loadInventory() }, [loadInventory])

  const buildInventory = async () => {
    setBuilding(true)
    toast.loading('Building content inventory...', { id: 'build-inv' })
    try {
      const res = await api('build_content_inventory')
      if (res.error) { toast.error(res.error, { id: 'build-inv' }); setBuilding(false); return }
      toast.success(`Inventory built: ${res.total_pages} pages scanned`, { id: 'build-inv' })
      // Use inventory returned directly from build if available, then refresh from DB
      if (res.inventory?.length) {
        setInventory(res.inventory)
        setSummary(res.summary || null)
      }
      await loadInventory()
    } catch { toast.error('Failed to build inventory', { id: 'build-inv' }) }
    setBuilding(false)
  }

  const generatePlan = async () => {
    setPlanLoading(true)
    toast.loading('Generating refresh plan...', { id: 'plan' })
    try {
      const urls = selectedUrls.size > 0 ? [...selectedUrls] : undefined
      const res = await api('get_refresh_plan', { urls, top_n: 10 })
      if (res.error) { toast.error(res.error, { id: 'plan' }); setPlanLoading(false); return }
      setPlans(res.plans || [])
      toast.success(`Plan generated for ${(res.plans || []).length} pages`, { id: 'plan' })
    } catch { toast.error('Failed to generate plan', { id: 'plan' }) }
    setPlanLoading(false)
  }

  // Filter + sort
  const filtered = inventory.filter(item => {
    if (!filter) return true
    if (filter === 'urgent') return item.refresh_priority === 'urgent'
    if (filter === 'declining') return item.trajectory === 'declining'
    if (filter === 'stale') return item.freshness_status === 'stale' || item.freshness_status === 'critical'
    if (filter === 'thin') return item.thin_content
    return true
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortBy === 'priority') {
      const order = { urgent: 0, soon: 1, scheduled: 2, ok: 3 }
      return (order[a.refresh_priority] - order[b.refresh_priority]) * dir
    }
    if (sortBy === 'days') return ((a.days_since_update || 0) - (b.days_since_update || 0)) * dir * -1
    if (sortBy === 'position') {
      const aChange = (a.position_30d_ago || a.sc_position || 0) - (a.sc_position || 0)
      const bChange = (b.position_30d_ago || b.sc_position || 0) - (b.sc_position || 0)
      return (bChange - aChange) * dir
    }
    if (sortBy === 'traffic') return ((b.sc_clicks || 0) - (a.sc_clicks || 0)) * dir
    return 0
  })

  const toggleUrl = (url) => {
    setSelectedUrls(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url); else next.add(url)
      return next
    })
  }

  const s = summary || {}
  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }
  const titleStyle = { fontSize: 15, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }

  // ── Freshness distribution bar widths ──
  const total = s.total || 0
  const freshPct = total ? (s.fresh / total) * 100 : 0
  const agingPct = total ? (s.aging / total) * 100 : 0
  const stalePct = total ? (s.stale / total) * 100 : 0
  const critPct = total ? (s.critical / total) * 100 : 0

  return (
    <div>
      <HowItWorks tool="content_refresh" />
      {/* Summary header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 900, color: BLK }}>Content Refresh Engine</div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginTop: 4 }}>Monitor content freshness, identify declining pages, plan updates</div>
        </div>
        <button onClick={buildInventory} disabled={building}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: building ? 'wait' : 'pointer', opacity: building ? 0.6 : 1 }}>
          {building ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
          {building ? 'Scanning...' : 'Build Inventory'}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#1f2937' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 600 }}>Loading inventory...</div>
        </div>
      )}

      {!loading && !inventory.length && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <FileText size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>No Content Inventory Yet</div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 16 }}>Click "Build Inventory" to scan your sitemap and analyze content freshness.</div>
        </div>
      )}

      {!loading && inventory.length > 0 && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total Pages', value: s.total || 0, icon: FileText, color: T },
              { label: 'Fresh', value: s.fresh || 0, icon: CheckCircle, color: GRN },
              { label: 'Aging', value: s.aging || 0, icon: Clock, color: AMB },
              { label: 'Stale', value: s.stale || 0, icon: AlertTriangle, color: '#f97316' },
              { label: 'Critical', value: s.critical || 0, icon: AlertTriangle, color: R },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} color={color} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{label}</span>
                </div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: BLK }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Freshness distribution bar */}
          <div style={card}>
            <div style={titleStyle}><BarChart2 size={16} color="#0a0a0a" /> Freshness Distribution</div>
            <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', background: '#f1f1f6' }}>
              {freshPct > 0 && <div style={{ width: `${freshPct}%`, background: GRN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', minWidth: freshPct > 5 ? 'auto' : 0 }}>{freshPct > 8 ? `${Math.round(freshPct)}%` : ''}</div>}
              {agingPct > 0 && <div style={{ width: `${agingPct}%`, background: AMB, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', minWidth: agingPct > 5 ? 'auto' : 0 }}>{agingPct > 8 ? `${Math.round(agingPct)}%` : ''}</div>}
              {stalePct > 0 && <div style={{ width: `${stalePct}%`, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', minWidth: stalePct > 5 ? 'auto' : 0 }}>{stalePct > 8 ? `${Math.round(stalePct)}%` : ''}</div>}
              {critPct > 0 && <div style={{ width: `${critPct}%`, background: "#0a0a0a", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', minWidth: critPct > 5 ? 'auto' : 0 }}>{critPct > 8 ? `${Math.round(critPct)}%` : ''}</div>}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {[['Fresh', GRN], ['Aging', AMB], ['Stale', '#f97316'], ['Critical', R]].map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#1f1f22' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} /> {l}
                </div>
              ))}
            </div>
          </div>

          {/* Filter + sort bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(filter === f.key ? '' : f.key)}
                  style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${filter === f.key ? R : '#ececef'}`, background: filter === f.key ? '#f1f1f6' : '#fff', color: filter === f.key ? R : '#6b6b70' }}>
                  {f.label} {f.key && <span style={{ opacity: 0.7 }}>({f.key === 'urgent' ? s.urgent : f.key === 'declining' ? s.declining : f.key === 'stale' ? (s.stale || 0) + (s.critical || 0) : f.key === 'thin' ? s.thin : ''})</span>}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#1f2937', fontWeight: 600 }}>Sort:</span>
              {SORT_OPTIONS.map(o => (
                <button key={o.key} onClick={() => { if (sortBy === o.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(o.key); setSortDir('asc') } }}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${sortBy === o.key ? T : '#ececef'}`, background: sortBy === o.key ? T + '10' : '#fff', color: sortBy === o.key ? T : '#6b6b70', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {o.label} {sortBy === o.key && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                </button>
              ))}
            </div>
          </div>

          {/* Priority table */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
              <thead>
                <tr style={{ background: '#f9f9fb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 12, color: '#1f1f22', textTransform: 'uppercase', letterSpacing: '.05em', width: 30 }}>
                    <input type="checkbox" onChange={e => { if (e.target.checked) setSelectedUrls(new Set(filtered.map(r => r.url))); else setSelectedUrls(new Set()) }} checked={selectedUrls.size === filtered.length && filtered.length > 0} />
                  </th>
                  {['URL', 'Title', 'Words', 'Pos', 'Trajectory', 'Days Old', 'Freshness', 'Priority'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, fontSize: 12, color: '#1f1f22', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((item, i) => {
                  const traj = TRAJECTORY_CONFIG[item.trajectory] || TRAJECTORY_CONFIG.stable
                  const TrajIcon = traj.icon
                  const fColor = FRESHNESS_COLORS[item.freshness_status] || '#6b6b70'
                  const pColor = PRIORITY_COLORS[item.refresh_priority] || '#6b6b70'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: selectedUrls.has(item.url) ? '#f9f9fb' : 'transparent' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="checkbox" checked={selectedUrls.has(item.url)} onChange={() => toggleUrl(item.url)} />
                      </td>
                      <td style={{ padding: '8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: T, textDecoration: 'none', fontSize: 11 }} title={item.url}>
                          {truncateUrl(item.url)}
                        </a>
                      </td>
                      <td style={{ padding: '8px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{item.title || '(no title)'}</td>
                      <td style={{ padding: '8px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, color: item.thin_content ? R : BLK }}>{item.word_count || 0}</td>
                      <td style={{ padding: '8px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700 }}>{item.sc_position ? Math.round(item.sc_position) : '--'}</td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: traj.color, fontWeight: 700, fontSize: 11 }}>
                          <TrajIcon size={13} /> {traj.label}
                        </div>
                      </td>
                      <td style={{ padding: '8px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontWeight: 700, color: '#1f1f22' }}>{item.days_since_update != null ? `${item.days_since_update}d` : '--'}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: fColor + '15', color: fColor, textTransform: 'uppercase' }}>
                          {FRESHNESS_LABELS[item.freshness_status] || item.freshness_status}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: pColor + '15', color: pColor, textTransform: 'uppercase' }}>
                          {PRIORITY_LABELS[item.refresh_priority] || item.refresh_priority}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#1f2937', fontSize: 13 }}>No pages match the current filter.</div>
            )}
          </div>

          {/* Refresh Plan section */}
          <div style={{ ...card, marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={titleStyle}><Zap size={16} color="#0a0a0a" /> Refresh Plan</div>
              <button onClick={generatePlan} disabled={planLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: planLoading ? 'wait' : 'pointer', opacity: planLoading ? 0.6 : 1 }}>
                {planLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                {planLoading ? 'Generating...' : `Generate Plan${selectedUrls.size > 0 ? ` (${selectedUrls.size} selected)` : ''}`}
              </button>
            </div>

            {plans.length === 0 && !planLoading && (
              <div style={{ padding: 24, textAlign: 'center', color: '#1f2937', fontSize: 13 }}>
                Select pages above and click "Generate Plan" to get AI-powered refresh recommendations.
              </div>
            )}

            {plans.map((plan, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                <div onClick={() => setExpandedPlan(expandedPlan === i ? null : i)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: '#f9f9fb' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.title || truncateUrl(plan.url)}</div>
                    <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 2 }}>{truncateUrl(plan.url, 60)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {plan.priority && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: (PRIORITY_COLORS[plan.priority] || '#6b6b70') + '15', color: PRIORITY_COLORS[plan.priority] || '#6b6b70', textTransform: 'uppercase' }}>{plan.priority}</span>}
                    {plan.estimated_hours && <span style={{ fontSize: 11, color: '#1f1f22', fontWeight: 600 }}>{plan.estimated_hours}h est.</span>}
                    {expandedPlan === i ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}
                  </div>
                </div>
                {expandedPlan === i && (
                  <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
                    {plan.sections_to_update?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Sections to Update</div>
                        {plan.sections_to_update.map((sec, j) => (
                          <div key={j} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12, color: BLK }}>
                            <span style={{ fontWeight: 700, minWidth: 80, color: T }}>{sec.action}</span>
                            <span style={{ fontWeight: 600 }}>{sec.section}:</span>
                            <span style={{ color: '#1f1f22' }}>{sec.details}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {plan.content_to_add?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: GRN, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Content to Add</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#1f1f22', lineHeight: 1.8 }}>
                          {plan.content_to_add.map((item, j) => <li key={j}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                    {plan.content_to_remove?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: R, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Content to Remove</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#1f1f22', lineHeight: 1.8 }}>
                          {plan.content_to_remove.map((item, j) => <li key={j}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                    {plan.seo_improvements?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: AMB, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>SEO Improvements</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#1f1f22', lineHeight: 1.8 }}>
                          {plan.seo_improvements.map((item, j) => <li key={j}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                    {plan.expected_impact && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: GRN + '10', border: `1px solid ${GRN}20`, fontSize: 12, color: '#166534', marginTop: 8 }}>
                        <strong>Expected Impact:</strong> {plan.expected_impact}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
