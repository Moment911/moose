"use client"
import { useState, useEffect } from 'react'
import { Code2, Plug, Globe, Loader2, CheckCircle, XCircle, Search as SearchIcon, ShieldCheck, ExternalLink, RefreshCw, Plus, X } from 'lucide-react'
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

function Dot({ on }) {
  return <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:on?GRN:'#d1d5db', boxShadow:on?`0 0 0 3px ${GRN}25`:'none', flexShrink:0 }}/>
}

function SiteCard({ site, selected, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${selected?R:'#e5e7eb'}`, padding:'12px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
      <Dot on={site.connected}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{site.site_name || site.site_url}</div>
        <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{site.clients?.name || site.site_url.replace(/^https?:\/\//,'')}</div>
      </div>
      {site.wpsc_api_key
        ? <span title="Paired" style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontFamily:FH, fontWeight:700, color:GRN, background:`${GRN}15`, padding:'2px 6px', borderRadius:6 }}><Plug size={9}/> WPSC</span>
        : null}
    </div>
  )
}

export default function WPSimpleCodePage() {
  const { agencyId } = useAuth()
  const [sites, setSites] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('search_replace')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { if (agencyId) loadSites() }, [agencyId])

  async function loadSites() {
    setLoading(true)
    try {
      const res = await fetch(`/api/wp?agency_id=${agencyId || '00000000-0000-0000-0000-000000000099'}`)
      const data = await res.json()
      setSites(data.sites || [])
      if (data.sites?.length && !selected) setSelected(data.sites[0])
      else if (selected) {
        const fresh = data.sites?.find(s => s.id === selected.id)
        if (fresh) setSelected(fresh)
      }
    } finally {
      setLoading(false)
    }
  }

  function pickSite(s) { setSelected(s) }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ padding:'18px 28px', borderBottom:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:`${R}12`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Code2 size={20} color={R}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:BLK, lineHeight:1.1 }}>WPSimpleCode</div>
            <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginTop:2 }}>
              Site-wide search &amp; replace, role-aware code snippets, and access management — across every paired WordPress site.
            </div>
          </div>
          <button onClick={loadSites} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontFamily:FH, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <RefreshCw size={12}/> Refresh
          </button>
        </div>

        {/* Body — site list (left) + content (right) */}
        <div style={{ flex:1, display:'flex', minHeight:0 }}>

          {/* Site list rail */}
          <div style={{ width:320, borderRight:'1px solid #e5e7eb', background:'#fafafa', display:'flex', flexDirection:'column', minHeight:0 }}>
            <div style={{ padding:'14px 16px 6px', display:'flex', alignItems:'center', gap:6 }}>
              <Globe size={13} color="#6b7280"/>
              <div style={{ flex:1, fontFamily:FH, fontSize:12, fontWeight:700, color:'#374151' }}>Your WordPress sites ({sites.length})</div>
              <button onClick={() => setShowAdd(true)} title="Add a site" style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 8px', borderRadius:6, border:'none', background:R, color:'#fff', fontFamily:FH, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                <Plus size={11}/> Add
              </button>
            </div>
            <div style={{ padding:'0 16px 10px', fontSize:11, color:'#9ca3af', fontFamily:FB, lineHeight:1.4 }}>
              Shared with SEO → WP Plugin. Pair WPSimpleCode per site to unlock the tabs.
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'0 12px 12px' }}>
              {loading ? (
                <div style={{ padding:24, textAlign:'center', color:'#9ca3af', fontSize:12 }}><Loader2 size={14} className="spin"/> Loading…</div>
              ) : sites.length === 0 ? (
                <div style={{ padding:24, textAlign:'center', color:'#9ca3af', fontSize:12, fontFamily:FB }}>
                  No WordPress sites connected yet. Connect a site from <strong>SEO → WP Plugin</strong> first.
                </div>
              ) : sites.map(s => (
                <SiteCard key={s.id} site={s} selected={selected?.id === s.id} onClick={() => pickSite(s)}/>
              ))}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>
            {selected ? (
              <>
                {/* Site sub-header + tabs */}
                <div style={{ padding:'14px 28px 0', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selected.site_name || selected.site_url}</div>
                      <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, display:'flex', alignItems:'center', gap:6 }}>
                        <a href={selected.site_url} target="_blank" rel="noreferrer" style={{ color:T, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:3 }}>
                          {selected.site_url.replace(/^https?:\/\//,'')} <ExternalLink size={10}/>
                        </a>
                        {selected.wpsc_version && <span style={{ marginLeft:6 }}>· WPSimpleCode v{selected.wpsc_version}</span>}
                      </div>
                    </div>
                    {selected.wpsc_api_key
                      ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontFamily:FH, fontWeight:700, color:GRN, background:`${GRN}15`, padding:'4px 8px', borderRadius:8 }}><CheckCircle size={11}/> Paired</span>
                      : <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontFamily:FH, fontWeight:700, color:AMB, background:`${AMB}15`, padding:'4px 8px', borderRadius:8 }}><XCircle size={11}/> Not paired</span>}
                  </div>
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
                </div>

                {/* Tab content */}
                <div style={{ flex:1, overflowY:'auto', padding:'20px 28px', background:GRY }}>
                  <WPSCConnectionGate site={selected} onPaired={loadSites}>
                    {tab === 'search_replace' && <SearchReplacePanel site={selected}/>}
                    {tab === 'snippets'       && <SnippetsPanel site={selected}/>}
                    {tab === 'access'         && <AccessManagementPanel site={selected}/>}
                  </WPSCConnectionGate>
                </div>
              </>
            ) : (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontFamily:FB, fontSize:13 }}>
                Pick a site to manage.
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && <AddSiteModal agencyId={agencyId} onClose={() => setShowAdd(false)} onAdded={async (newSite) => { setShowAdd(false); await loadSites(); if (newSite?.id) setSelected(newSite) }}/>}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

function AddSiteModal({ agencyId, onClose, onAdded }) {
  const [siteUrl, setSiteUrl] = useState('https://')
  const [siteName, setSiteName] = useState('')
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
          agency_id: agencyId || '00000000-0000-0000-0000-000000000099',
          site_url: siteUrl.trim(),
          site_name: siteName.trim() || null,
          wpsc_api_key: wpscKey.trim(),
          koto_api_key: kotoKey.trim() || null,
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
          <div style={{ fontFamily:FH, fontSize:17, fontWeight:800, color:BLK }}>Add a WordPress site</div>
          <div style={{ flex:1 }}/>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#9ca3af', cursor:'pointer' }}><X size={16}/></button>
        </div>
        <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginBottom:16, lineHeight:1.5 }}>
          Install <strong>WPSimpleCode</strong> on the WP site first, then copy its API key from <em>WPSimpleCode → Settings</em>. The Koto plugin key is optional (only needed if you also use the SEO/builder features).
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
          <button onClick={submit} disabled={busy || !siteUrl || !wpscKey} style={{ padding:'10px 18px', borderRadius:9, border:'none', background:R, color:'#fff', fontFamily:FH, fontSize:13, fontWeight:800, cursor:'pointer', opacity:(busy||!siteUrl||!wpscKey)?0.5:1, display:'flex', alignItems:'center', gap:6 }}>
            {busy ? <Loader2 size={13} className="spin"/> : <Plug size={13}/>}
            Verify & add
          </button>
        </div>
      </div>
    </div>
  )
}

const Lbl = ({ children }) => <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK, marginBottom:5, textTransform:'uppercase', letterSpacing:'.04em' }}>{children}</div>
const inp = (x={}) => ({ width:'100%', padding:'10px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', background:'#fff', boxSizing:'border-box', ...x })
