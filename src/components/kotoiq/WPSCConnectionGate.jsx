"use client"
import { useState, useEffect } from 'react'
import { Plug, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

/**
 * WPSCConnectionGate
 *
 * Renders children only when the site has a WPSimpleCode API key paired.
 * Otherwise shows a pairing UI: detect status + paste-key form.
 *
 * Use around AccessManagementPanel, SnippetsPanel, SearchReplacePanel.
 */
export default function WPSCConnectionGate({ site, onPaired, children }) {
  const [detect, setDetect] = useState({ loading: true, detected: !!site?.wpsc_detected, meta: null, error: null })
  const [key, setKey] = useState('')
  const [pairing, setPairing] = useState(false)
  const paired = !!site?.wpsc_api_key

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
            WPSimpleCode paired{detect.meta?.version?` · v${detect.meta.version}`:''}
          </div>
          <button onClick={detectNow} style={miniBtn()}>Re-check</button>
          <button onClick={unpair} style={miniBtn({color:R,borderColor:R})}><Trash2 size={10}/> Unpair</button>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:24,maxWidth:680,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
        <Plug size={18} color={R}/>
        <div style={{fontFamily:FH,fontSize:16,fontWeight:800,color:BLK}}>Pair WPSimpleCode</div>
      </div>
      <div style={{fontSize:13,color:'#6b7280',fontFamily:FB,marginBottom:14,lineHeight:1.5}}>
        WPSimpleCode is a free WordPress plugin that powers search &amp; replace, snippets, and access management.
        Install it on this site, then paste its API key below.
      </div>

      <div style={{padding:'10px 12px',background:'#f9fafb',borderRadius:9,marginBottom:14,display:'flex',gap:10,alignItems:'center'}}>
        {detect.loading
          ? <Loader2 size={14} className="spin" color="#9ca3af"/>
          : detect.detected
            ? <CheckCircle2 size={14} color={GRN}/>
            : <AlertTriangle size={14} color={AMB}/>}
        <div style={{flex:1,fontSize:12,fontFamily:FB,color:BLK}}>
          {detect.loading ? 'Checking site for WPSimpleCode…'
            : detect.detected ? <>Detected on this site{detect.meta?.version?` (v${detect.meta.version})`:''}.</>
            : <>Not detected. Install &amp; activate the plugin first.</>}
        </div>
        <button onClick={detectNow} style={miniBtn()}>Re-check</button>
      </div>

      <ol style={{paddingLeft:20,fontSize:13,color:BLK,fontFamily:FB,lineHeight:1.7,margin:'0 0 14px'}}>
        <li>Install the <strong>WPSimpleCode</strong> plugin on <code>{site?.site_url}</code> and activate it.</li>
        <li>Open <em>WPSimpleCode → Settings</em> in WP admin and enable <strong>Remote Control</strong>.</li>
        <li>(Optional but recommended) Set <em>Allowed host</em> to <code>{typeof window !== 'undefined' ? window.location.origin : 'your koto host'}</code>.</li>
        <li>Copy the <strong>API key</strong> shown on that page and paste it below.</li>
      </ol>

      <div style={{display:'flex',gap:8}}>
        <input
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="WPSimpleCode API key"
          style={{flex:1,padding:'10px 12px',borderRadius:9,border:'1.5px solid #e5e7eb',fontSize:13,fontFamily:'ui-monospace,Menlo,monospace',outline:'none'}}
        />
        <button onClick={pair} disabled={pairing||!key.trim()} style={{padding:'10px 16px',borderRadius:9,border:'none',background:R,color:'#fff',fontFamily:FH,fontWeight:800,fontSize:13,cursor:'pointer',opacity:(pairing||!key.trim())?0.5:1,display:'flex',alignItems:'center',gap:6}}>
          {pairing ? <Loader2 size={13} className="spin"/> : <Plug size={13}/>}
          Pair
        </button>
      </div>

      {site?.site_url && (
        <a href={`${site.site_url}/wp-admin/admin.php?page=wpsimplecode-settings`} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:12,fontSize:12,color:T,fontFamily:FH,fontWeight:700,textDecoration:'none'}}>
          Open WPSimpleCode Settings on the site <ExternalLink size={10}/>
        </a>
      )}
    </div>
  )
}

const miniBtn = (x={}) => ({display:'inline-flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,border:`1px solid ${x.borderColor||'#e5e7eb'}`,background:x.bg||'#fff',color:x.color||'#6b7280',fontSize:11,fontFamily:FH,fontWeight:600,cursor:'pointer'})
