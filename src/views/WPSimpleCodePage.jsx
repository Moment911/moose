"use client"
import { useState, useEffect } from 'react'
import { Code2, Plug, Globe, Loader2, CheckCircle, XCircle, Search as SearchIcon, ShieldCheck, ExternalLink, RefreshCw, Plus, X, User, PowerOff, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

import WPSCConnectionGate from '../components/kotoiq/WPSCConnectionGate'
import SearchReplacePanel from '../components/kotoiq/SearchReplacePanel'
import SnippetsPanel from '../components/kotoiq/SnippetsPanel'
import AccessManagementPanel from '../components/kotoiq/AccessManagementPanel'

const TABS = [
  { key: 'search_replace', label: 'Search & Replace', icon: SearchIcon },
  { key: 'snippets',       label: 'Snippets',         icon: Code2 },
  { key: 'access',         label: 'Access',           icon: ShieldCheck },
]

const FALLBACK_AGENCY = '00000000-0000-0000-0000-000000000099'

function StatusPills({ site }) {
  if (!site) return <Pill color="#9ca3af" bg="#f3f4f6">No WP site</Pill>
  return (
    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
      <Pill color={site.connected ? GRN : '#9ca3af'} bg={site.connected ? `${GRN}15` : '#f3f4f6'}>
        Koto {site.connected ? 'live' : 'idle'}
      </Pill>
      {site.wpsc_api_key
        ? <Pill color={R} bg={`${R}15`}>WPSC paired</Pill>
        : <Pill color={AMB} bg={`${AMB}15`}>WPSC not paired</Pill>}
    </div>
  )
}

const Pill = ({ children, color, bg }) => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontFamily:FH, fontWeight:700, color, background:bg, padding:'2px 6px', borderRadius:6, textTransform:'uppercase', letterSpacing:'.04em' }}>{children}</span>
)

function ClientCard({ entry, selected, onClick }) {
  const { client, site } = entry
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${selected?R:'#e5e7eb'}`, padding:'10px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
      {client.logo_url
        ? <img src={client.logo_url} alt="" style={{ width:30, height:30, borderRadius:6, objectFit:'cover', background:'#f3f4f6', flexShrink:0 }}/>
        : <div style={{ width:30, height:30, borderRadius:6, background:`${R}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><User size={14} color={R}/></div>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{client.name}</div>
        <div style={{ marginTop:3 }}><StatusPills site={site}/></div>
      </div>
    </div>
  )
}

