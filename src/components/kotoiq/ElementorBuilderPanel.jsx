"use client"
import { useState, useEffect } from 'react'
import { Edit3, Loader2, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

/**
 * ElementorBuilderPanel — read-only inventory of Elementor-edited pages for a
 * paired WP site. Writes (PUT _elementor_data, clone) live in the dashboard's
 * page-factory pipeline (src/lib/builder/*) and don't run from here.
 *
 * Backed by:
 *   • site.wpsc_modules[].slug === 'elementor-builder' → version detection
 *   • /api/wp action=kotoiq_builder_pages → proxies GET /wpsimplecode/v1/builder/pages
 */
export default function ElementorBuilderPanel({ site }) {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [detect, setDetect] = useState(null) // { elementor, elementor_version, elementor_pro, ... }

  const moduleEntry = (site?.wpsc_modules || []).find(m => m?.slug === 'elementor-builder')
  const moduleEnabled = moduleEntry ? moduleEntry.enabled !== false : false

  useEffect(() => { if (site?.id && moduleEnabled) load() }, [site?.id, moduleEnabled])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'kotoiq_builder_pages', site_id: site.id }),
      })
      const d = await r.json()
      if (!d.ok) { setError(d.error || d.data?.error || 'Could not list builder pages'); setPages([]) }
      else {
        setPages(d.data?.pages || [])
        setDetect(d.detect || null)
      }
    } catch (e) { setError(e.message); setPages([]) }
    setLoading(false)
  }

  if (!moduleEnabled) {
    return (
      <div style={card()}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <AlertTriangle size={16} color={AMB}/>
          <div style={{ fontFamily:FH, fontWeight:800, color:BLK, fontSize:15 }}>Elementor Builder module is disabled</div>
        </div>
        <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, lineHeight:1.5 }}>
          Enable it from the Control Center modules table, or in WP admin → KotoIQ → Settings → Modules.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Detection card */}
      <div style={card()}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={iconWrap}><Edit3 size={16} color={R}/></div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FH, fontWeight:800, color:BLK, fontSize:15 }}>Elementor Builder</div>
            <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginTop:2 }}>
              {moduleEntry?.version && <code style={{ marginRight:6 }}>v{moduleEntry.version}</code>}
              Reads + writes Elementor pages on this site via REST.
            </div>
          </div>
          <button onClick={load} disabled={loading} style={miniBtn()}>
            {loading ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>} Refresh
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8, marginTop:8 }}>
          <Stat label="Pages found" value={loading ? '…' : pages.length}/>
          <Stat label="Elementor" value={detect?.elementor ? detect.elementor_version || 'active' : 'unknown'}/>
          <Stat label="Elementor Pro" value={detect?.elementor_pro ? detect.elementor_pro_version || 'active' : '—'}/>
          <Stat label="Theme" value={detect?.theme_name || '—'}/>
        </div>
      </div>

      {/* Pages list */}
      <div style={card({ padding:0, overflow:'hidden' })}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', fontFamily:FH, fontWeight:800, color:BLK, fontSize:13 }}>
          Builder pages
        </div>
        {error ? (
          <div style={{ padding:20, fontSize:13, color:R, fontFamily:FB }}>{error}</div>
        ) : loading ? (
          <div style={{ padding:30, textAlign:'center', color:'#9ca3af', fontSize:13 }}><Loader2 size={14} className="spin"/> Loading…</div>
        ) : pages.length === 0 ? (
          <div style={{ padding:30, textAlign:'center', color:'#9ca3af', fontSize:13, fontFamily:FB }}>
            No Elementor-edited pages on this site yet.
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:FB }}>
            <thead>
              <tr style={{ background:'#fafafa' }}>
                <th style={th()}>Title</th>
                <th style={th()}>Slug</th>
                <th style={th()}>Status</th>
                <th style={th()}>Elementor</th>
                <th style={th({ textAlign:'right' })}>Updated</th>
                <th style={th({ width:50 })}/>
              </tr>
            </thead>
            <tbody>
              {pages.map(p => (
                <tr key={p.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                  <td style={td()}>
                    <div style={{ fontFamily:FH, fontWeight:700, color:BLK }}>{p.title || '(untitled)'}</div>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:T, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:3 }}>
                      view <ExternalLink size={9}/>
                    </a>
                  </td>
                  <td style={td()}><code style={{ fontSize:11, color:'#6b7280' }}>{p.slug}</code></td>
                  <td style={td()}>
                    <Pill color={p.status === 'publish' ? GRN : AMB} bg={p.status === 'publish' ? `${GRN}15` : `${AMB}15`}>{p.status}</Pill>
                  </td>
                  <td style={td()}>{p.elementor_version ? <code style={{ fontSize:11 }}>v{p.elementor_version}</code> : <span style={{ color:'#9ca3af' }}>—</span>}</td>
                  <td style={{ ...td(), textAlign:'right', color:'#6b7280', fontSize:11 }}>{p.updated_at?.slice(0, 10)}</td>
                  <td style={{ ...td(), textAlign:'right' }}>
                    <a href={`${site.site_url}/wp-admin/post.php?post=${p.id}&action=elementor`} target="_blank" rel="noreferrer" title="Edit in Elementor" style={miniBtn({ textDecoration:'none' })}>
                      <Edit3 size={10}/>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
const Stat = ({ label, value }) => (
  <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 12px' }}>
    <div style={{ fontSize:16, fontWeight:800, color:BLK, fontFamily:FH, lineHeight:1.1 }}>{value}</div>
    <div style={{ fontSize:10, color:'#6b7280', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.05em', marginTop:3, fontWeight:700 }}>{label}</div>
  </div>
)
const card = (x={}) => ({ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:18, ...x })
const iconWrap = { width:30, height:30, borderRadius:8, background:`${R}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
const miniBtn = (x={}) => ({ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 10px', borderRadius:7, border:`1px solid ${x.borderColor||'#e5e7eb'}`, background:'#fff', color:x.color||'#6b7280', fontFamily:FH, fontSize:11, fontWeight:700, cursor:'pointer', ...x })
const th = (x={}) => ({ textAlign:x.textAlign||'left', padding:'10px 12px', fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap', ...x })
const td = (x={}) => ({ padding:'10px 12px', verticalAlign:'top', ...x })
