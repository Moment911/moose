"use client"
import { useState, useEffect, useMemo } from 'react'
import { Loader2, RefreshCw, Search, UploadCloud, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { R, BLK, FH, FB } from '../../lib/theme'
import StatsStrip from './StatsStrip'
import SitesTable from './SitesTable'

/**
 * FleetView — the agency-wide fleet table. Same data + actions as the
 * legacy /control-center, but re-styled with the Unified Marketing palette
 * and wrapped so the parent page can intercept row clicks for drill-down
 * into ClientView.
 *
 * onSelectSite(site) fires when a user clicks any site row.
 */
const FALLBACK_AGENCY = '00000000-0000-0000-0000-000000000099'
const NAVY  = BLK
const PINK  = R
const CREAM = '#faf9f6'
const LINE  = '#e9e6dd'

export default function FleetView({ onSelectSite }) {
  const { agencyId } = useAuth()
  const [rows, setRows] = useState([])
  const [orphans, setOrphans] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('last')
  const [pinging, setPinging] = useState({})
  const [updating, setUpdating] = useState({})
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [manifests, setManifests] = useState({ wpsimplecode: null, kotoiq: null })

  const effectiveAgency = agencyId || FALLBACK_AGENCY

  useEffect(() => { if (agencyId) load() }, [agencyId])
  useEffect(() => {
    Promise.all([
      fetch('/api/wpsc-manifest').then(r => r.json()).catch(() => null),
      fetch('/api/kotoiq-manifest').then(r => r.json()).catch(() => null),
    ]).then(([wpsc, kotoiq]) => setManifests({ wpsimplecode: wpsc, kotoiq }))
  }, [])

  const manifestFor = s => (s?.wpsc_plugin === 'kotoiq' ? manifests.kotoiq : manifests.wpsimplecode)
  const anyManifest = manifests.kotoiq || manifests.wpsimplecode

  function compareVersion(a, b) {
    if (!a || !b) return a === b ? 0 : a ? 1 : -1
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0)
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0, y = pb[i] || 0
      if (x !== y) return x - y
    }
    return 0
  }
  const isOutdated = s => {
    if (!s.wpsc_api_key) return false
    const m = manifestFor(s)
    if (!m) return false
    return compareVersion(s.wpsc_version, m.latest_version) < 0
  }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_list_clients', agency_id: effectiveAgency }),
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
      const r = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_detect', site_id: site.id }),
      })
      const d = await r.json()
      if (d.detected) toast.success(`${site.site_url.replace(/^https?:\/\//, '')} · KotoIQ v${d.meta?.version || '?'}`)
      else toast(`${site.site_url.replace(/^https?:\/\//, '')} · plugin not detected`, { icon: '⚠️' })
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
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'wpsc_detect', site_id: site.id }),
        })
        const d = await r.json()
        if (d.detected) ok++; else miss++
      } catch { miss++ }
    }
    toast.success(`Refreshed ${ok} site${ok === 1 ? '' : 's'} · ${miss} unreachable`)
    setRefreshingAll(false)
    await load()
  }

  async function pushUpdate(site) {
    const m = manifestFor(site)
    if (!m) { toast.error('Manifest not loaded yet'); return }
    const label = site.wpsc_plugin === 'kotoiq' ? 'KotoIQ' : 'WPSimpleCode'
    if (!confirm(`Push ${label} v${m.latest_version} to ${site.site_url.replace(/^https?:\/\//, '')}?\n\nDownloads from:\n${m.download_url}\nsha256: ${m.sha256.slice(0, 16)}…`)) return
    setUpdating(u => ({ ...u, [site.id]: true }))
    try {
      const r = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_update_plugin', site_id: site.id }),
      })
      const d = await r.json()
      if (d.ok || d.new_version === m.latest_version) toast.success(`Updated ${site.site_url.replace(/^https?:\/\//, '')} → v${d.new_version || m.latest_version}`)
      else toast.error(d.error || d.message || 'Update failed')
      await load()
    } catch (e) { toast.error(e.message) }
    setUpdating(u => { const n = { ...u }; delete n[site.id]; return n })
  }

  async function bulkUpdate() {
    const targets = sites.filter(isOutdated)
    if (!targets.length) {
      const v = [manifests.kotoiq?.latest_version, manifests.wpsimplecode?.latest_version].filter(Boolean).join(' / ')
      toast('Nothing to update — fleet on v' + v)
      return
    }
    const kotoiqCount = targets.filter(s => s.wpsc_plugin === 'kotoiq').length
    const wpscCount = targets.length - kotoiqCount
    const parts = []
    if (kotoiqCount) parts.push(`${kotoiqCount} KotoIQ → v${manifests.kotoiq?.latest_version}`)
    if (wpscCount)   parts.push(`${wpscCount} WPSimpleCode → v${manifests.wpsimplecode?.latest_version}`)
    if (!confirm(`Push updates to ${targets.length} site(s)?\n\n${parts.join('\n')}`)) return
    setBulkUpdating(true)
    let ok = 0, fail = 0
    for (const site of targets) {
      const m = manifestFor(site)
      try {
        const r = await fetch('/api/wp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'wpsc_update_plugin', site_id: site.id }),
        })
        const d = await r.json()
        if (d.ok || (m && d.new_version === m.latest_version)) ok++; else fail++
      } catch { fail++ }
    }
    toast.success(`Updated ${ok} site(s) · ${fail} failed`)
    setBulkUpdating(false)
    await load()
  }

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
      if (sortKey === 'site')   return (a.site_url   || '').localeCompare(b.site_url   || '')
      if (sortKey === 'client') return (a.client_name || 'zzz').localeCompare(b.client_name || 'zzz')
      if (sortKey === 'status') return statusRank(a) - statusRank(b)
      return new Date(b.last_ping || b.wpsc_last_seen_at || 0) - new Date(a.last_ping || a.wpsc_last_seen_at || 0)
    })
  }, [rows, orphans, search, sortKey])

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

  const outdatedCount = sites.filter(isOutdated).length

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: CREAM, minHeight: 0 }}>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
          <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: 11, top: 11 }}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by site, client, or URL…"
            style={{
              width: '100%', padding: '9px 12px 9px 32px', borderRadius: 8,
              border: `1px solid ${LINE}`, fontSize: 13, fontFamily: FB, outline: 'none', background: '#fff',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['last', 'Latest'], ['site', 'Site'], ['client', 'Client'], ['status', 'Status']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              style={{
                padding: '7px 11px', borderRadius: 6,
                border: `1px solid ${sortKey === k ? PINK : LINE}`,
                background: sortKey === k ? `${PINK}10` : '#fff',
                color: sortKey === k ? PINK : '#6b7280',
                fontFamily: FB, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {outdatedCount > 0 && (
            <button
              onClick={bulkUpdate}
              disabled={bulkUpdating || !anyManifest}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '8px 13px', borderRadius: 8, border: 'none',
                background: PINK, color: '#fff', fontFamily: FB, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', opacity: bulkUpdating ? 0.6 : 1,
              }}
            >
              {bulkUpdating ? <Loader2 size={11} className="spin"/> : <UploadCloud size={11}/>}
              Push updates to {outdatedCount} site{outdatedCount === 1 ? '' : 's'}
            </button>
          )}
          <a href="/downloads/kotoiq-shim-4.0.3.zip" download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '8px 13px', borderRadius: 8,
              border: `1px solid ${LINE}`, background: '#fff', color: NAVY,
              fontFamily: FB, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <Download size={11}/> Plugin v4.0.3
          </a>
          <button
            onClick={refreshAll}
            disabled={refreshingAll || loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '8px 13px', borderRadius: 8,
              border: `1px solid ${NAVY}`, background: '#fff', color: NAVY,
              fontFamily: FB, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              opacity: (refreshingAll || loading) ? 0.6 : 1,
            }}
          >
            {refreshingAll ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Refresh all
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <StatsStrip stats={stats}/>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          <Loader2 size={16} className="spin"/> Loading sites…
        </div>
      ) : (
        <SitesTable
          sites={sites}
          manifestFor={manifestFor}
          isOutdated={isOutdated}
          pinging={pinging}
          updating={updating}
          onRowClick={onSelectSite}
          onPing={pingSite}
          onPushUpdate={pushUpdate}
          onModulesChanged={load}
        />
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}
