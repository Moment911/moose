"use client"
import { useState, useEffect } from 'react'
import { Search as SearchIcon, Code2, ShieldCheck, Edit3, Repeat, TrendingUp, Plug, Globe, Loader2, ExternalLink, Plus, X, User, PowerOff, Trash2, ChevronLeft, ChevronRight, Download, RefreshCw, LayoutDashboard, Sparkles, Compass } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

import WPSCConnectionGate     from '../kotoiq/WPSCConnectionGate'
import OverviewPanel           from '../kotoiq/OverviewPanel'
import TopicCampaignPanel      from '../kotoiq/TopicCampaignPanel'
import SearchReplacePanel     from '../kotoiq/SearchReplacePanel'
import SnippetsPanel          from '../kotoiq/SnippetsPanel'
import AccessManagementPanel  from '../kotoiq/AccessManagementPanel'
import ElementorBuilderPanel  from '../kotoiq/ElementorBuilderPanel'
import ContentRotationPanel   from '../kotoiq/ContentRotationPanel'
import SEOPanel               from '../kotoiq/SEOPanel'
import SyncPanel              from '../kotoiq/SyncPanel'
import GuidedSpine            from './GuidedSpine'

/**
 * ClientView — per-client deep-dive: collapsible clients-first left rail +
 * sub-header with site identity + 6 module tabs.
 *
 * Receives optional `preselectedSiteId` prop. On mount, if set, finds the
 * site in fetched rows/orphans and selects it so the right pane is
 * populated without an extra click.
 *
 * Lifted from KotoIQSitesPage with the Unified palette swapped in (cream
 * `#faf9f6` background instead of generic gray; navy + pink accents).
 */
const FALLBACK_AGENCY = '00000000-0000-0000-0000-000000000099'
const NAVY  = BLK
const PINK  = R
const CREAM = '#faf9f6'
const LINE  = '#e9e6dd'

const TABS = [
  { key: 'guided',            label: 'Guided',           icon: Compass,     slug: 'guided' },
  { key: 'overview',          label: 'Overview',         icon: LayoutDashboard, slug: null },
  { key: 'topic_campaign',    label: 'AI Pages',         icon: Sparkles,    slug: null },
  { key: 'search_replace',    label: 'Search & Replace', icon: SearchIcon,  slug: 'search-replace' },
  { key: 'snippets',          label: 'Snippets',         icon: Code2,       slug: 'snippets' },
  { key: 'access',            label: 'Access',           icon: ShieldCheck, slug: 'access' },
  { key: 'elementor_builder', label: 'Builder',          icon: Edit3,       slug: 'elementor-builder' },
  { key: 'content_rotation',  label: 'Rotation',         icon: Repeat,      slug: 'content-rotation' },
  { key: 'seo',               label: 'SEO',              icon: TrendingUp,  slug: 'seo' },
  { key: 'sync',              label: 'Sync',             icon: RefreshCw,   slug: 'sync' },
]

