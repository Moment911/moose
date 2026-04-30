"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Clock, RotateCcw, Eye, History, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, FH, FB } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 12 }

const REVERTIBLE_TABLES = new Set([
  'kotoiq_content_briefs',
  'kotoiq_topical_maps',
  'kotoiq_content_calendar',
  'kotoiq_schema_outputs',
  'kotoiq_on_page_audits',
  'kotoiq_aeo_scores',
  'kotoiq_competitor_maps',
  'kotoiq_hyperlocal_content',
  'kotoiq_strategic_plans',
])

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'briefs', label: 'Briefs', intents: ['generate_brief'] },
  { key: 'audits', label: 'Audits', intents: ['run_on_page_audit', 'audit_eeat', 'audit_schema', 'audit_technical_deep', 'gsc_audit', 'bing_audit'] },
  { key: 'topical_maps', label: 'Topical Maps', intents: ['build_topical_map', 'analyze_competitor'] },
  { key: 'reverted', label: 'Reverted' },
]

const INTENT_TAB = {
  generate_brief: 'briefs',
  build_topical_map: 'topical_map',
  run_on_page_audit: 'on_page',
  score_aeo: 'aeo',
  aeo_multi_engine: 'aeo_multi',
  check_plagiarism: 'plagiarism',
  analyze_competitor: 'competitor_map',
  audit_eeat: 'eeat',
  audit_schema: 'schema',
  audit_technical_deep: 'technical_deep',
  analyze_backlinks: 'backlinks',
  find_backlinks: 'backlink_opps',
  scan_internal_links: 'internal_links',
  analyze_semantic_network: 'semantic',
  build_content_calendar: 'calendar',
  content_refresh_plan: 'content_refresh',
  gsc_audit: 'gsc_audit',
  bing_audit: 'bing_audit',
  brand_serp_scan: 'brand_serp',
  generate_schema: 'schema',
  hyperlocal_content: 'hyperlocal',
  generate_strategic_plan: 'strategy',
  analyze_reviews: 'reviews',
  crawl_sitemap: 'sitemap_crawler',
}

function prettyIntent(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function timeAgo(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function fullStamp(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) }
  catch { return '' }
}

function dayHeader(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function StatusPill({ status }) {
  const s = status || 'success'
  const color = s === 'reverted' ? '#6b6b70' : s === 'failed' ? '#e9695c' : GRN
  const Icon = s === 'reverted' ? RotateCcw : s === 'failed' ? XCircle : CheckCircle2
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: color + '18', color, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
      <Icon size={10} /> {s}
    </span>
  )
}

