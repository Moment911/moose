"use client"
import { useState } from 'react'
import { Loader2, RefreshCw, UploadCloud, Code2, Settings, Power, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

/**
 * SitesTable — the fleet table. Lifted from ControlCenterPage's <table>,
 * re-styled with the Unified palette (cream lines, navy headers, pink
 * accents). Click any row to drill into Client view via onRowClick.
 *
 * ModuleChips is embedded inline (same component as in ControlCenterPage)
 * for the per-site module-toggle pills.
 */
const NAVY  = BLK
const PINK  = R
const CREAM = '#faf9f6'
const LINE  = '#e9e6dd'

export default function SitesTable({
  sites,
  manifestFor,
  isOutdated,
  pinging = {},
  updating = {},
  onRowClick,
  onPing,
  onPushUpdate,
  onModulesChanged,
}) {
  if (!sites || sites.length === 0) {
    return (
      <div style={{
        padding: 50, textAlign: 'center', color: '#9ca3af', fontSize: 13,
        background: '#fff', borderRadius: 12, border: `1px solid ${LINE}`,
      }}>
        No sites match your filters.
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${LINE}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: FB }}>
        <thead>
          <tr style={{ background: CREAM, borderBottom: `1px solid ${LINE}` }}>
            <th style={th({ width: 36 })}/>
            <th style={th()}>Site</th>
            <th style={th()}>Client</th>
            <th style={th()}>Koto plugin</th>
            <th style={th()}>KotoIQ / WPSC</th>
            <th style={th()}>Modules</th>
            <th style={th({ textAlign: 'right' })}>Last seen</th>
            <th style={th({ textAlign: 'right', width: 180 })}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sites.map(s => {
            const both = s.connected && s.wpsc_api_key
            const one  = s.connected || s.wpsc_api_key
            const dot  = both ? 'green' : one ? 'amber' : 'gray'
            const lastSeen = s.last_ping || s.wpsc_last_seen_at
            const m = manifestFor ? manifestFor(s) : null
            const outdated = isOutdated ? isOutdated(s) : false
            return (
              <tr
                key={s.id}
                onClick={() => onRowClick?.(s)}
                style={{
                  borderTop: `1px solid ${LINE}`,
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = CREAM }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <td style={td()}><StatusDot kind={dot} label={both ? 'Both plugins live' : one ? 'Partially active' : 'Inactive'}/></td>
                <td style={td()}>
                  <div style={{ fontFamily: FH, fontWeight: 700, color: NAVY, fontSize: 12 }}>
                    {s.site_name || s.site_url.replace(/^https?:\/\//, '')}
                  </div>
                  <a
                    href={s.site_url} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 10, color: T, fontFamily: FB, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    {s.site_url.replace(/^https?:\/\//, '')} <ExternalLink size={9}/>
                  </a>
                </td>
                <td style={td()}>
                  {s.client_name
                    ? <span style={{ fontWeight: 600, color: NAVY }}>{s.client_name}</span>
                    : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unassigned</span>}
                </td>
                <td style={td()}>
                  {s.connected
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Pill color={GRN} bg={`${GRN}15`}>live</Pill>
                        {s.plugin_version && <code style={{ fontSize: 10, color: '#6b7280' }}>v{s.plugin_version}</code>}
                      </span>
                    : <Pill color="#9ca3af" bg="#f3f4f6">idle</Pill>}
                </td>
                <td style={td()}>
                  {s.wpsc_api_key
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <Pill color={PINK} bg={`${PINK}15`}>{s.wpsc_plugin === 'kotoiq' ? 'KotoIQ' : 'WPSC paired'}</Pill>
                        {s.wpsc_version && <code style={{ fontSize: 10, color: '#6b7280' }}>v{s.wpsc_version}</code>}
                        {outdated && m && (
                          <Pill color={AMB} bg={`${AMB}15`}>→ v{m.latest_version}</Pill>
                        )}
                      </span>
                    : s.wpsc_detected
                      ? <Pill color={AMB} bg={`${AMB}15`}>detected, unpaired</Pill>
                      : <Pill color="#9ca3af" bg="#f3f4f6">—</Pill>}
                </td>
                <td style={td()}>
                  {s.wpsc_api_key ? <ModuleChips site={s} onToggled={onModulesChanged}/> : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td style={{ ...td(), textAlign: 'right', color: '#6b7280' }}>{relativeTime(lastSeen)}</td>
                <td style={{ ...td(), textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    {outdated && m && (
                      <button onClick={() => onPushUpdate?.(s)} disabled={!!updating[s.id]} title={`Push v${m.latest_version}`} style={miniBtn({ color: PINK, borderColor: PINK })}>
                        {updating[s.id] ? <Loader2 size={9} className="spin"/> : <UploadCloud size={9}/>} Update
                      </button>
                    )}
                    <button onClick={() => onPing?.(s)} disabled={!!pinging[s.id]} title="Re-detect KotoIQ / WPSimpleCode" style={miniBtn()}>
                      {pinging[s.id] ? <Loader2 size={9} className="spin"/> : <RefreshCw size={9}/>} Ping
                    </button>
                    <a href={`${s.site_url}/wp-admin`} target="_blank" rel="noreferrer" title="Open WP admin" style={{ ...miniBtn(), textDecoration: 'none' }}>
                      <Settings size={9}/>
                    </a>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

function StatusDot({ kind, label }) {
  const colors = {
    green: GRN,
    amber: AMB,
    gray:  '#9ca3af',
  }
  const c = colors[kind] || colors.gray
  return (
    <span title={label} style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: c, boxShadow: `0 0 0 3px ${c}25`, flexShrink: 0,
    }}/>
  )
}

const Pill = ({ children, color, bg }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 5,
    fontSize: 10, fontWeight: 700, color, background: bg, fontFamily: FH,
    textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap',
  }}>{children}</span>
)

function ModuleChips({ site, onToggled }) {
  const raw = Array.isArray(site.wpsc_modules) && site.wpsc_modules.length
    ? site.wpsc_modules
    : [
        { slug: 'search-replace', name: 'S&R',      enabled: true },
        { slug: 'snippets',        name: 'snippets', enabled: true },
        { slug: 'access',          name: 'access',   enabled: true },
      ]
  const [busy, setBusy] = useState({})

  async function toggle(slug, nextEnabled) {
    setBusy(b => ({ ...b, [slug]: true }))
    try {
      const r = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_modules_toggle', site_id: site.id, slug, enabled: nextEnabled }),
      })
      const d = await r.json()
      if (d.ok || d.data?.ok) toast.success(`${slug} ${nextEnabled ? 'enabled' : 'disabled'} on ${site.site_url.replace(/^https?:\/\//, '')}`)
      else toast.error(d.error || d.data?.error || 'Toggle failed')
      onToggled?.()
    } catch (e) { toast.error(e.message) }
    setBusy(b => { const n = { ...b }; delete n[slug]; return n })
  }

  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
      {raw.map(m => {
        const enabled = m.enabled !== false
        const display = ({
          'search-replace':    'S&R',
          'snippets':          'snippets',
          'access':            'access',
          'elementor-builder': 'builder',
          'content-rotation':  'rotation',
          'seo':               'seo',
        }[m.slug]) || m.slug
        return (
          <button
            key={m.slug}
            onClick={() => !m.always_on && !busy[m.slug] && toggle(m.slug, !enabled)}
            disabled={!!m.always_on}
            title={m.always_on ? `${m.name} (always on)` : `Click to ${enabled ? 'disable' : 'enable'} ${m.name}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 5,
              fontSize: 10, fontWeight: 700, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.04em',
              color: enabled ? '#374151' : '#9ca3af',
              background: enabled ? '#e5e7eb' : 'transparent',
              border: enabled ? '1px solid transparent' : '1px dashed #d1d5db',
              cursor: m.always_on ? 'default' : 'pointer',
              opacity: busy[m.slug] ? 0.5 : 1,
            }}
          >
            {busy[m.slug] ? <Loader2 size={9} className="spin"/> : <Power size={9}/>}
            {display}
          </button>
        )
      })}
    </div>
  )
}

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

const th = (x = {}) => ({ textAlign: x.textAlign || 'left', padding: '12px 14px', fontFamily: FH, fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap', ...x })
const td = (x = {}) => ({ padding: '12px 14px', verticalAlign: 'top', ...x })
const miniBtn = (x = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '5px 8px', borderRadius: 6, border: `1px solid ${x.borderColor || LINE}`, background: x.bg || '#fff', color: x.color || '#6b7280', fontSize: 10, fontFamily: FH, fontWeight: 700, cursor: 'pointer' })
