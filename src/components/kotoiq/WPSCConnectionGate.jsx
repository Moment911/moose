"use client"
import { useState, useEffect } from 'react'
import { Plug, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB, DESIGN, } from '../../lib/theme'

/**
 * WPSCConnectionGate
 *
 * Lets children render when the site is paired via EITHER:
 *   - v4 shim (site.shim_version === 'v4') — modern flow, no API key paste
 *   - legacy v3 (site.wpsc_api_key set) — back-compat for sites already paired
 *
 * Otherwise shows the legacy paste-key pairing UI for v3.
 * For brand-new sites on the shim, the Add Site modal in ClientView/FleetView
 * handles the v4 pair flow — this gate just recognizes the result.
 *
 * Use around AccessManagementPanel, SnippetsPanel, SearchReplacePanel.
 */
export default function WPSCConnectionGate({ site, onPaired, children }) {
  const [detect, setDetect] = useState({ loading: true, detected: !!site?.wpsc_detected, meta: null, error: null })
  const [key, setKey] = useState('')
  const [pairing, setPairing] = useState(false)
  const pairedV4 = site?.shim_version === 'v4'
  const pairedV3 = !!site?.wpsc_api_key
  const paired = pairedV4 || pairedV3

  useEffect(() => { if (site?.id) detectNow() }, [site?.id])

  async function detectNow() {
    setDetect(d => ({ ...d, loading: true }))
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_detect', site_id: site.id }),
      })
      const data = await res.json()
      setDetect({ loading: false, detected: !!data.detected, meta: data.meta || null, error: data.error || null })
    } catch (e) {
      setDetect({ loading: false, detected: false, meta: null, error: e.message })
    }
  }

  async function pair() {
    if (!key.trim()) { toast.error('Paste the WPSimpleCode API key'); return }
    setPairing(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_pair', site_id: site.id, wpsc_api_key: key.trim() }),
      })
      const data = await res.json()
      if (!data.paired) {
        toast.error(data.error || 'Pairing failed')
      } else {
        toast.success('Paired')
        setKey('')
        onPaired?.()
      }
    } catch (e) { toast.error(e.message) }
    setPairing(false)
  }

  async function unpair() {
    if (!confirm('Disconnect WPSimpleCode from this site? Re-pairing needs the API key again.')) return
    await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'wpsc_clear_key', site_id: site.id }),
    })
    onPaired?.()
  }

  if (paired) {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:`${GRN}10`,border:`1px solid ${GRN}30`,borderRadius:9}}>
          <CheckCircle2 size={14} color={GRN}/>
          <div style={{flex:1,fontFamily:FH,fontSize:12,fontWeight:600,color:BLK}}>
            {pairedV4
              ? <>Paired on v4 shim · fingerprint <code style={{fontSize:11,opacity:.7}}>{site?.dashboard_pubkey_fingerprint?.slice(0,8) || '—'}…</code></>
              : <>WPSimpleCode (v3) paired{detect.meta?.version?` · v${detect.meta.version}`:''}</>}
          </div>
          {pairedV3 && <button onClick={detectNow} style={miniBtn()}>Re-check</button>}
          {pairedV3 && <button onClick={unpair} style={miniBtn({color:R,borderColor:R})}><Trash2 size={10}/> Unpair</button>}
        </div>
        {pairedV4 && (
          <div style={{padding:'10px 12px',background:`${AMB}10`,border:`1px solid ${AMB}30`,borderRadius:9,fontSize:12,fontFamily:FB,color:BLK,lineHeight:1.5}}>
            <strong>Note:</strong> The panels below still call the legacy v3 endpoints. They'll be migrated to v4 shim verbs in a follow-up. If you see "deprecated action" or "wpsc_*" errors, that's why — the gate is letting you through, the per-panel routing hasn't caught up yet.
          </div>
        )}
        {children}
      </div>
    )
  }

  return (
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:24,maxWidth:680,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
        <Plug size={18} color={R}/>
        <div style={{fontFamily:FH,fontSize:16,fontWeight:800,color:BLK}}>Pair the KotoIQ plugin</div>
      </div>
      <div style={{fontSize:13,color:'#6b7280',fontFamily:FB,marginBottom:14,lineHeight:1.5}}>
        One plugin per site: <strong>KotoIQ</strong>. It's a thin authenticated RPC shim — all SEO, snippets, search & replace, access, builder, sitemap, redirects, and rotation logic live in the Koto dashboard.
        <br/><br/>
        <strong>This site ({site?.site_url?.replace(/^https?:\/\//,'')})</strong> isn't paired yet. Install the KotoIQ plugin, open a 10-minute pairing window in WP admin, then pair from the dashboard.
      </div>

      <ol style={{paddingLeft:20,fontSize:13,color:BLK,fontFamily:FB,lineHeight:1.7,margin:'0 0 14px'}}>
        <li>Download <a href="/downloads/kotoiq-shim-4.0.3.zip" download style={{color:R,fontWeight:700}}>kotoiq-shim-4.0.3.zip</a> and upload via <em>WP Admin → Plugins → Add New → Upload Plugin</em>. Activate.</li>
        <li>WP Admin → <strong>KotoIQ → Settings → Open pairing window</strong> (10 minutes).</li>
        <li>Back here, click <strong>Pair now</strong> below. The dashboard generates the API key and signs the Ed25519 envelope.</li>
      </ol>

      <div style={{padding:'10px 12px',background:'#f9fafb',borderRadius:9,marginBottom:14,display:'flex',gap:10,alignItems:'center'}}>
        {detect.loading
          ? <Loader2 size={14} className="spin" color="#9ca3af"/>
          : detect.detected
            ? <CheckCircle2 size={14} color={GRN}/>
            : <AlertTriangle size={14} color={AMB}/>}
        <div style={{flex:1,fontSize:12,fontFamily:FB,color:BLK}}>
          {detect.loading ? 'Checking plugin install…'
            : detect.detected ? <>KotoIQ plugin detected{detect.meta?.version?` (v${detect.meta.version})`:''} — ready to pair.</>
            : <>KotoIQ plugin not detected on site. Install &amp; activate first.</>}
        </div>
        <button onClick={detectNow} style={miniBtn()}>Re-check</button>
      </div>

      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button
          onClick={async () => {
            setPairing(true)
            try {
              const res = await fetch('/api/wp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'shim_pair_new_site',
                  agency_id: site.agency_id,
                  site_url: site.site_url,
                  site_name: site.site_name || null,
                  client_id: site.client_id || null,
                }),
              })
              const data = await res.json()
              if (!res.ok || data.error) {
                toast.error(data.hint || data.error || 'Pair failed')
              } else {
                toast.success(`Paired on v4 · fingerprint ${(data.fingerprint||'').slice(0,8)}…`)
                onPaired?.()
              }
            } catch (e) { toast.error(e.message) }
            setPairing(false)
          }}
          disabled={pairing}
          style={{padding:'10px 18px',borderRadius:9,border:'none',background:R,color:'#fff',fontFamily:FH,fontWeight:800,fontSize:13,cursor:'pointer',opacity:pairing?0.5:1,display:'flex',alignItems:'center',gap:6}}
        >
          {pairing ? <Loader2 size={13} className="spin"/> : <Plug size={13}/>}
          Pair now
        </button>
      </div>

      {pairedV3 === false && site?.wpsc_api_key && (
        <div style={{marginTop:14,padding:'8px 12px',background:'#f9fafb',borderRadius:9,fontSize:11,color:'#6b7280',fontFamily:FB}}>
          Legacy v3 paste-key flow is still available via the global "Add a WordPress site" modal if needed for back-compat.
        </div>
      )}

      {site?.site_url && (
        <a href={`${site.site_url}/wp-admin/admin.php?page=wpsimplecode-settings`} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:12,fontSize:12,color:T,fontFamily:FH,fontWeight:700,textDecoration:'none'}}>
          Open WPSimpleCode Settings on the site <ExternalLink size={10}/>
        </a>
      )}
    </div>
  )
}

const miniBtn = (x={}) => ({display:'inline-flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,border:`1px solid ${x.borderColor||'#e5e7eb'}`,background:x.bg||'#fff',color:x.color||'#6b7280',fontSize:11,fontFamily:FH,fontWeight:600,cursor:'pointer'})