export default function ClientView({ preselectedSiteId, preselectedClientId, preselectedTab, onSiteSelected, onTabChange, onClearSelection }) {
  const { agencyId, agencyName } = useAuth()
  const [rows, setRows] = useState([])
  const [orphans, setOrphans] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTabLocal] = useState(preselectedTab || 'overview')
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [railOpen, setRailOpen] = useState(!preselectedSiteId && !preselectedClientId)

  function setTab(t) {
    setTabLocal(t)
    onTabChange?.(t)
  }

  const effectiveAgency = agencyId || FALLBACK_AGENCY

  useEffect(() => { if (agencyId) load() }, [agencyId])
  useEffect(() => { if (selected) setRailOpen(false) }, [selected?.entry?.client?.id, selected?.site?.id])

  // Sync from URL on popstate (parent passes new props without remount)
  useEffect(() => { if (preselectedTab) setTabLocal(preselectedTab) }, [preselectedTab])
  useEffect(() => {
    if (!preselectedClientId || !rows.length) return
    // Match by UUID or case-insensitive name
    const found = rows.find(r =>
      r.client?.id === preselectedClientId ||
      r.client?.name?.toLowerCase() === preselectedClientId.toLowerCase()
    )
    if (found && found.client?.id !== selected?.entry?.client?.id) {
      setSelected({ type: 'client', entry: found })
    }
  }, [preselectedClientId, rows.length])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_list_clients', agency_id: effectiveAgency }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setLoading(false); return }
      setRows(data.rows || [])
      setOrphans(data.orphans || [])

      // Apply preselected site or client on first load
      if ((preselectedSiteId || preselectedClientId) && !selected) {
        const found = preselectedSiteId
          ? (data.rows || []).find(r => r.site?.id === preselectedSiteId)
          : preselectedClientId
            ? (data.rows || []).find(r => r.client?.id === preselectedClientId || r.client?.name?.toLowerCase() === preselectedClientId.toLowerCase())
            : null
        if (found) setSelected({ type: 'client', entry: found })
        else if (preselectedSiteId) {
          const orphan = (data.orphans || []).find(s => s.id === preselectedSiteId)
          if (orphan) setSelected({ type: 'orphan', site: orphan })
        }
      } else if (selected) {
        // Refresh sticky selection
        if (selected.type === 'client') {
          const fresh = (data.rows || []).find(r => r.client.id === selected.entry.client.id)
          setSelected(fresh ? { type: 'client', entry: fresh } : null)
        } else if (selected.type === 'orphan') {
          const fresh = (data.orphans || []).find(s => s.id === selected.site.id)
          setSelected(fresh ? { type: 'orphan', site: fresh } : null)
        }
      }
    } finally { setLoading(false) }
  }

  const activeSite   = selected?.type === 'client' ? selected.entry.site   : selected?.type === 'orphan' ? selected.site : null
  const activeClient = selected?.type === 'client' ? selected.entry.client : null

  async function disconnect() {
    if (!activeSite) return
    const isV4 = activeSite.shim_version === 'v4'
    const action = isV4 ? 'shim_destruct_v4' : 'wpsc_disconnect'
    const message = isV4
      ? `Disconnect ${activeClient?.name || activeSite.site_url}?\n\nKotoIQ will:\n• Tell the plugin to clear its stored pubkey + App Password (signed /destruct)\n• Clear all v4 credentials locally\n\nThe plugin stays installed; the site admin can re-pair from WP admin if needed.`
      : `Disconnect ${activeClient?.name || activeSite.site_url}?\n\nKotoIQ will:\n• Tell the plugin to disable remote control\n• Clear the API key locally\n\nThe plugin stays installed; the site admin can re-enable from WP admin if needed.`
    if (!confirm(message)) return
    setBusy(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, site_id: activeSite.id }),
      })
      const data = await res.json()
      if (data.error) toast.error(data.error)
      else {
        const ok = isV4 ? data.remote_ok : data.plugin_disabled
        toast.success(ok ? 'Disconnected · plugin cleared its key' : 'Disconnected locally · plugin unreachable')
        await load()
      }
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  async function deleteSite() {
    if (!activeSite) return
    const label = activeClient?.name || activeSite.site_url
    if (!confirm(`Delete this site row?\n\nSite: ${label}\nURL: ${activeSite.site_url}\n\nKotoIQ will:\n• Best-effort tell the plugin to clear its pairing\n• Permanently delete the site row from the database\n• Forget all pair history, modules, and stored credentials\n\nThis cannot be undone. The plugin stays installed — re-add the site to re-pair.`)) return
    if (!confirm(`Really delete ${label}? Last chance.`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'shim_delete_site', site_id: activeSite.id }),
      })
      const data = await res.json()
      if (data.error) toast.error(data.error)
      else { toast.success('Site deleted'); setSelected(null); await load() }
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  function moduleEnabled(slug) {
    if (!activeSite?.wpsc_modules) return true
    const m = (activeSite.wpsc_modules || []).find(m => m?.slug === slug)
    if (!m) return true
    return m.enabled !== false
  }

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

      {/* Left rail */}
      <div style={{
        width: railOpen ? 340 : 56,
        transition: 'width .18s ease',
        borderRight: `1px solid ${LINE}`,
        background: '#ffffff',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        {!railOpen ? (
          <div style={{ padding: '14px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setRailOpen(true)}
              title={`Switch client (${rows.length})`}
              style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${LINE}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronRight size={14} color={PINK}/>
            </button>
            <div style={{ fontFamily: FB, fontSize: 10, fontWeight: 700, color: '#9ca3af', writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
              {rows.length} clients
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 16px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={13} color="#6b7280"/>
              <div style={{ flex: 1, fontFamily: FB, fontSize: 12, fontWeight: 800, color: NAVY }}>Clients ({rows.length})</div>
              <button onClick={() => setShowAdd(true)} title="Connect a WP site" style={addBtn()}>
                <Plus size={11}/> Connect
              </button>
              {selected && (
                <button onClick={() => setRailOpen(false)} title="Collapse list" style={{ ...mini(), padding: '4px 6px' }}>
                  <ChevronLeft size={11}/>
                </button>
              )}
            </div>
            <div style={{ padding: '0 16px 8px', fontSize: 11, color: '#9ca3af', fontFamily: FB, lineHeight: 1.4 }}>
              Active clients in your agency. Pair KotoIQ per client to unlock the tabs.
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
              {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                  <Loader2 size={14} className="spin"/> Loading…
                </div>
              ) : rows.length === 0 && orphans.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12, fontFamily: FB }}>
                  No active clients in this agency yet.
                </div>
              ) : (
                <>
                  {rows.map(r => (
                    <ClientCard
                      key={r.client.id}
                      entry={r}
                      selected={selected?.type === 'client' && selected.entry.client.id === r.client.id}
                      onClick={() => { setSelected({ type: 'client', entry: r }); setTab('overview'); onSiteSelected?.(r.site, r.client?.id) }}
                    />
                  ))}
                  {orphans.length > 0 && (
                    <>
                      <div style={{ padding: '12px 6px 6px', fontSize: 10, fontFamily: FB, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Unassigned sites ({orphans.length})
                      </div>
                      {orphans.map(s => (
                        <OrphanSiteCard
                          key={s.id}
                          site={s}
                          selected={selected?.type === 'orphan' && selected.site.id === s.id}
                          onClick={() => { setSelected({ type: 'orphan', site: s }); setTab('overview'); onSiteSelected?.(s) }}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: CREAM }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af', fontFamily: FB, fontSize: 13, padding: 40, textAlign: 'center' }}>
            <Plug size={32} color="#d1d5db" style={{ marginBottom: 12 }}/>
            <div style={{ fontSize: 14, fontFamily: FB, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Pick a client to manage their WordPress integration</div>
            <div style={{ maxWidth: 380 }}>
              Or switch to <strong>Fleet</strong> view from the top toggle to see every site at once.
            </div>
          </div>
        ) : (
          <>
            {/* Site sub-header */}
            <div style={{ padding: '14px 28px 0', borderBottom: `1px solid ${LINE}`, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FB, fontSize: 15, fontWeight: 800, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeClient?.name || (activeSite?.site_name || activeSite?.site_url)}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    {activeSite?.site_url ? (
                      <a href={activeSite.site_url} target="_blank" rel="noreferrer" style={{ color: T, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {activeSite.site_url.replace(/^https?:\/\//, '')} <ExternalLink size={10}/>
                      </a>
                    ) : activeClient?.website ? (
                      <span>website: {activeClient.website}</span>
                    ) : <span>no WP site yet</span>}
                    {activeSite?.wpsc_version && <span style={{ marginLeft: 6 }}>· KotoIQ v{activeSite.wpsc_version}</span>}
                  </div>
                </div>
                {activeSite ? <StatusPills site={activeSite}/> : null}
                {activeSite && (activeSite.shim_version === 'v4' || activeSite.wpsc_api_key) && (
                  <button onClick={disconnect} disabled={busy} style={mini({ color: PINK, borderColor: PINK })} title={activeSite.shim_version === 'v4' ? 'Clear the v4 pairing (signed /destruct)' : 'Disable remote control + clear keys'}>
                    <PowerOff size={11}/> Disconnect
                  </button>
                )}
                {activeSite && (
                  <button onClick={deleteSite} disabled={busy} style={mini({ color: '#dc2626', borderColor: '#fecaca' })} title="Permanently delete this site row">
                    <Trash2 size={11}/> Delete
                  </button>
                )}
              </div>

              {activeSite && (
                <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
                  {TABS.map(t => {
                    const Icon = t.icon
                    const active = tab === t.key
                    const enabled = moduleEnabled(t.slug)
                    return (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        title={enabled ? t.label : `${t.label} (module disabled on this site)`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '9px 14px', borderRadius: '8px 8px 0 0', border: 'none',
                          background: active ? CREAM : 'transparent',
                          color: active ? NAVY : (enabled ? '#9ca3af' : '#d1d5db'),
                          fontSize: 12, fontWeight: active ? 700 : 500, fontFamily: FB, cursor: 'pointer',
                          opacity: enabled ? 1 : 0.55,
                          whiteSpace: 'nowrap',
                          borderBottom: active ? `2px solid ${PINK}` : '2px solid transparent',
                          marginBottom: -1,
                        }}
                      >
                        <Icon size={12}/>{t.label}
                        {!enabled && active && <span style={{ fontSize: 9, color: AMB, marginLeft: 2 }}>(off)</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', background: CREAM }}>
              {activeSite ? (
                <WPSCConnectionGate site={activeSite} onPaired={load}>
                  {tab === 'guided'            && <GuidedSpine key={activeClient?.id || activeSite?.id} clientId={activeClient?.id} agencyId={effectiveAgency}/>}
                  {tab === 'overview'          && <OverviewPanel         site={activeSite} onSiteUpdated={load}/>}
                  {tab === 'topic_campaign'    && <TopicCampaignPanel    site={activeSite} client={activeClient}/>}
                  {tab === 'search_replace'    && <SearchReplacePanel    site={activeSite}/>}
                  {tab === 'snippets'          && <SnippetsPanel         site={activeSite}/>}
                  {tab === 'access'            && <AccessManagementPanel site={activeSite}/>}
                  {tab === 'elementor_builder' && <ElementorBuilderPanel site={activeSite}/>}
                  {tab === 'content_rotation'  && <ContentRotationPanel  site={activeSite}/>}
                  {tab === 'seo'               && <SEOPanel              site={activeSite}/>}
                  {tab === 'sync'              && <SyncPanel             site={activeSite}/>}
                </WPSCConnectionGate>
              ) : (
                <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${LINE}`, padding: 32, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
                  <Plug size={28} color={PINK} style={{ margin: '0 auto 12px' }}/>
                  <div style={{ fontFamily: FB, fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
                    No WP site connected for {activeClient?.name}
                  </div>
                  <div style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, lineHeight: 1.6, marginBottom: 24 }}>
                    Download the KotoIQ plugin, install on the WP site, open a pairing window, then click Connect. The dashboard issues the API key — you never paste anything.
                  </div>

                  {/* Step-by-step instructions */}
                  <div style={{ textAlign: 'left', background: '#FAF9F6', borderRadius: 12, padding: '20px 24px', marginBottom: 24, border: `1px solid ${LINE}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: FB, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Setup Steps</div>
                    {[
                      { step: '1', text: 'Download the KotoIQ plugin (v4.0.3) below' },
                      { step: '2', text: 'In WordPress admin: Plugins → Add New → Upload Plugin → upload the .zip, Activate' },
                      { step: '3', text: 'In WP admin → KotoIQ → Settings, click "Open pairing window" (10 min)' },
                      { step: '4', text: 'Click Connect a site below — enter URL, click Pair now' },
                    ].map(({ step, text }) => (
                      <div key={step} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 24, height: 24, borderRadius: 12, background: PINK, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{step}</div>
                        <div style={{ fontSize: 14, color: '#4A4566', fontFamily: FB, lineHeight: 1.5 }}>{text}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href="/api/kotoiq-shim-latest" download
                      style={{ ...primaryBtn(), textDecoration: 'none', display: 'inline-flex' }}>
                      <Download size={14}/> Download KotoIQ Plugin
                    </a>
                    <button onClick={() => setShowAdd(true)} style={mini({ borderColor: PINK, color: PINK })}>
                      <Plus size={13}/> Connect a site
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showAdd && (
        <AddSiteModal
          agencyId={effectiveAgency}
          prefillClient={activeClient}
          onClose={() => setShowAdd(false)}
          onAdded={async () => { setShowAdd(false); await load() }}
        />
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

function StatusPills({ site }) {
  if (!site) return <Pill color="#9ca3af" bg="#f3f4f6">No WP site</Pill>
  const isKotoIQ = site.wpsc_plugin === 'kotoiq'
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      <Pill color={site.connected ? GRN : '#9ca3af'} bg={site.connected ? `${GRN}15` : '#f3f4f6'}>
        Koto {site.connected ? 'live' : 'idle'}
      </Pill>
      {site.wpsc_api_key
        ? <Pill color={PINK} bg={`${PINK}15`}>{isKotoIQ ? 'KotoIQ paired' : 'WPSC paired'}</Pill>
        : <Pill color={AMB} bg={`${AMB}15`}>not paired</Pill>}
      {site.wpsc_version && <Pill color="#6b7280" bg="#f3f4f6">v{site.wpsc_version}</Pill>}
    </div>
  )
}

const Pill = ({ children, color, bg }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: FB, fontWeight: 700, color, background: bg, padding: '2px 6px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{children}</span>
)

function ClientCard({ entry, selected, onClick }) {
  const { client, site } = entry
  return (
    <div onClick={onClick} style={{ background: '#fff', borderRadius: 12, border: `1.5px solid ${selected ? PINK : LINE}`, padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      {client.logo_url
        ? <img src={client.logo_url} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover', background: '#f3f4f6', flexShrink: 0 }}/>
        : <div style={{ width: 30, height: 30, borderRadius: 6, background: `${PINK}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={14} color={PINK}/></div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FB, fontSize: 13, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
        <div style={{ marginTop: 3 }}><StatusPills site={site}/></div>
      </div>
    </div>
  )
}

function OrphanSiteCard({ site, selected, onClick }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', borderRadius: 12, border: `1.5px dashed ${selected ? PINK : LINE}`, padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <Globe size={16} color="#9ca3af" style={{ flexShrink: 0 }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FB, fontSize: 12, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.site_name || site.site_url}</div>
        <div style={{ marginTop: 3 }}><StatusPills site={site}/></div>
      </div>
    </div>
  )
}

function AddSiteModal({ agencyId, prefillClient, onClose, onAdded }) {
  // Mode: 'v4' (new, default — dashboard issues key) or 'v3' (legacy — paste API key)
  const [mode, setMode] = useState('v4')
  // V4 step: 1 = collect URL+name, 2 = install plugin + open window + pair
  const [step, setStep] = useState(1)

  const [siteUrl, setSiteUrl] = useState(prefillClient?.website ? (prefillClient.website.startsWith('http') ? prefillClient.website : `https://${prefillClient.website}`) : 'https://')
  const [siteName, setSiteName] = useState(prefillClient?.name || '')
  const [wpscKey, setWpscKey] = useState('')
  const [kotoKey, setKotoKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [errorHint, setErrorHint] = useState(null)

  function urlIsValid(u) {
    try {
      const url = new URL(u)
      return url.protocol === 'https:' && !!url.hostname && url.hostname.includes('.')
    } catch { return false }
  }

  async function pairV4() {
    if (!urlIsValid(siteUrl)) { toast.error('Enter a valid https:// site URL'); return }
    setBusy(true); setErrorMsg(null); setErrorHint(null)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'shim_pair_new_site',
          agency_id: agencyId,
          site_url: siteUrl.trim(),
          site_name: siteName.trim() || null,
          client_id: prefillClient?.id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Pair failed')
        setErrorHint(data.hint || null)
        setBusy(false)
        return
      }
      toast.success(`Paired on v4 · fingerprint ${(data.fingerprint || '').slice(0, 8)}…`)
      onAdded?.(data.site)
    } catch (e) {
      setErrorMsg(e.message)
    }
    setBusy(false)
  }

  async function submitLegacy() {
    if (!siteUrl || !wpscKey) { toast.error('Site URL and KotoIQ API key are required'); return }
    setBusy(true); setErrorMsg(null)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'wpsc_add_site',
          agency_id: agencyId,
          site_url: siteUrl.trim(),
          site_name: siteName.trim() || null,
          wpsc_api_key: wpscKey.trim(),
          koto_api_key: kotoKey.trim() || null,
          client_id: prefillClient?.id || null,
        }),
      })
      const data = await res.json()
      if (data.error) { setErrorMsg(data.error); setBusy(false); return }
      toast.success(`Added · KotoIQ v${data.version || '?'}`)
      onAdded?.(data.site)
    } catch (e) { setErrorMsg(e.message) }
    setBusy(false)
  }

  const host = (() => { try { return new URL(siteUrl).host } catch { return '' } })()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60, zIndex: 1000, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 600, width: '100%', padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,.18)', margin: '0 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Plus size={18} color={PINK}/>
          <div style={{ fontFamily: FB, fontSize: 17, fontWeight: 800, color: NAVY }}>
            {prefillClient ? `Connect a site for ${prefillClient.name}` : 'Add a WordPress site'}
          </div>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={16}/></button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, padding: 3, background: '#f3f4f6', borderRadius: 9, marginBottom: 14, marginTop: 8 }}>
          <button
            onClick={() => { setMode('v4'); setStep(1); setErrorMsg(null) }}
            style={modeTab(mode === 'v4')}>
            <ShieldCheck size={12}/> v4 KotoIQ (recommended)
          </button>
          <button
            onClick={() => { setMode('v3'); setErrorMsg(null) }}
            style={modeTab(mode === 'v3')}>
            <Plug size={12}/> Legacy v3 paste-key
          </button>
        </div>

        {/* ─── V4 FLOW ─── */}
        {mode === 'v4' && step === 1 && (
          <>
            <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, marginBottom: 14, lineHeight: 1.5 }}>
              The dashboard will generate the API key, sign an Ed25519 envelope, and pair the site. You won't paste any key.
            </div>
            <div style={{ marginBottom: 11 }}><Lbl>Site URL *</Lbl>
              <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com" autoFocus style={inp()}/>
            </div>
            <div style={{ marginBottom: 16 }}><Lbl>Friendly name (optional)</Lbl>
              <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="Acme Co." style={inp()}/>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} disabled={busy} style={secondaryBtn()}>Cancel</button>
              <button
                onClick={() => { if (!urlIsValid(siteUrl)) { toast.error('Enter a valid https:// site URL'); return } setStep(2) }}
                disabled={!urlIsValid(siteUrl)}
                style={primaryBtn({ disabled: !urlIsValid(siteUrl) })}>
                <ChevronRight size={13}/> Continue
              </button>
            </div>
          </>
        )}

        {mode === 'v4' && step === 2 && (
          <>
            <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, marginBottom: 14, lineHeight: 1.5 }}>
              Two steps on the WP site, then click <strong>Pair now</strong>.
            </div>

            {/* Step 1: install plugin */}
            <div style={stepCard()}>
              <div style={stepHeader()}>
                <span style={stepNum()}>1</span>
                <div style={{ fontFamily: FB, fontSize: 13, fontWeight: 700, color: NAVY }}>Install the KotoIQ plugin on {host}</div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, marginLeft: 30, marginBottom: 8 }}>
                Download the zip and upload via <em>WP admin → Plugins → Add New → Upload Plugin</em>. Activate it.
              </div>
              <div style={{ marginLeft: 30 }}>
                <a href="https://hellokoto.com/api/kotoiq-shim-latest" target="_blank" rel="noopener noreferrer" style={pillLink()}>
                  <Download size={11}/> kotoiq-latest.zip
                </a>
              </div>
            </div>

            {/* Step 2: open pairing window */}
            <div style={stepCard()}>
              <div style={stepHeader()}>
                <span style={stepNum()}>2</span>
                <div style={{ fontFamily: FB, fontSize: 13, fontWeight: 700, color: NAVY }}>Open a 10-minute pairing window</div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, marginLeft: 30, marginBottom: 8 }}>
                In WP admin: <strong>KotoIQ → Settings → Open pairing window</strong>. Or via wp-cli:
              </div>
              <code style={codeBlock()}>
                {`ssh user@${host || 'example.com'} 'wp option update kotoiq_shim_pairing_ready $(( $(date +%s) + 600 ))'`}
              </code>
            </div>

            {errorMsg && (
              <div style={errBox()}>
                <div style={{ fontFamily: FB, fontWeight: 700, color: '#b91c1c', marginBottom: 4 }}>Pair failed</div>
                <div style={{ fontSize: 12, color: '#7f1d1d', fontFamily: FB, lineHeight: 1.5 }}>{errorMsg}</div>
                {errorHint && <div style={{ fontSize: 11, color: '#991b1b', fontFamily: FB, marginTop: 6, fontStyle: 'italic' }}>{errorHint}</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 14 }}>
              <button onClick={() => { setStep(1); setErrorMsg(null) }} disabled={busy} style={secondaryBtn()}>
                <ChevronLeft size={13}/> Back
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} disabled={busy} style={secondaryBtn()}>Cancel</button>
                <button onClick={pairV4} disabled={busy} style={primaryBtn({ disabled: busy })}>
                  {busy ? <Loader2 size={13} className="spin"/> : <ShieldCheck size={13}/>} Pair now
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── LEGACY V3 FLOW ─── */}
        {mode === 'v3' && (
          <>
            <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, marginBottom: 14, lineHeight: 1.5 }}>
              For sites already running KotoIQ v3.x. Install <strong>KotoIQ</strong> on the site, then copy its API key from <em>WP admin → KotoIQ → Settings</em>.
            </div>

            <div style={{ marginBottom: 11 }}><Lbl>Site URL *</Lbl>
              <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com" autoFocus style={inp()}/>
            </div>
            <div style={{ marginBottom: 11 }}><Lbl>Friendly name (optional)</Lbl>
              <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="Acme Co." style={inp()}/>
            </div>
            <div style={{ marginBottom: 11 }}><Lbl>KotoIQ API key *</Lbl>
              <input value={wpscKey} onChange={e => setWpscKey(e.target.value)} placeholder="paste from WP admin → KotoIQ → Settings" style={{ ...inp(), fontFamily: 'ui-monospace,Menlo,monospace' }}/>
            </div>
            <div style={{ marginBottom: 14 }}><Lbl>Legacy Koto API key <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></Lbl>
              <input value={kotoKey} onChange={e => setKotoKey(e.target.value)} placeholder="only if the legacy koto plugin is still installed" style={{ ...inp(), fontFamily: 'ui-monospace,Menlo,monospace' }}/>
            </div>

            {errorMsg && (
              <div style={errBox()}>
                <div style={{ fontSize: 12, color: '#7f1d1d', fontFamily: FB, lineHeight: 1.5 }}>{errorMsg}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} disabled={busy} style={secondaryBtn()}>Cancel</button>
              <button onClick={submitLegacy} disabled={busy || !siteUrl || !wpscKey} style={primaryBtn({ disabled: busy || !siteUrl || !wpscKey })}>
                {busy ? <Loader2 size={13} className="spin"/> : <Plug size={13}/>} Verify &amp; connect
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const modeTab = (active) => ({
  flex: 1, padding: '8px 12px', borderRadius: 7, border: 'none',
  background: active ? '#fff' : 'transparent',
  color: active ? NAVY : '#6b7280',
  fontFamily: FB, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  boxShadow: active ? '0 1px 2px rgba(0,0,0,.05)' : 'none',
})
const stepCard = () => ({ background: '#f9fafb', borderRadius: 9, padding: 12, marginBottom: 10, border: `1px solid ${LINE}` })
const stepHeader = () => ({ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 })
const stepNum = () => ({ background: PINK, color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FB, fontSize: 11, fontWeight: 800, flexShrink: 0 })
const pillLink = () => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, background: '#fff', color: NAVY, fontFamily: FB, fontSize: 11, fontWeight: 700, textDecoration: 'none', border: `1px solid ${LINE}` })
const codeBlock = () => ({ display: 'block', marginLeft: 30, padding: '8px 10px', background: '#0f172a', color: '#e2e8f0', borderRadius: 6, fontSize: 11, fontFamily: 'ui-monospace,Menlo,monospace', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' })
const errBox = () => ({ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: 10, marginTop: 6 })
const secondaryBtn = () => ({ padding: '10px 16px', borderRadius: 9, border: `1.5px solid ${LINE}`, background: '#fff', color: NAVY, fontFamily: FB, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 })

const Lbl = ({ children }) => <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{children}</div>
const inp = (x = {}) => ({ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${LINE}`, fontSize: 13, fontFamily: FB, outline: 'none', background: '#fff', boxSizing: 'border-box', ...x })
const mini = (x = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: `1px solid ${x.borderColor || LINE}`, background: x.bg || '#fff', color: x.color || '#6b7280', fontFamily: FB, fontSize: 11, fontWeight: 700, cursor: 'pointer' })
const addBtn = () => ({ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', borderRadius: 6, border: 'none', background: PINK, color: '#fff', fontFamily: FB, fontSize: 11, fontWeight: 700, cursor: 'pointer' })
const primaryBtn = (x = {}) => ({ padding: '10px 18px', borderRadius: 9, border: 'none', background: PINK, color: '#fff', fontFamily: FB, fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: x.disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 })
