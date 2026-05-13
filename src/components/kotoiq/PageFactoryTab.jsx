"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, RefreshCw, ExternalLink, CheckCircle, AlertTriangle, Clock,
  Layers, Target, Activity, Zap, TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BLK, GRN, AMB, R } from '../../lib/theme'

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
const card = { background: '#fff', borderRadius: 16, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }

const STATUS_COLOR = {
  suggested: '#94a3b8',
  accepted:  '#2563eb',
  generating: '#f59e0b',
  built: '#a855f7',
  published: GRN,
  dismissed: '#cbd5e1',
}

const STATUS_LABEL = {
  suggested: 'Suggested',
  accepted: 'Accepted',
  generating: 'Generating',
  built: 'Built',
  published: 'Published',
  dismissed: 'Dismissed',
}

async function api(action, body = {}) {
  const res = await fetch('/api/kotoiq', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  return res.json()
}

function KPIBox({ label, value, sub, color = BLK }) {
  return (
    <div style={{ flex: '1 1 160px', minWidth: 160, padding: '14px 16px', background: '#f9f9fb', border: '1px solid #f1f1f6', borderRadius: 12 }}>
      <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: SF, fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: SF, fontSize: 11, color: '#8e8e93', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function StatusBar({ counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return <div style={{ fontSize: 12, color: '#8e8e93', fontStyle: 'italic' }}>No suggestions yet — click Sync to generate.</div>
  const order = ['suggested', 'accepted', 'generating', 'built', 'published', 'dismissed']
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: '#f1f1f6' }}>
        {order.map(s => {
          const n = counts[s] || 0
          if (!n) return null
          const w = (n / total) * 100
          return <div key={s} title={`${STATUS_LABEL[s]}: ${n}`} style={{ width: `${w}%`, background: STATUS_COLOR[s], transition: 'width .3s' }} />
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
        {order.map(s => counts[s] ? (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: STATUS_COLOR[s], borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontFamily: SF, fontSize: 12, color: BLK, fontWeight: 600 }}>{STATUS_LABEL[s]}</span>
            <span style={{ fontFamily: SF, fontSize: 12, color: '#6b6b70' }}>{counts[s]}</span>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

function CwvBadge({ cwv }) {
  if (!cwv || cwv.lcp_ms == null) return <span style={{ color: '#cbd5e1' }}>—</span>
  const lcp = cwv.lcp_ms
  const color = lcp <= 2500 ? GRN : lcp <= 4000 ? AMB : R
  return (
    <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: color + '18', color }} title={`LCP ${lcp}ms · CLS ${cwv.cls ?? '—'} · INP ${cwv.inp_ms ?? '—'}ms`}>
      {Math.round(lcp)}ms
    </span>
  )
}

function IndexedBadge({ indexed }) {
  if (indexed === null || indexed === undefined) return <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
  if (indexed) return <CheckCircle size={14} color={GRN} />
  return <AlertTriangle size={14} color={AMB} />
}

export default function PageFactoryTab({ clientId, agencyId }) {
  const [stats, setStats] = useState(null)
  const [coverage, setCoverage] = useState([])
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const [s, c, p] = await Promise.all([
        api('get_page_factory_stats', { client_id: clientId }),
        api('get_page_factory_gap_coverage', { client_id: clientId }),
        api('get_page_factory_pages', { client_id: clientId, limit: 50 }),
      ])
      setStats(s)
      setCoverage(c?.services || [])
      setPages(p?.pages || [])
    } catch (e) {
      toast.error('Failed to load Page Factory data')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await api('sync_page_factory', { client_id: clientId, agency_id: agencyId })
      if (res?.ok) {
        toast.success(`Found ${res.stats?.gaps_found ?? 0} gap pages · saved ${res.stats?.saved ?? 0}`)
        await load()
      } else {
        toast.error(res?.error || 'Sync failed')
      }
    } catch (e) {
      toast.error(e.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const counts = stats?.suggestions?.by_status || {}
  const totalSuggestions = stats?.suggestions?.total || 0
  const totalPublishes = stats?.publishes?.total || 0
  const last7d = stats?.publishes?.last_7_days || 0
  const callsTotal = pages.reduce((a, p) => a + (p.call_count || 0), 0)
  const revenueTotal = pages.reduce((a, p) => a + (p.estimated_revenue || 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: SF, fontSize: 20, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={20} color={R} /> Page Factory
          </div>
          <div style={{ fontFamily: SF, fontSize: 13, color: '#6b6b70', marginTop: 4 }}>
            Service × city gap intelligence, generated pages, and live attribution to calls.
          </div>
        </div>
        <button onClick={sync} disabled={syncing || !clientId}
          style={{ padding: '10px 16px', background: syncing ? '#cbd5e1' : R, color: '#fff', border: 'none', borderRadius: 10,
            fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: syncing ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {syncing ? <><Loader2 size={14} className="spin" /> Syncing…</> : <><RefreshCw size={14} /> Sync Gaps</>}
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KPIBox label="Gap Suggestions" value={totalSuggestions} sub={`${counts.suggested || 0} pending`} />
        <KPIBox label="Published Pages" value={totalPublishes} sub={`${last7d} in last 7 days`} color={GRN} />
        <KPIBox label="Attributed Calls" value={callsTotal} sub={pages.length ? `${pages.length} pages tracked` : 'no pages yet'} color={callsTotal > 0 ? R : BLK} />
        <KPIBox label="Est. Revenue" value={`$${revenueTotal.toLocaleString()}`} sub="$150 / call avg" color={revenueTotal > 0 ? GRN : BLK} />
      </div>

      {/* Pipeline Funnel */}
      <div style={card}>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color={R} /> Gap Pipeline
        </div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b6b70', fontSize: 13 }}><Loader2 size={14} className="spin" /> Loading…</div>
        ) : (
          <StatusBar counts={counts} />
        )}
      </div>

      {/* Service Coverage */}
      <div style={card}>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={16} color={R} /> Closure by Service
        </div>
        {coverage.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8e8e93', fontStyle: 'italic' }}>No services tracked yet. Sync to populate.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {coverage.map((svc, i) => (
              <div key={i} style={{ padding: '10px 12px', background: '#f9f9fb', borderRadius: 10, border: '1px solid #f1f1f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: BLK }}>{svc.service}</div>
                  <div style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: svc.closure_pct >= 70 ? GRN : svc.closure_pct >= 30 ? AMB : R }}>
                    {svc.closure_pct}% closed · {svc.total} total
                  </div>
                </div>
                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${svc.closure_pct}%`, height: '100%', background: svc.closure_pct >= 70 ? GRN : svc.closure_pct >= 30 ? AMB : R, transition: 'width .3s' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 11, color: '#6b6b70', fontFamily: SF }}>
                  <span>Suggested: {svc.suggested}</span>
                  <span>Built: {svc.built}</span>
                  <span>Published: {svc.published}</span>
                  {svc.dismissed > 0 && <span style={{ color: '#cbd5e1' }}>Dismissed: {svc.dismissed}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generated Pages Table */}
      <div style={card}>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} color={R} /> Generated Pages
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b6b70', fontWeight: 600 }}>{pages.length} shown</span>
        </div>
        {pages.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8e8e93', fontStyle: 'italic', padding: '8px 0' }}>
            No pages published yet. Accept gap suggestions in the campaign queue and they'll appear here once published.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SF, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ececef' }}>
                  <th style={th}>Page</th>
                  <th style={th}>Indexed</th>
                  <th style={thNum}>Impressions</th>
                  <th style={thNum}>Clicks</th>
                  <th style={thNum}>Position</th>
                  <th style={thNum}>Calls</th>
                  <th style={thNum}>Est. Rev</th>
                  <th style={th}>CWV (LCP)</th>
                </tr>
              </thead>
              <tbody>
                {pages.map(p => (
                  <tr key={p.publish_id} style={{ borderBottom: '1px solid #f5f5f7' }}>
                    <td style={td}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: BLK, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 700, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                          {p.page_title || p.url}
                        </span>
                        <ExternalLink size={11} color="#94a3b8" />
                      </a>
                      {p.campaign_name && <div style={{ fontSize: 10, color: '#8e8e93', marginTop: 2 }}>{p.campaign_name}</div>}
                    </td>
                    <td style={td}><IndexedBadge indexed={p.indexed} /></td>
                    <td style={tdNum}>{p.impressions != null ? p.impressions.toLocaleString() : '—'}</td>
                    <td style={tdNum}>{p.clicks != null ? p.clicks.toLocaleString() : '—'}</td>
                    <td style={tdNum}>{p.position != null ? p.position.toFixed(1) : '—'}</td>
                    <td style={tdNum} title={p.call_count > 0 ? `${p.call_count} attributed calls` : ''}>
                      {p.call_count > 0 ? <span style={{ fontWeight: 700, color: R }}>{p.call_count}</span> : <span style={{ color: '#cbd5e1' }}>0</span>}
                    </td>
                    <td style={tdNum}>{p.estimated_revenue ? `$${p.estimated_revenue.toLocaleString()}` : '—'}</td>
                    <td style={td}><CwvBadge cwv={p.cwv} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes pf-spin { to { transform: rotate(360deg) } } .spin { animation: pf-spin 1s linear infinite }`}</style>
    </div>
  )
}

const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#6b6b70', textTransform: 'uppercase', letterSpacing: 0.3 }
const thNum = { ...th, textAlign: 'right' }
const td = { padding: '10px', color: BLK, verticalAlign: 'top' }
const tdNum = { ...td, textAlign: 'right' }
