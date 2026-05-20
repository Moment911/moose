"use client"
import { useState, useEffect, useMemo } from 'react'
import { Command, Globe, RefreshCw, Loader2, ExternalLink, Search, CheckCircle, XCircle, AlertTriangle, Plug, Settings, Code2, Power } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
import toast from 'react-hot-toast'

const FALLBACK_AGENCY = '00000000-0000-0000-0000-000000000099'

function relativeTime(date) {
  if (!date) return 'never'
  const ms = Date.now() - new Date(date).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function StatusDot({ kind, label }) {
  const colors = {
    green: { fg: GRN, bg: `${GRN}15`, ring: `${GRN}25` },
    amber: { fg: AMB, bg: `${AMB}15`, ring: `${AMB}25` },
    gray:  { fg: '#9ca3af', bg: '#f3f4f6', ring: '#e5e7eb' },
  }
  const c = colors[kind] || colors.gray
  return (
    <span title={label} style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:c.fg, boxShadow:`0 0 0 3px ${c.ring}`, flexShrink:0 }}/>
  )
}

const Pill = ({ children, color, bg, border }) => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:5, fontSize:10, fontWeight:700, color, background:bg, border: border || 'none', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{children}</span>
)

export default function ControlCenterPage() {
  const { agencyId, agencyName, fullName } = useAuth()
  const [rows, setRows] = useState([])         // [{ client, site }]
  const [orphans, setOrphans] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('last') // last | site | client | status
  const [pinging, setPinging] = useState({})    // {site_id: true} during ping

  useEffect(() => { if (agencyId) load() }, [agencyId])

  const effectiveAgency = agencyId || FALLBACK_AGENCY

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'wpsc_list_clients', agency_id: effectiveAgency }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRows(data.rows || [])
      setOrphans(data.orphans || [])
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }

  async function pingSite(site) {
    setPinging(p => ({ ...p, [site.id]: true }))
    try {
      // Direct meta fetch — no auth — gives us version + remote_allowed
      const r = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'wpsc_detect', site_id: site.id }),
      })
      const data = await r.json()
      if (data.detected) toast.success(`${site.site_url.replace(/^https?:\/\//,'')} · WPSimpleCode v${data.meta?.version || '?'}`)
      else toast(`${site.site_url.replace(/^https?:\/\//,'')} · WPSimpleCode not detected`, { icon: '⚠️' })
      await load()
    } catch (e) { toast.error(e.message) }
    setPinging(p => { const next = { ...p }; delete next[site.id]; return next })
  }

  async function refreshAll() {
    setRefreshingAll(true)
    const all = [...rows.filter(r => r.site).map(r => r.site), ...orphans]
    let ok = 0, miss = 0
    for (const site of all) {
      try {
        const r = await fetch('/api/wp', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'wpsc_detect', site_id: site.id }),
        })
        const d = await r.json()
        if (d.detected) ok++; else miss++
      } catch { miss++ }
    }
    toast.success(`Refreshed ${ok} site${ok===1?'':'s'} · ${miss} unreachable`)
    setRefreshingAll(false)
    await load()
  }

  // Flatten + sort
  const sites = useMemo(() => {
    const items = [
      ...rows.filter(r => r.site).map(r => ({ ...r.site, client_name: r.client?.name || null, client_id: r.client?.id || null })),
      ...orphans.map(s => ({ ...s, client_name: null })),
    ]
    const filtered = items.filter(s => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return (s.site_url || '').toLowerCase().includes(q)
          || (s.site_name || '').toLowerCase().includes(q)
          || (s.client_name || '').toLowerCase().includes(q)
    })
    const statusRank = s => (s.connected && s.wpsc_api_key) ? 0 : (s.connected || s.wpsc_api_key) ? 1 : 2
    return filtered.sort((a, b) => {
      if (sortKey === 'site')   return (a.site_url || '').localeCompare(b.site_url || '')
      if (sortKey === 'client') return (a.client_name || 'zzz').localeCompare(b.client_name || 'zzz')
      if (sortKey === 'status') return statusRank(a) - statusRank(b)
      // default: last activity desc
      return new Date(b.last_ping || b.wpsc_last_seen_at || 0) - new Date(a.last_ping || a.wpsc_last_seen_at || 0)
    })
  }, [rows, orphans, search, sortKey])

  // Header stats
  const stats = useMemo(() => {
    const total = (rows.filter(r => r.site).length) + orphans.length
    const flat = [...rows.filter(r => r.site).map(r => r.site), ...orphans]
    const kotoLive = flat.filter(s => s.connected).length
    const wpscPaired = flat.filter(s => s.wpsc_api_key).length
    const fullyManaged = flat.filter(s => s.connected && s.wpsc_api_key).length
    const recent = flat.filter(s => {
      const t = new Date(s.last_ping || s.wpsc_last_seen_at || 0).getTime()
      return Date.now() - t < 24 * 60 * 60 * 1000
    }).length
    return { total, kotoLive, wpscPaired, fullyManaged, recent, orphans: orphans.length, clients: rows.filter(r => r.site).length }
  }, [rows, orphans])

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>

        {/* Top bar */}
        <div style={{ padding:'14px 28px', borderBottom:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:`${R}12`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Command size={18} color={R}/>
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
            <span style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK }}>Control Center</span>
            {agencyName && <>
              <span style={{ color:'#d1d5db', fontSize:14 }}>›</span>
              <span style={{ fontFamily:FH, fontSize:13, fontWeight:600, color:'#6b7280' }}>{agencyName}</span>
            </>}
          </div>
          {fullName && <span style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>Signed in as <strong style={{ color:'#6b7280' }}>{fullName}</strong></span>}
          <button onClick={refreshAll} disabled={refreshingAll || loading} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 11px', borderRadius:8, border:`1px solid ${R}`, background:'#fff', color:R, fontFamily:FH, fontSize:11, fontWeight:700, cursor:'pointer', opacity:(refreshingAll||loading)?0.6:1 }}>
            {refreshingAll ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Refresh all
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ padding:'14px 28px', background:'#fff', borderBottom:'1px solid #e5e7eb', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14 }}>
          <Stat label="Sites" value={stats.total} sub={`${stats.clients} clients · ${stats.orphans} unassigned`}/>
          <Stat label="Koto plugin live" value={stats.kotoLive} sub={`${stats.total - stats.kotoLive} idle`} color={GRN}/>
          <Stat label="WPSimpleCode paired" value={stats.wpscPaired} sub={`${stats.total - stats.wpscPaired} not paired`} color={R}/>
          <Stat label="Fully managed" value={stats.fullyManaged} sub={`both plugins live`} color={T}/>
          <Stat label="Active last 24h" value={stats.recent} sub={`${stats.total - stats.recent} dormant`} color={AMB}/>
        </div>

        {/* Filter row */}
        <div style={{ padding:'12px 28px', background:GRY, borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ position:'relative', flex:1, maxWidth:380 }}>
            <Search size={14} color="#9ca3af" style={{ position:'absolute', left:11, top:10 }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by site, client, or URL…" style={{ width:'100%', padding:'8px 12px 8px 32px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', background:'#fff' }}/>
          </div>
          <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
            {[['last','Latest'],['site','Site'],['client','Client'],['status','Status']].map(([k, label]) => (
              <button key={k} onClick={() => setSortKey(k)} style={{ padding:'6px 10px', borderRadius:6, border:`1px solid ${sortKey===k ? R : '#e5e7eb'}`, background: sortKey===k ? `${R}10` : '#fff', color: sortKey===k ? R : '#6b7280', fontFamily:FH, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ flex:1, overflow:'auto', padding:'20px 28px' }}>
          {loading ? (
            <div style={{ padding:60, textAlign:'center', color:'#9ca3af', fontSize:13 }}><Loader2 size={16} className="spin"/> Loading sites…</div>
          ) : sites.length === 0 ? (
            <div style={{ padding:60, textAlign:'center', color:'#9ca3af', fontSize:13 }}>No sites found.</div>
          ) : (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:FB }}>
                <thead>
                  <tr style={{ background:'#fafafa', borderBottom:'1px solid #f1f5f9' }}>
                    <th style={th({ width:36 })}/>
                    <th style={th()}>Site</th>
                    <th style={th()}>Client</th>
                    <th style={th()}>Koto plugin</th>
                    <th style={th()}>WPSimpleCode</th>
                    <th style={th()}>Modules</th>
                    <th style={th({ textAlign:'right' })}>Last seen</th>
                    <th style={th({ textAlign:'right', width:170 })}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map(s => {
                    const both = s.connected && s.wpsc_api_key
                    const one  = s.connected || s.wpsc_api_key
                    const dot  = both ? 'green' : one ? 'amber' : 'gray'
                    const lastSeen = s.last_ping || s.wpsc_last_seen_at
                    return (
                      <tr key={s.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                        <td style={td()}><StatusDot kind={dot} label={both?'Both plugins live':one?'Partially active':'Inactive'}/></td>
                        <td style={td()}>
                          <div style={{ fontFamily:FH, fontWeight:700, color:BLK, fontSize:12 }}>{s.site_name || s.site_url.replace(/^https?:\/\//,'')}</div>
                          <a href={s.site_url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:T, fontFamily:FB, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:3 }}>
                            {s.site_url.replace(/^https?:\/\//,'')} <ExternalLink size={9}/>
                          </a>
                        </td>
                        <td style={td()}>
                          {s.client_name ? <span style={{ fontWeight:600, color:BLK }}>{s.client_name}</span> : <span style={{ color:'#9ca3af', fontStyle:'italic' }}>Unassigned</span>}
                        </td>
                        <td style={td()}>
                          {s.connected
                            ? <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                                <Pill color={GRN} bg={`${GRN}15`}>live</Pill>
                                {s.plugin_version && <code style={{ fontSize:10, color:'#6b7280' }}>v{s.plugin_version}</code>}
                              </span>
                            : <Pill color="#9ca3af" bg="#f3f4f6">idle</Pill>}
                        </td>
                        <td style={td()}>
                          {s.wpsc_api_key
                            ? <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                                <Pill color={R} bg={`${R}15`}>paired</Pill>
                                {s.wpsc_version && <code style={{ fontSize:10, color:'#6b7280' }}>v{s.wpsc_version}</code>}
                              </span>
                            : s.wpsc_detected
                              ? <Pill color={AMB} bg={`${AMB}15`}>detected, unpaired</Pill>
                              : <Pill color="#9ca3af" bg="#f3f4f6">—</Pill>}
                        </td>
                        <td style={td()}>
                          {s.wpsc_api_key ? (
                            <ModuleChips site={s} onToggled={load}/>
                          ) : <span style={{ color:'#9ca3af' }}>—</span>}
                        </td>
                        <td style={{ ...td(), textAlign:'right', color:'#6b7280' }}>{relativeTime(lastSeen)}</td>
                        <td style={{ ...td(), textAlign:'right' }}>
                          <div style={{ display:'inline-flex', gap:4 }}>
                            <button onClick={() => pingSite(s)} disabled={!!pinging[s.id]} title="Re-detect WPSimpleCode" style={miniBtn()}>
                              {pinging[s.id] ? <Loader2 size={9} className="spin"/> : <RefreshCw size={9}/>} Ping
                            </button>
                            <a href={`/wpsimplecode`} title="Open in WPSimpleCode" style={{ ...miniBtn(), textDecoration:'none', color:R, borderColor:R }}>
                              <Code2 size={9}/> WPSC
                            </a>
                            <a href={`${s.site_url}/wp-admin`} target="_blank" rel="noreferrer" title="Open WP admin" style={{ ...miniBtn(), textDecoration:'none' }}>
                              <Settings size={9}/>
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

function ModuleChips({ site, onToggled }) {
  // wpsc_modules from koto_wp_sites is either:
  //   v1.1.x: [{slug, name, version, enabled, always_on}, ...]
  //   v1.0.x (cached): same shape after normalization in wpsc_detect
  //   missing: site never detected with module list — show the 3 v1.0 defaults
  const raw = Array.isArray(site.wpsc_modules) && site.wpsc_modules.length
    ? site.wpsc_modules
    : [{slug:'search-replace',name:'S&R',enabled:true},{slug:'snippets',name:'snippets',enabled:true},{slug:'access',name:'access',enabled:true}]
  const [busy, setBusy] = useState({})

  async function toggle(slug, nextEnabled) {
    setBusy(b => ({ ...b, [slug]: true }))
    try {
      const r = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'wpsc_modules_toggle', site_id: site.id, slug, enabled: nextEnabled }),
      })
      const d = await r.json()
      if (d.ok || d.data?.ok) toast.success(`${slug} ${nextEnabled ? 'enabled' : 'disabled'} on ${site.site_url.replace(/^https?:\/\//,'')}`)
      else toast.error(d.error || d.data?.error || d.data?.message || 'Toggle failed')
      onToggled?.()
    } catch (e) { toast.error(e.message) }
    setBusy(b => { const next = { ...b }; delete next[slug]; return next })
  }

  return (
    <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
      {raw.map(m => {
        const enabled = m.enabled !== false
        const display = ({ 'search-replace':'S&R', 'snippets':'snippets', 'access':'access' }[m.slug]) || m.slug
        return (
          <button
            key={m.slug}
            onClick={() => !m.always_on && !busy[m.slug] && toggle(m.slug, !enabled)}
            disabled={!!m.always_on}
            title={m.always_on ? `${m.name} (always on)` : `Click to ${enabled ? 'disable' : 'enable'} ${m.name}`}
            style={{
              display:'inline-flex', alignItems:'center', gap:3,
              padding:'2px 7px', borderRadius:5,
              fontSize:10, fontWeight:700, fontFamily:FH, textTransform:'uppercase', letterSpacing:'.04em',
              color: enabled ? '#374151' : '#9ca3af',
              background: enabled ? '#e5e7eb' : 'transparent',
              border: enabled ? '1px solid transparent' : '1px dashed #d1d5db',
              cursor: m.always_on ? 'default' : 'pointer',
              opacity: busy[m.slug] ? 0.5 : 1,
            }}>
            {busy[m.slug] ? <Loader2 size={9} className="spin"/> : <Power size={9}/>}
            {display}
          </button>
        )
      })}
    </div>
  )
}

function Stat({ label, value, sub, color = BLK }) {
  return (
    <div>
      <div style={{ fontFamily:FH, fontSize:24, fontWeight:900, color, lineHeight:1 }}>{(value || 0).toLocaleString()}</div>
      <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.05em', marginTop:4, fontWeight:700 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#6b7280', fontFamily:FB, marginTop:3 }}>{sub}</div>}
    </div>
  )
}

const th = (x = {}) => ({ textAlign:x.textAlign||'left', padding:'10px 12px', fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap', ...x })
const td = (x = {}) => ({ padding:'10px 12px', verticalAlign:'top', ...x })
const miniBtn = (x = {}) => ({ display:'inline-flex', alignItems:'center', gap:3, padding:'4px 7px', borderRadius:5, border:`1px solid ${x.borderColor || '#e5e7eb'}`, background:'#fff', color:x.color || '#6b7280', fontSize:10, fontFamily:FH, fontWeight:700, cursor:'pointer' })
