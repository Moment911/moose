"use client"
import { useState, useEffect } from 'react'
import { Search as SearchIcon, Code2, ShieldCheck, Edit3, Repeat, TrendingUp, Plug, Globe, Loader2, ExternalLink, Plus, X, User, PowerOff, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

import WPSCConnectionGate     from '../kotoiq/WPSCConnectionGate'
import SearchReplacePanel     from '../kotoiq/SearchReplacePanel'
import SnippetsPanel          from '../kotoiq/SnippetsPanel'
import AccessManagementPanel  from '../kotoiq/AccessManagementPanel'
import ElementorBuilderPanel  from '../kotoiq/ElementorBuilderPanel'
import ContentRotationPanel   from '../kotoiq/ContentRotationPanel'
import SEOPanel               from '../kotoiq/SEOPanel'
import SyncPanel              from '../kotoiq/SyncPanel'

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
  { key: 'search_replace',    label: 'Search & Replace', icon: SearchIcon,  slug: 'search-replace' },
  { key: 'snippets',          label: 'Snippets',         icon: Code2,       slug: 'snippets' },
  { key: 'access',            label: 'Access',           icon: ShieldCheck, slug: 'access' },
  { key: 'elementor_builder', label: 'Builder',          icon: Edit3,       slug: 'elementor-builder' },
  { key: 'content_rotation',  label: 'Rotation',         icon: Repeat,      slug: 'content-rotation' },
  { key: 'seo',               label: 'SEO',              icon: TrendingUp,  slug: 'seo' },
  { key: 'sync',              label: 'Sync',             icon: RefreshCw,   slug: 'sync' },
]

export default function ClientView({ preselectedSiteId, onClearSelection }) {
  const { agencyId, agencyName } = useAuth()
  const [rows, setRows] = useState([])
  const [orphans, setOrphans] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('search_replace')
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [railOpen, setRailOpen] = useState(!preselectedSiteId)

  const effectiveAgency = agencyId || FALLBACK_AGENCY

  useEffect(() => { if (agencyId) load() }, [agencyId])
  useEffect(() => { if (selected) setRailOpen(false) }, [selected?.entry?.client?.id, selected?.site?.id])

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

      // Apply preselectedSiteId on first load
      if (preselectedSiteId && !selected) {
        const found = (data.rows || []).find(r => r.site?.id === preselectedSiteId)
        if (found) setSelected({ type: 'client', entry: found })
        else {
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
    if (!confirm(`Disconnect ${activeClient?.name || activeSite.site_url}?\n\nKotoIQ will:\n• Tell the plugin to disable remote control\n• Clear the API key locally\n\nThe plugin stays installed; the site admin can re-enable from WP admin if needed.`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_disconnect', site_id: activeSite.id }),
      })
      const data = await res.json()
      if (data.error) toast.error(data.error)
      else { toast.success(data.plugin_disabled ? 'Disconnected · remote control off on the site' : 'Disconnected locally · plugin unreachable'); await load() }
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
                      onClick={() => setSelected({ type: 'client', entry: r })}
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
                          onClick={() => setSelected({ type: 'orphan', site: s })}
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
                {activeSite?.wpsc_api_key && (
                  <button onClick={disconnect} disabled={busy} style={mini({ color: PINK, borderColor: PINK })} title="Disable remote control + clear keys">
                    <PowerOff size={11}/> Disconnect
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
                    Download the KotoIQ plugin, install it on your client's WordPress site, then come back and click Connect to pair it.
                  </div>

                  {/* Step-by-step instructions */}
                  <div style={{ textAlign: 'left', background: '#FAF9F6', borderRadius: 12, padding: '20px 24px', marginBottom: 24, border: `1px solid ${LINE}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: FB, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Setup Steps</div>
                    {[
                      { step: '1', text: 'Download the KotoIQ WordPress plugin below' },
                      { step: '2', text: 'In WordPress admin, go to Plugins → Add New → Upload Plugin' },
                      { step: '3', text: 'Upload the .zip file and click Install Now, then Activate' },
                      { step: '4', text: 'Go to KotoIQ → Settings in WP admin and copy the API key' },
                      { step: '5', text: 'Come back here and click Connect to paste the key' },
                    ].map(({ step, text }) => (
                      <div key={step} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 24, height: 24, borderRadius: 12, background: PINK, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{step}</div>
                        <div style={{ fontSize: 14, color: '#4A4566', fontFamily: FB, lineHeight: 1.5 }}>{text}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href="/downloads/kotoiq-2.1.0.zip" download
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
  const [siteUrl, setSiteUrl] = useState(prefillClient?.website ? (prefillClient.website.startsWith('http') ? prefillClient.website : `https://${prefillClient.website}`) : 'https://')
  const [siteName, setSiteName] = useState(prefillClient?.name || '')
  const [wpscKey, setWpscKey] = useState('')
  const [kotoKey, setKotoKey] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!siteUrl || !wpscKey) { toast.error('Site URL and KotoIQ API key are required'); return }
    setBusy(true)
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
      if (data.error) { toast.error(data.error); setBusy(false); return }
      toast.success(`Added · KotoIQ v${data.version || '?'}`)
      onAdded?.(data.site)
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 540, width: '100%', padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Plus size={18} color={PINK}/>
          <div style={{ fontFamily: FB, fontSize: 17, fontWeight: 800, color: NAVY }}>
            {prefillClient ? `Connect a site for ${prefillClient.name}` : 'Add a WordPress site'}
          </div>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={16}/></button>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, marginBottom: 16, lineHeight: 1.5 }}>
          Install <strong>KotoIQ</strong> on the site, then copy its API key from <em>WP admin → KotoIQ → Settings</em>. The legacy Koto plugin key is optional.
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
        <div style={{ marginBottom: 18 }}><Lbl>Legacy Koto API key <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></Lbl>
          <input value={kotoKey} onChange={e => setKotoKey(e.target.value)} placeholder="only if the legacy koto plugin is still installed" style={{ ...inp(), fontFamily: 'ui-monospace,Menlo,monospace' }}/>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={busy} style={{ padding: '10px 16px', borderRadius: 9, border: `1.5px solid ${LINE}`, background: '#fff', color: NAVY, fontFamily: FB, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={busy || !siteUrl || !wpscKey} style={primaryBtn({ disabled: busy || !siteUrl || !wpscKey })}>
            {busy ? <Loader2 size={13} className="spin"/> : <Plug size={13}/>} Verify &amp; connect
          </button>
        </div>
      </div>
    </div>
  )
}

const Lbl = ({ children }) => <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{children}</div>
const inp = (x = {}) => ({ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${LINE}`, fontSize: 13, fontFamily: FB, outline: 'none', background: '#fff', boxSizing: 'border-box', ...x })
const mini = (x = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: `1px solid ${x.borderColor || LINE}`, background: x.bg || '#fff', color: x.color || '#6b7280', fontFamily: FB, fontSize: 11, fontWeight: 700, cursor: 'pointer' })
const addBtn = () => ({ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', borderRadius: 6, border: 'none', background: PINK, color: '#fff', fontFamily: FB, fontSize: 11, fontWeight: 700, cursor: 'pointer' })
const primaryBtn = (x = {}) => ({ padding: '10px 18px', borderRadius: 9, border: 'none', background: PINK, color: '#fff', fontFamily: FB, fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: x.disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 })
