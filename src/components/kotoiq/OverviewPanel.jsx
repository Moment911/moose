"use client"
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Globe, Calendar, Shield, ExternalLink, RefreshCw, Loader2,
  FileText, File, Activity, Repeat, Search, ShieldCheck, Edit3, PenTool, AlertTriangle,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

/**
 * OverviewPanel — landing tab for a selected client/site.
 *
 * Three sections:
 *   1. Site card (URL, plugin version, paired status, fingerprint)
 *   2. Recent activity (push history + pair events, combined)
 *   3. Recent pages (v4 only — top 10 modified pages/posts from WP REST)
 */
export default function OverviewPanel({ site }) {
  const [activity, setActivity] = useState({ loading: true, events: [], error: null })
  const [pages, setPages] = useState({ loading: false, list: [], error: null })

  const isV4 = site?.shim_version === 'v4'
  const isPaired = isV4 || !!site?.wpsc_api_key

  async function loadActivity() {
    if (!site?.id) return
    setActivity({ loading: true, events: [], error: null })
    try {
      const r = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'kotoiq_overview_activity', site_id: site.id }),
      })
      const d = await r.json()
      if (!d.ok) setActivity({ loading: false, events: [], error: d.error || 'Failed' })
      else setActivity({ loading: false, events: d.events || [], error: null })
    } catch (e) {
      setActivity({ loading: false, events: [], error: e.message })
    }
  }

  async function loadPages() {
    if (!site?.id || !isV4) return
    setPages({ loading: true, list: [], error: null })
    try {
      const r = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'kotoiq_overview_pages_recent', site_id: site.id }),
      })
      const d = await r.json()
      if (!d.ok) setPages({ loading: false, list: [], error: d.error || d.data?.error || 'Failed' })
      else setPages({ loading: false, list: d.data?.pages || [], error: null })
    } catch (e) {
      setPages({ loading: false, list: [], error: e.message })
    }
  }

  useEffect(() => {
    if (site?.id) {
      loadActivity()
      if (isV4) loadPages()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, isV4])

  if (!site) {
    return (
      <div style={card()}>
        <div style={{ fontFamily:FB, color:'#9ca3af', fontSize:13 }}>No site selected.</div>
      </div>
    )
  }

  const pagedAt = site.paired_at_v4 || site.last_ping || site.created_at

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Site card ─────────────────────────────────────────────────────── */}
      <div style={card()}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
          <div style={{ width:42, height:42, borderRadius:10, background:`${R}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Globe size={20} color={R}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:FH, fontWeight:800, fontSize:18, color:BLK, marginBottom:4 }}>
              {site.site_name || stripProto(site.site_url)}
            </div>
            <a href={site.site_url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:12, fontFamily:FB, color:T, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4 }}>
              {stripProto(site.site_url)} <ExternalLink size={10}/>
            </a>
          </div>
          <StatusBadge isPaired={isPaired} isV4={isV4}/>
        </div>

        <div style={{ marginTop:18, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14 }}>
          <KV label="Plugin" value={site.shim_version === 'v4' ? `KotoIQ v${site.plugin_version || '4.0.3'}` : (site.wpsc_version ? `WPSimpleCode v${site.wpsc_version}` : '—')}/>
          <KV label="Paired since" value={pagedAt ? formatDate(pagedAt) : '—'}/>
          <KV label="Pages" value={String(site.pages_count ?? 0)} icon={File}/>
          <KV label="Posts" value={String(site.posts_count ?? 0)} icon={FileText}/>
        </div>

        {site.dashboard_pubkey_fingerprint && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#6b7280', fontFamily:FB }}>
            <Shield size={11} color="#9ca3af"/>
            <span style={{ fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em' }}>Fingerprint</span>
            <code style={{ fontSize:10, fontFamily:'ui-monospace,Menlo,monospace', color:BLK }}>{site.dashboard_pubkey_fingerprint.slice(0,16)}…{site.dashboard_pubkey_fingerprint.slice(-8)}</code>
          </div>
        )}
      </div>

      {/* ── Recent activity ───────────────────────────────────────────────── */}
      <div style={card()}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <Activity size={14} color={T}/>
          <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:14, color:BLK }}>
            Recent activity
          </div>
          <button onClick={loadActivity} disabled={activity.loading} style={miniBtn()}>
            {activity.loading ? <Loader2 size={10} className="spin"/> : <RefreshCw size={10}/>} Refresh
          </button>
        </div>

        {activity.loading && (
          <div style={{ display:'flex', alignItems:'center', gap:8, color:'#6b7280', fontFamily:FB, fontSize:12 }}>
            <Loader2 size={12} className="spin"/> Loading…
          </div>
        )}
        {!activity.loading && activity.error && (
          <div style={{ display:'flex', alignItems:'center', gap:8, color:R, fontFamily:FB, fontSize:12 }}>
            <AlertTriangle size={12}/> {activity.error}
          </div>
        )}
        {!activity.loading && !activity.error && activity.events.length === 0 && (
          <div style={{ fontFamily:FB, color:'#9ca3af', fontStyle:'italic', fontSize:12 }}>
            No activity yet. Once you push, pair, or run any tool on this site, it'll show up here.
          </div>
        )}
        {!activity.loading && !activity.error && activity.events.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column' }}>
            {activity.events.slice(0, 20).map((e, i) => (
              <ActivityRow key={`${e.kind}-${e.id}`} event={e} last={i === activity.events.length - 1}/>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent pages (v4 only) ────────────────────────────────────────── */}
      {isV4 && (
        <div style={card()}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <File size={14} color={T}/>
            <div style={{ flex:1, fontFamily:FH, fontWeight:800, fontSize:14, color:BLK }}>
              Recently modified pages & posts
            </div>
            <button onClick={loadPages} disabled={pages.loading} style={miniBtn()}>
              {pages.loading ? <Loader2 size={10} className="spin"/> : <RefreshCw size={10}/>} Refresh
            </button>
          </div>

          {pages.loading && (
            <div style={{ display:'flex', alignItems:'center', gap:8, color:'#6b7280', fontFamily:FB, fontSize:12 }}>
              <Loader2 size={12} className="spin"/> Loading…
            </div>
          )}
          {!pages.loading && pages.error && (
            <div style={{ display:'flex', alignItems:'center', gap:8, color:R, fontFamily:FB, fontSize:12 }}>
              <AlertTriangle size={12}/> {pages.error}
            </div>
          )}
          {!pages.loading && !pages.error && pages.list.length === 0 && (
            <div style={{ fontFamily:FB, color:'#9ca3af', fontStyle:'italic', fontSize:12 }}>
              No published pages or posts.
            </div>
          )}
          {!pages.loading && !pages.error && pages.list.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:FB }}>
              <thead>
                <tr>
                  <th style={th()}>Title</th>
                  <th style={th({ width:50 })}>Type</th>
                  <th style={th({ width:130 })}>Modified</th>
                  <th style={th({ width:30 })}></th>
                </tr>
              </thead>
              <tbody>
                {pages.list.map(p => (
                  <tr key={`${p.type}-${p.id}`} style={{ borderTop:'1px solid #f1f5f9' }}>
                    <td style={td()}>
                      <span dangerouslySetInnerHTML={{ __html: p.title }}/>
                    </td>
                    <td style={td()}><Pill color={T} bg={`${T}15`}>{p.type}</Pill></td>
                    <td style={td({ color:'#6b7280' })}>{formatRelative(p.modified)}</td>
                    <td style={td()}>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color:'#6b7280', display:'inline-flex' }}>
                          <ExternalLink size={11}/>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ isPaired, isV4 }) {
  if (isV4) {
    return (
      <span style={pill(GRN, `${GRN}15`)}>
        <span style={dot(GRN)}/> Paired · v4
      </span>
    )
  }
  if (isPaired) {
    return (
      <span style={pill(T, `${T}15`)}>
        <span style={dot(T)}/> Paired · v3
      </span>
    )
  }
  return (
    <span style={pill('#9ca3af', '#f3f4f6')}>
      <span style={dot('#9ca3af')}/> Not paired
    </span>
  )
}

function KV({ label, value, icon: Icon }) {
  return (
    <div>
      <div style={{ fontSize:10, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4, display:'flex', alignItems:'center', gap:5 }}>
        {Icon && <Icon size={10}/>}
        {label}
      </div>
      <div style={{ fontSize:14, fontFamily:FH, fontWeight:700, color:BLK }}>{value}</div>
    </div>
  )
}

function ActivityRow({ event, last }) {
  const Icon = ICONS[event.event] || ICONS[event.kind] || Activity
  const color = event.error ? R : (event.event === 'destruct' ? AMB : T)
  return (
    <div style={{ display:'flex', gap:12, padding:'10px 0', borderBottom: last ? 'none' : '1px solid #f1f5f9' }}>
      <div style={{ width:28, height:28, borderRadius:7, background:`${color}15`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={13} color={color}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontFamily:FH, fontWeight:700, color:BLK }}>{labelFor(event.event)}</div>
        {event.detail && (
          <div style={{ fontSize:11, fontFamily:FB, color:'#6b7280', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {event.detail}
          </div>
        )}
        {event.error && (
          <div style={{ fontSize:11, fontFamily:FB, color:R, marginTop:2 }}>
            {event.error}
          </div>
        )}
      </div>
      <div style={{ fontSize:11, fontFamily:FB, color:'#9ca3af', whiteSpace:'nowrap' }}>
        {formatRelative(event.time)}
      </div>
    </div>
  )
}

const ICONS = {
  push: RefreshCw,
  pair: Shield,
  sync_push: RefreshCw,
  sync_push_partial: RefreshCw,
  pair_completed: ShieldCheck,
  health_verified: Activity,
  pair_failed: AlertTriangle,
  destruct: AlertTriangle,
  seo: PenTool,
  rotation: Repeat,
  'search-replace': Search,
  'elementor-builder': Edit3,
}

function labelFor(event) {
  const map = {
    sync_push: 'Sync push',
    sync_push_partial: 'Sync push (partial)',
    pair_completed: 'Pair completed',
    health_verified: 'Health verified',
    pair_failed: 'Pair failed',
    destruct: 'Disconnected',
  }
  return map[event] || event.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function stripProto(u) {
  return String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function formatDate(s) {
  try {
    const d = new Date(s)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return s
  }
}

function formatRelative(s) {
  if (!s) return ''
  try {
    const d = new Date(s).getTime()
    const now = Date.now()
    const diff = (now - d) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return s
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card = (x={}) => ({ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:18, ...x })
const miniBtn = (x={}) => ({ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7, border:`1px solid ${x.borderColor||'#e5e7eb'}`, background:'#fff', color:x.color||'#6b7280', fontFamily:FH, fontSize:11, fontWeight:700, cursor:'pointer' })
const pill = (color, bg) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:6, fontSize:11, fontFamily:FH, fontWeight:700, color, background:bg, textTransform:'uppercase', letterSpacing:'.04em' })
const dot = (color) => ({ width:6, height:6, borderRadius:'50%', background:color })
const Pill = ({ children, color, bg }) => (
  <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:5, fontSize:10, fontFamily:FH, fontWeight:700, color, background:bg, textTransform:'uppercase', letterSpacing:'.04em' }}>{children}</span>
)
const th = (x={}) => ({ textAlign:'left', padding:'8px 10px', fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', ...x })
const td = (x={}) => ({ padding:'8px 10px', ...x })
