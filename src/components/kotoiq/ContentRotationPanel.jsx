"use client"
import { useState } from 'react'
import { Repeat, Copy, Loader2, Trash2, AlertTriangle, ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

/**
 * ContentRotationPanel — shortcode reference + per-post cache lookup/clear.
 *
 * The [koto_rotate] shortcode picks 1 of N content variants per page-load and
 * caches the selection per post for a TTL. The clear-cache action proxies to
 * DELETE /wp-json/wpsimplecode/v1/builder/rotation-cache/{post_id}.
 *
 * Backed by:
 *   • action=kotoiq_rotation_cache_get  → GET  /builder/rotation-cache/{id}
 *   • action=kotoiq_rotation_cache_del  → DELETE /builder/rotation-cache/{id}
 */
export default function ContentRotationPanel({ site }) {
  const [postId, setPostId] = useState('')
  const [busy, setBusy] = useState(false)
  const [cache, setCache] = useState(null) // { post_id, cached_selections: { section: index } }
  const [debugOpen, setDebugOpen] = useState(false) // Cache lookup is dev-only; hidden by default

  const moduleEntry = (site?.wpsc_modules || []).find(m => m?.slug === 'content-rotation')
  const moduleEnabled = moduleEntry ? moduleEntry.enabled !== false : false

  async function lookup() {
    if (!postId) { toast.error('Enter a post ID'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'kotoiq_rotation_cache_get', site_id: site.id, post_id: Number(postId) }),
      })
      const d = await r.json()
      if (!d.ok) { toast.error(d.error || d.data?.error || 'Lookup failed'); setCache(null) }
      else setCache(d.data || null)
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  async function clearCache() {
    if (!postId) return
    if (!confirm(`Clear all rotation-cache entries for post ${postId}? Next page-load will re-roll variant selections.`)) return
    setBusy(true)
    try {
      const r = await fetch('/api/wp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'kotoiq_rotation_cache_del', site_id: site.id, post_id: Number(postId) }),
      })
      const d = await r.json()
      if (d.ok) { toast.success('Rotation cache cleared'); setCache({ post_id: Number(postId), cached_selections: {} }) }
      else toast.error(d.error || d.data?.error || 'Clear failed')
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  const SHORTCODE = `[koto_rotate cache="7d" section="intro"]
  Variant 1 HTML
  |||KOTO_VARIANT|||
  Variant 2 HTML
  |||KOTO_VARIANT|||
  Variant 3 HTML
[/koto_rotate]`

  if (!moduleEnabled) {
    return (
      <div style={card()}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <AlertTriangle size={16} color={AMB}/>
          <div style={{ fontFamily:FH, fontWeight:800, color:BLK, fontSize:15 }}>Content Rotation module is disabled</div>
        </div>
        <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>
          Enable it from the Control Center modules table to activate the [koto_rotate] shortcode on this site.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Reference card */}
      <div style={card()}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={iconWrap}><Repeat size={16} color={R}/></div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FH, fontWeight:800, color:BLK, fontSize:15 }}>Content Rotation</div>
            <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, marginTop:2 }}>
              {moduleEntry?.version && <code style={{ marginRight:6 }}>v{moduleEntry.version}</code>}
              The [koto_rotate] shortcode picks one of N variants per page-load, caches per post for a TTL.
            </div>
          </div>
        </div>
        <div style={{ background:'#0b1220', borderRadius:8, padding:14, position:'relative' }}>
          <pre style={{ margin:0, fontFamily:'ui-monospace,Menlo,monospace', fontSize:11, color:'#e2e8f0', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{SHORTCODE}</pre>
          <button onClick={() => { navigator.clipboard.writeText(SHORTCODE); toast.success('Copied') }} style={{ position:'absolute', top:8, right:8, background:'rgba(255,255,255,.08)', color:'#e2e8f0', border:'1px solid rgba(255,255,255,.12)', padding:'4px 8px', borderRadius:6, fontFamily:FH, fontSize:10, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4 }}>
            <Copy size={10}/> Copy
          </button>
        </div>
        <div style={{ marginTop:12, fontSize:11, color:'#6b7280', fontFamily:FB, lineHeight:1.6 }}>
          <strong style={{ color:BLK }}>Attributes:</strong>
          {' '}<code>cache</code> — TTL (e.g. <code>7d</code>, <code>24h</code>, <code>0</code> for no cache).
          {' '}<code>section</code> — sub-key for multiple rotators per post.
          {' '}<code>pin</code> — force a specific 1-indexed variant (for QA).
        </div>
      </div>

      {/* Cache lookup — hidden behind disclosure (developer-only tool) */}
      <div style={{ ...card({ padding:0, overflow:'hidden' }) }}>
        <button
          onClick={() => setDebugOpen(o => !o)}
          style={{
            width:'100%', display:'flex', alignItems:'center', gap:8,
            padding:'14px 18px', border:'none', background:'transparent',
            cursor:'pointer', textAlign:'left',
          }}
          aria-expanded={debugOpen}
        >
          {debugOpen ? <ChevronDown size={14} color="#6b7280"/> : <ChevronRight size={14} color="#6b7280"/>}
          <Wrench size={13} color="#6b7280"/>
          <span style={{ fontFamily:FH, fontWeight:800, color:BLK, fontSize:13 }}>Cache debugging</span>
          <span style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginLeft:4 }}>
            — look up or clear the cached variant for a specific post (QA / troubleshooting)
          </span>
        </button>

        {debugOpen && (
          <div style={{ padding:'4px 18px 18px', borderTop:'1px solid #f1f5f9' }}>
            <p style={{ fontSize:12, color:'#6b7280', fontFamily:FB, lineHeight:1.5, margin:'10px 0 12px' }}>
              When <code>[koto_rotate]</code> renders on a post, the picked variant is cached per-post for the TTL. Use this to inspect or clear that cache for a specific post — useful when QA'ing a page or forcing a re-roll.
              {' '}<strong style={{ color:BLK }}>Find the post ID</strong> in WP admin: edit the post, the URL contains <code>?post=142&</code>.
            </p>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input
                value={postId}
                onChange={e => setPostId(e.target.value)}
                placeholder="Post ID (e.g. 142)"
                style={{ flex:1, maxWidth:220, padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none' }}
              />
              <button onClick={lookup} disabled={busy || !postId} style={primaryBtn()}>
                {busy ? <Loader2 size={11} className="spin"/> : null} Look up
              </button>
              {cache && Object.keys(cache.cached_selections || {}).length > 0 && (
                <button onClick={clearCache} disabled={busy} style={miniBtn({ color:R, borderColor:R })}>
                  <Trash2 size={10}/> Clear all
                </button>
              )}
            </div>

            {cache && (
              <div style={{ marginTop:14, borderTop:'1px solid #f1f5f9', paddingTop:12 }}>
                <div style={{ fontSize:11, color:'#6b7280', fontFamily:FH, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                  Cached selections for post {cache.post_id}
                </div>
                {Object.keys(cache.cached_selections || {}).length === 0 ? (
                  <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, fontStyle:'italic' }}>No cached selections — next visit will pick fresh variants.</div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:FB }}>
                    <thead><tr><th style={th()}>Section</th><th style={th()}>Cached variant index</th></tr></thead>
                    <tbody>
                      {Object.entries(cache.cached_selections).map(([section, idx]) => (
                        <tr key={section} style={{ borderTop:'1px solid #f1f5f9' }}>
                          <td style={td()}><code style={{ fontSize:11 }}>{section}</code></td>
                          <td style={td()}><Pill color={T} bg={`${T}15`}>variant {idx + 1}</Pill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Used-on auto-discovery — placeholder until the WP-side endpoint ships */}
      <div style={{ ...card(), background:'#fafafa', border:'1px dashed #e5e7eb' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Repeat size={13} color="#9ca3af"/>
          <div style={{ fontFamily:FH, fontWeight:700, color:'#6b7280', fontSize:12 }}>Where it's running</div>
        </div>
        <p style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, lineHeight:1.5, marginTop:8 }}>
          Auto-discovery of posts using <code>[koto_rotate]</code> ships in the next KotoIQ release. For now, search your WP admin for the shortcode or use the Cache debugging tool above with a known post ID.
        </p>
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
const card = (x={}) => ({ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:18, ...x })
const iconWrap = { width:30, height:30, borderRadius:8, background:`${R}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
const miniBtn = (x={}) => ({ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 10px', borderRadius:7, border:`1px solid ${x.borderColor||'#e5e7eb'}`, background:'#fff', color:x.color||'#6b7280', fontFamily:FH, fontSize:11, fontWeight:700, cursor:'pointer' })
const primaryBtn = () => ({ padding:'8px 16px', borderRadius:8, border:'none', background:R, color:'#fff', fontFamily:FH, fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 })
const th = (x={}) => ({ textAlign:'left', padding:'8px 10px', fontFamily:FH, fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', ...x })
const td = (x={}) => ({ padding:'8px 10px', ...x })
