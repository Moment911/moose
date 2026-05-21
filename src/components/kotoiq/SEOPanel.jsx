"use client"
import { useState, useEffect } from 'react'
import { TrendingUp, Loader2, RefreshCw, Globe, MapPin, AlertTriangle, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB, DESIGN, } from '../../lib/theme'

/**
 * SEOPanel — wraps the seo module's REST surface for a paired WP site.
 *
 * Read:
 *   • action=kotoiq_seo_agency_test → diagnostics + Yoast/Rank Math version
 *   • action=kotoiq_seo_pages       → published pages with SEO meta
 *
 * Write (one-click actions):
 *   • action=kotoiq_seo_sitemap_rebuild → rebuild Yoast/Rank Math sitemap + ping
 *   • action=kotoiq_seo_ping_engines    → ping Google + Bing only
 *
 * Page Factory (city/state landing pages, blog generation, content CRUD) lives
 * on dedicated platform pages — this panel is the per-site overview + quick
 * actions.
 */
export default function SEOPanel({ site }) {
  const [diag, setDiag] = useState(null)
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const moduleEntry = (site?.wpsc_modules || []).find(m => m?.slug === 'seo')
  const moduleEnabled = moduleEntry ? moduleEntry.enabled !== false : false

  useEffect(() => { if (site?.id && moduleEnabled) load() }, [site?.id, moduleEnabled])

  async function load() {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/wp', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'kotoiq_seo_agency_test', site_id: site.id }) }),
        fetch('/api/wp', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'kotoiq_seo_pages',        site_id: site.id }) }),
      ])
      const d1 = await r1.json()
      const d2 = await r2.json()
      if (d1.ok) setDiag(d1.data); else toast.error(d1.error || d1.data?.error || 'Diagnostics failed')
      if (d2.ok) setPages(d2.data?.pages || [])
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }

  async function rebuildSitemap() {
    setBusy(true)
    try {
      const r = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'kotoiq_seo_sitemap_rebuild', site_id: site.id }),
      })
      const d = await r.json()
      if (d.ok) toast.success(`Sitemap rebuilt · pinged ${Object.keys(d.data?.ping?.results || {}).length} engine(s)`)
      else toast.error(d.error || d.data?.error || 'Sitemap rebuild failed')
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  if (!moduleEnabled) {
    return (
      <div style={card()}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <AlertTriangle size={16} color={AMB}/>
          <div style={{ fontFamily:FH, fontWeight:800, color:BLK, fontSize:15 }}>SEO module is disabled</div>
        </div>
        <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>
          Enable it from the Control Center modules table to activate Yoast/Rank Math sync, page factory, sitemap rebuild, and auto-ping on publish.
        </div>
      </div>
    )
  }

  const seoPlugin = diag?.seo_plugin === 'yoast' ? `Yoast ${diag?.yoast_version}`
    : diag?.seo_plugin === 'rankmath' ? `Rank Math ${diag?.rankmath_version}`
    : 'None detected'

  const pagesWithMeta = pages.filter(p => p.has_seo_meta).length
  const totalPages = pages.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Connection + diagnostics */}
      <div style={card()}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <div style={iconWrap}><TrendingUp size={16} color={R}/></div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FH, fontWeight:800, color:BLK, fontSize:15 }}>SEO &amp; Page Factory</div>
            <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginTop:2 }}>
              {moduleEntry?.version && <code style={{ marginRight:6 }}>v{moduleEntry.version}</code>}
              Yoast/Rank Math integration · sitemap rebuild · auto-ping on publish.
            </div>
          </div>
          <button onClick={load} disabled={loading} style={miniBtn()}>
            {loading ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Refresh
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:8 }}>
          <Stat label="SEO plugin" value={seoPlugin}/>
          <Stat label="GSC connected" value={diag?.gsc_connected ? 'Yes' : 'No'} color={diag?.gsc_connected ? GRN : '#9ca3af'}/>
          <Stat label="Pages indexed" value={totalPages}/>
          <Stat label="With meta" value={`${pagesWithMeta}/${totalPages}`}/>
          <Stat label="Last sync" value={diag?.last_sync?.slice(0, 10) || 'never'}/>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
          <button onClick={rebuildSitemap} disabled={busy} style={primaryBtn()}>
            {busy ? <Loader2 size={11} className="spin"/> : <Globe size={11}/>} Rebuild sitemap &amp; ping
          </button>
          {diag?.site_url && (
            <a href={`${diag.site_url}/sitemap.xml`} target="_blank" rel="noreferrer" style={{ ...miniBtn(), textDecoration:'none' }}>
              <ExternalLink size={11}/> sitemap.xml
            </a>
          )}
          {!diag?.gsc_connected && (
            <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, padding:'7px 10px' }}>
              Tip: connect Google Search Console via Yoast / Rank Math / Site Kit for ranking data.
            </div>
          )}
        </div>
      </div>

      {/* Pages with SEO meta */}
      <div style={card({ padding:0, overflow:'hidden' })}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', fontFamily:FH, fontWeight:800, color:BLK, fontSize:13, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>SEO meta coverage</span>
          <span style={{ fontSize:11, color:'#6b7280', fontWeight:600 }}>{pagesWithMeta} / {totalPages} pages have meta description</span>
        </div>
        {loading ? (
          <div style={{ padding:30, textAlign:'center', color:'#9ca3af', fontSize:13 }}><Loader2 size={14} className="spin"/> Loading…</div>
        ) : pages.length === 0 ? (
          <div style={{ padding:30, textAlign:'center', color:'#9ca3af', fontSize:13, fontFamily:FB }}>No published pages yet.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:FB }}>
            <thead>
              <tr style={{ background:'#fafafa' }}>
                <th style={th()}>Title</th>
                <th style={th()}>Type</th>
                <th style={th()}>Focus keyword</th>
                <th style={th({ textAlign:'center', width:60 })}>Meta</th>
                <th style={th({ textAlign:'right' })}>Words</th>
              </tr>
            </thead>
            <tbody>
              {pages.slice(0, 50).map(p => (
                <tr key={p.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                  <td style={td()}>
                    <div style={{ fontFamily:FH, fontWeight:700, color:BLK }}>{p.title || '(untitled)'}</div>
                    {p.meta_desc && <div style={{ fontSize:11, color:'#6b7280', marginTop:2, lineHeight:1.4, maxWidth:420, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.meta_desc}</div>}
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:T, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:3, marginTop:2 }}>
                      view <ExternalLink size={9}/>
                    </a>
                  </td>
                  <td style={td()}><Pill color="#6b7280" bg="#f3f4f6">{p.type}</Pill></td>
                  <td style={td()}>{p.focus_kw ? <code style={{ fontSize:11, color:R }}>{p.focus_kw}</code> : <span style={{ color:'#9ca3af' }}>—</span>}</td>
                  <td style={{ ...td(), textAlign:'center' }}>
                    {p.has_seo_meta ? <CheckCircle size={14} color={GRN}/> : <XCircle size={14} color="#d1d5db"/>}
                  </td>
                  <td style={{ ...td(), textAlign:'right', color:'#6b7280' }}>{p.word_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pages.length > 50 && (
          <div style={{ padding:'10px 16px', borderTop:'1px solid #f1f5f9', fontSize:11, color:'#9ca3af', fontFamily:FB, textAlign:'center' }}>
            Showing first 50 of {pages.length} pages.
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}

const Pill = ({ children, color, bg }) => (
  <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:5, fontSize:10, fontFamily:FH, fontWeight:700, color, background:bg, textTransform:'uppercase', letterSpacing:'.04em' }}>{children}</span>
)
const Stat = ({ label, value, color = BLK }) => (
  <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 12px' }}>
    <div style={{ fontSize:14, fontWeight:800, color, fontFamily:FH, lineHeight:1.2 }}>{value}</div>
    <div style={{ fontSize:10, color:'#6b7280', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.05em', marginTop:3, fontWeight:700 }}>{label}</div>
  </div>
)
const card = (x={}) => ({ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:18, ...x })
const iconWrap = { width:30, height:30, borderRadius:8, background:`${R}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
const miniBtn = (x={}) => ({ display:'inline-flex', alignItems:'center', gap:4, padding:'7px 10px', borderRadius:7, border:`1px solid ${x.borderColor||'#e5e7eb'}`, background:'#fff', color:x.color||'#6b7280', fontFamily:FH, fontSize:11, fontWeight:700, cursor:'pointer' })
const primaryBtn = () => ({ padding:'8px 14px', borderRadius:8, border:'none', background:R, color:'#fff', fontFamily:FH, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 })
const th = (x={}) => ({ textAlign:'left', padding:'10px 12px', fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap', ...x })
const td = (x={}) => ({ padding:'10px 12px', verticalAlign:'top', ...x })