function summarizeInputs(inputs) {
  if (!inputs || typeof inputs !== 'object') return null
  const entries = Object.entries(inputs).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!entries.length) return null
  return entries.slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`).join(' · ')
}

export default function ActivityTab({ clientId, agencyId, onSwitchTab }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [reverting, setReverting] = useState(null)

  const load = useCallback(async () => {
    if (!clientId || !agencyId) return
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_client_activity', client_id: clientId, agency_id: agencyId, limit: 100 }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setActivities(j.activities || [])
    } catch (e) {
      toast.error(e.message || 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [clientId, agencyId])

  useEffect(() => { load() }, [load])

  const onRevert = async (a) => {
    if (!confirm(`Revert "${prettyIntent(a.intent)}"? The generated artifact will be deleted. This cannot be undone.`)) return
    setReverting(a.id)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert_client_activity', activity_id: a.id, agency_id: agencyId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success('Reverted')
      load()
    } catch (e) {
      toast.error(e.message || 'Revert failed')
    } finally {
      setReverting(null)
    }
  }

  const filtered = activities.filter(a => {
    if (filter === 'all') return true
    if (filter === 'reverted') return a.status === 'reverted'
    const f = FILTERS.find(x => x.key === filter)
    return f?.intents?.includes(a.intent)
  })

  // Group by day header
  const groups = []
  let currentKey = null
  for (const a of filtered) {
    const k = dayHeader(a.created_at)
    if (k !== currentKey) { groups.push({ label: k, items: [] }); currentKey = k }
    groups[groups.length - 1].items.push(a)
  }

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <History size={20} color="#0a0a0a" />
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: BLK }}>Activity</div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b6b70', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
            {activities.length} action{activities.length === 1 ? '' : 's'} on file
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 12 }}>
          Every bot-executed action for this client, in order. Revert any artifact you don't want to keep.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{
                padding: '5px 12px', borderRadius: 16, border: '1px solid',
                borderColor: filter === f.key ? '#5aa0ff' : '#ececef',
                background: filter === f.key ? '#f1f1f6' : '#fff',
                color: filter === f.key ? '#5aa0ff' : '#1f1f22',
                fontSize: 12, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: 'pointer',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, color: '#6b6b70', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Loading activity…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '36px 20px', color: '#6b6b70', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
          <Clock size={28} color="#d1d5db" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: BLK, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 4 }}>
            {filter === 'all' ? 'No activity yet' : 'No activity matches this filter'}
          </div>
          <div style={{ fontSize: 12 }}>
            {filter === 'all' ? 'Ask the assistant to run something — it will show up here.' : 'Try another filter.'}
          </div>
        </div>
      )}

      {!loading && groups.map(g => (
        <div key={g.label} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", padding: '0 4px 8px' }}>
            {g.label}
          </div>
          {g.items.map(a => {
            const canView = !!INTENT_TAB[a.intent] && onSwitchTab
            const revertible = a.status === 'success' && a.result_ref_table && REVERTIBLE_TABLES.has(a.result_ref_table) && a.result_ref_id
            const inputSummary = summarizeInputs(a.inputs)
            const resultSummary = a.result?.summary || null
            return (
              <div key={a.id} style={{ ...card, padding: '14px 16px', borderLeft: `3px solid ${a.status === 'reverted' ? '#8e8e93' : a.status === 'failed' ? '#e9695c' : T}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK }}>
                    {prettyIntent(a.intent)}
                  </div>
                  <StatusPill status={a.status} />
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6b6b70', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                    <span>{fullStamp(a.created_at)}</span>
                    <span style={{ fontSize: 10, color: '#8e8e93' }}>{timeAgo(a.created_at)}</span>
                  </div>
                </div>
                {inputSummary && (
                  <div style={{ fontSize: 12, color: '#1f1f22', marginBottom: 4, padding: '6px 10px', background: GRY, borderRadius: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {inputSummary}
                  </div>
                )}
                {resultSummary && (
                  <div style={{ fontSize: 12, color: '#1f1f22', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 10 }}>
                    {resultSummary}
                  </div>
                )}
                {a.status === 'reverted' && a.reverted_at && (
                  <div style={{ fontSize: 11, color: '#6b6b70', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 10, fontStyle: 'italic' }}>
                    Reverted {fullStamp(a.reverted_at)} ({timeAgo(a.reverted_at)})
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => canView && onSwitchTab(INTENT_TAB[a.intent], {})}
                    disabled={!canView}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
                      border: '1px solid #e5e7eb', background: '#fff',
                      fontSize: 12, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                      color: canView ? BLK : '#8e8e93',
                      cursor: canView ? 'pointer' : 'not-allowed', opacity: canView ? 1 : 0.5,
                    }}>
                    <Eye size={12} /> View
                  </button>
                  <button onClick={() => revertible && onRevert(a)}
                    disabled={!revertible || reverting === a.id}
                    title={!revertible ? 'Not revertible — no persisted artifact or already reverted' : ''}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
                      border: '1px solid #fecaca', background: '#fff',
                      fontSize: 12, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                      color: revertible ? '#dc2626' : '#8e8e93',
                      cursor: revertible && reverting !== a.id ? 'pointer' : 'not-allowed', opacity: revertible ? 1 : 0.5,
                    }}>
                    {reverting === a.id
                      ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      : <RotateCcw size={12} />}
                    Revert
                  </button>
                  {a.action_api && (
                    <div style={{ marginLeft: 'auto', fontSize: 10, color: '#8e8e93', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', alignSelf: 'center' }}>
                      {a.action_api}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