function OrphanSiteCard({ site, selected, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:12, border:`1.5px dashed ${selected?R:'#e5e7eb'}`, padding:'10px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
      <Globe size={16} color="#9ca3af" style={{ flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{site.site_name || site.site_url}</div>
        <div style={{ marginTop:3 }}><StatusPills site={site}/></div>
      </div>
    </div>
  )
}

export default function WPSimpleCodePage() {
  const { agencyId, agencyName, fullName } = useAuth()
  const [rows, setRows] = useState([])         // [{ client, site }]
  const [orphans, setOrphans] = useState([])   // sites with no client_id
  const [selected, setSelected] = useState(null) // { type:'client', entry } | { type:'orphan', site }
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('search_replace')
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [railOpen, setRailOpen] = useState(true)

  useEffect(() => { if (agencyId) load() }, [agencyId])

  // When the user picks a client/site, auto-collapse the rail so the content can take focus.
  useEffect(() => { if (selected) setRailOpen(false) }, [selected?.entry?.client?.id, selected?.site?.id])

  const effectiveAgency = agencyId || FALLBACK_AGENCY

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_list_clients', agency_id: effectiveAgency }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setLoading(false); return }
      setRows(data.rows || [])
      setOrphans(data.orphans || [])
      // Keep selection sticky across refresh
      if (selected) {
        if (selected.type === 'client') {
          const fresh = (data.rows || []).find(r => r.client.id === selected.entry.client.id)
          setSelected(fresh ? { type:'client', entry: fresh } : null)
        } else if (selected.type === 'orphan') {
          const fresh = (data.orphans || []).find(s => s.id === selected.site.id)
          setSelected(fresh ? { type:'orphan', site: fresh } : null)
        }
      }
    } finally { setLoading(false) }
  }

  const activeSite = selected?.type === 'client' ? selected.entry.site : selected?.type === 'orphan' ? selected.site : null
  const activeClient = selected?.type === 'client' ? selected.entry.client : null

  async function disconnect() {
    if (!activeSite) return
    if (!confirm(`Disconnect ${activeClient?.name || activeSite.site_url}?\n\nKoto will:\n• Tell WPSimpleCode to disable remote control\n• Clear the API key locally\n\nThe plugin stays installed; the site admin can re-enable from WP admin if needed.`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_disconnect', site_id: activeSite.id }),
      })
      const data = await res.json()
      if (data.error) toast.error(data.error)
      else {
        toast.success(data.plugin_disabled ? 'Disconnected · remote control off on the site' : 'Disconnected locally · plugin unreachable')
        await load()
      }
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>

        <div style={{ padding:'14px 28px', borderBottom:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:`${R}12`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Code2 size={18} color={R}/>
          </div>

          {/* Breadcrumb: WPSimpleCode › Agency › Client */}
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
            <span style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK }}>WPSimpleCode</span>
            {agencyName && <>
              <span style={{ color:'#d1d5db', fontSize:14 }}>›</span>
              <span style={{ fontFamily:FH, fontSize:13, fontWeight:600, color:'#6b7280' }}>{agencyName}</span>
            </>}
            {(() => {
              const c = selected?.type === 'client' ? selected.entry.client : null
              const s = selected?.type === 'orphan' ? selected.site : null
              const label = c ? c.name : s ? (s.site_name || s.site_url.replace(/^https?:\/\//,'')) : null
              if (!label) return null
              return <>
                <span style={{ color:'#d1d5db', fontSize:14 }}>›</span>
                <span style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:R, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:280 }}>{label}</span>
              </>
            })()}
          </div>

          {fullName && (
            <span style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>Signed in as <strong style={{ color:'#6b7280' }}>{fullName}</strong></span>
          )}
          <button onClick={load} style={mini()}><RefreshCw size={12}/> Refresh</button>
        </div>

        <div style={{ flex:1, display:'flex', minHeight:0 }}>

          {/* Left rail — clients (+ orphan sites) — collapsible */}
          <div style={{ width: railOpen ? 340 : 56, transition:'width .18s ease', borderRight:'1px solid #e5e7eb', background:'#fafafa', display:'flex', flexDirection:'column', minHeight:0 }}>
            {!railOpen ? (
              <div style={{ padding:'14px 8px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                <button onClick={() => setRailOpen(true)} title={`Switch client (${rows.length})`} style={{ width:36, height:36, borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                  <ChevronRight size={14} color={R}/>
                </button>
                <div style={{ fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', writingMode:'vertical-rl', transform:'rotate(180deg)', letterSpacing:'.05em', textTransform:'uppercase' }}>
                  {rows.length} clients
                </div>
              </div>
            ) : (
              <>
            <div style={{ padding:'14px 16px 4px', display:'flex', alignItems:'center', gap:6 }}>
              <User size={13} color="#6b7280"/>
              <div style={{ flex:1, fontFamily:FH, fontSize:12, fontWeight:700, color:'#374151' }}>Clients ({rows.length})</div>
              <button onClick={() => setShowAdd(true)} title="Connect a WP site" style={addBtn()}>
                <Plus size={11}/> Connect
              </button>
              {selected && <button onClick={() => setRailOpen(false)} title="Collapse list" style={{ ...mini(), padding:'4px 6px' }}><ChevronLeft size={11}/></button>}
            </div>
            <div style={{ padding:'0 16px 8px', fontSize:11, color:'#9ca3af', fontFamily:FB, lineHeight:1.4 }}>
              Active clients in your agency. Pair WPSimpleCode per client to unlock the tabs.
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'0 12px 12px' }}>
              {loading ? (
                <div style={{ padding:24, textAlign:'center', color:'#9ca3af', fontSize:12 }}><Loader2 size={14} className="spin"/> Loading…</div>
              ) : rows.length === 0 && orphans.length === 0 ? (
                <div style={{ padding:24, textAlign:'center', color:'#9ca3af', fontSize:12, fontFamily:FB }}>
                  No active clients in this agency yet.
                </div>
              ) : (
                <>
                  {rows.map(r => (
                    <ClientCard
                      key={r.client.id}
                      entry={r}
                      selected={selected?.type === 'client' && selected.entry.client.id === r.client.id}
                      onClick={() => setSelected({ type:'client', entry: r })}
                    />
                  ))}

                  {orphans.length > 0 && (
                    <>
                      <div style={{ padding:'12px 6px 6px', fontSize:10, fontFamily:FH, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em' }}>
                        Unassigned sites ({orphans.length})
                      </div>
                      {orphans.map(s => (
                        <OrphanSiteCard
                          key={s.id}
                          site={s}
                          selected={selected?.type === 'orphan' && selected.site.id === s.id}
                          onClick={() => setSelected({ type:'orphan', site: s })}
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

          {/* Content */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>
            {!selected ? (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontFamily:FB, fontSize:13 }}>
                Pick a client to manage their WordPress integration.
              </div>
            ) : (
              <>
                {/* Sub-header */}
                <div style={{ padding:'14px 28px 0', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {activeClient?.name || (activeSite?.site_name || activeSite?.site_url)}
                      </div>
                      <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                        {activeSite?.site_url ? (
                          <a href={activeSite.site_url} target="_blank" rel="noreferrer" style={{ color:T, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:3 }}>
                            {activeSite.site_url.replace(/^https?:\/\//,'')} <ExternalLink size={10}/>
                          </a>
                        ) : activeClient?.website ? (
                          <span>website: {activeClient.website}</span>
                        ) : <span>no WP site yet</span>}
                        {activeSite?.wpsc_version && <span style={{ marginLeft:6 }}>· WPSimpleCode v{activeSite.wpsc_version}</span>}
                      </div>
                    </div>

                    {activeSite ? <StatusPills site={activeSite}/> : null}

                    {activeSite?.wpsc_api_key && (
                      <button onClick={disconnect} disabled={busy} style={mini({ color:R, borderColor:R })} title="Disable remote control + clear keys">
                        <PowerOff size={11}/> Disconnect
                      </button>
                    )}
                  </div>

                  {activeSite && (
                    <div style={{ display:'flex', gap:2 }}>
                      {TABS.map(t => {
                        const Icon = t.icon
                        const active = tab === t.key
                        return (
                          <button key={t.key} onClick={() => setTab(t.key)} style={{
                            display:'flex', alignItems:'center', gap:6,
                            padding:'9px 16px', borderRadius:'8px 8px 0 0', border:'none',
                            background: active ? GRY : 'transparent',
                            color: active ? BLK : '#9ca3af',
                            fontSize:12, fontWeight: active ? 700 : 500, fontFamily:FH, cursor:'pointer',
                          }}>
                            <Icon size={12}/>{t.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Tab content (only if a site exists) */}
                <div style={{ flex:1, overflowY:'auto', padding:'20px 28px', background:GRY }}>
                  {activeSite ? (
                    <WPSCConnectionGate site={activeSite} onPaired={load}>
                      {tab === 'search_replace' && <SearchReplacePanel site={activeSite}/>}
                      {tab === 'snippets'       && <SnippetsPanel site={activeSite}/>}
                      {tab === 'access'         && <AccessManagementPanel site={activeSite}/>}
                    </WPSCConnectionGate>
                  ) : (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:28, maxWidth:560, margin:'0 auto', textAlign:'center' }}>
                      <Plug size={28} color={R} style={{ margin:'0 auto 10px' }}/>
                      <div style={{ fontFamily:FH, fontSize:17, fontWeight:800, color:BLK, marginBottom:6 }}>No WP site connected for {activeClient?.name}</div>
                      <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, lineHeight:1.5, marginBottom:18 }}>
                        Install <strong>WPSimpleCode</strong> on this client's site, then click <em>Connect</em> to pair it.
                      </div>
                      <button onClick={() => setShowAdd(true)} style={primaryBtn()}>
                        <Plus size={13}/> Connect a site for this client
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showAdd && <AddSiteModal agencyId={effectiveAgency} prefillClient={activeClient} onClose={() => setShowAdd(false)} onAdded={async () => { setShowAdd(false); await load() }}/>}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
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
    if (!siteUrl || !wpscKey) { toast.error('Site URL and WPSimpleCode API key are required'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      toast.success(`Added · WPSimpleCode v${data.version || '?'}`)
      onAdded?.(data.site)
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.45)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80, zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:14, maxWidth:540, width:'100%', padding:22, boxShadow:'0 30px 80px rgba(0,0,0,.18)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <Plus size={18} color={R}/>
          <div style={{ fontFamily:FH, fontSize:17, fontWeight:800, color:BLK }}>
            {prefillClient ? `Connect a site for ${prefillClient.name}` : 'Add a WordPress site'}
          </div>
          <div style={{ flex:1 }}/>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#9ca3af', cursor:'pointer' }}><X size={16}/></button>
        </div>
        <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginBottom:16, lineHeight:1.5 }}>
          Install <strong>WPSimpleCode</strong> on the site, then copy its API key from <em>WPSimpleCode → Settings</em>. The Koto plugin key is optional.
        </div>

        <div style={{ marginBottom:11 }}>
          <Lbl>Site URL *</Lbl>
          <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com" autoFocus style={inp()}/>
        </div>
        <div style={{ marginBottom:11 }}>
          <Lbl>Friendly name (optional)</Lbl>
          <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="Acme Co." style={inp()}/>
        </div>
        <div style={{ marginBottom:11 }}>
          <Lbl>WPSimpleCode API key *</Lbl>
          <input value={wpscKey} onChange={e => setWpscKey(e.target.value)} placeholder="paste from WP admin → WPSimpleCode → Settings" style={{ ...inp(), fontFamily:'ui-monospace,Menlo,monospace' }}/>
        </div>
        <div style={{ marginBottom:18 }}>
          <Lbl>Koto plugin API key <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></Lbl>
          <input value={kotoKey} onChange={e => setKotoKey(e.target.value)} placeholder="only if you also use Koto plugin features" style={{ ...inp(), fontFamily:'ui-monospace,Menlo,monospace' }}/>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} disabled={busy} style={{ padding:'10px 16px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', color:BLK, fontFamily:FH, fontSize:13, fontWeight:700, cursor:'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={busy || !siteUrl || !wpscKey} style={primaryBtn({ disabled: busy || !siteUrl || !wpscKey })}>
            {busy ? <Loader2 size={13} className="spin"/> : <Plug size={13}/>}
            Verify & connect
          </button>
        </div>
      </div>
    </div>
  )
}

const Lbl = ({ children }) => <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK, marginBottom:5, textTransform:'uppercase', letterSpacing:'.04em' }}>{children}</div>
const inp = (x={}) => ({ width:'100%', padding:'10px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', background:'#fff', boxSizing:'border-box', ...x })
const mini = (x={}) => ({ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 10px', borderRadius:7, border:`1px solid ${x.borderColor||'#e5e7eb'}`, background:x.bg||'#fff', color:x.color||'#6b7280', fontFamily:FH, fontSize:11, fontWeight:700, cursor:'pointer' })
const addBtn = () => ({ display:'flex', alignItems:'center', gap:3, padding:'4px 8px', borderRadius:6, border:'none', background:R, color:'#fff', fontFamily:FH, fontSize:11, fontWeight:700, cursor:'pointer' })
const primaryBtn = (x={}) => ({ padding:'10px 18px', borderRadius:9, border:'none', background:R, color:'#fff', fontFamily:FH, fontSize:13, fontWeight:800, cursor:'pointer', opacity:x.disabled?0.5:1, display:'inline-flex', alignItems:'center', gap:6 })
