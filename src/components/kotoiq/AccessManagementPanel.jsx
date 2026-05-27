"use client"
import { useState, useEffect } from 'react'
import { ShieldCheck, Save, UploadCloud, Camera, History, Undo2, Loader2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB, DESIGN, } from '../../lib/theme'

const FEATURES = [
  { key: 'php_snippets',       label: 'PHP Snippets',      levels: [['', '—'], ['full','Full PHP'], ['text','Text-only'], ['none','None']] },
  { key: 'snippet_management', label: 'Snippet Mgmt',      levels: [['', '—'], ['granted','Granted'], ['denied','Denied']] },
  { key: 'file_editor',        label: 'File Editor',       levels: [['', '—'], ['granted','Granted'], ['denied','Denied']] },
  { key: 'theme_editor',       label: 'Theme Editor',      levels: [['', '—'], ['granted','Granted'], ['denied','Denied']] },
  { key: 'plugin_editor',      label: 'Plugin Editor',     levels: [['', '—'], ['granted','Granted'], ['denied','Denied']] },
  { key: 'pixels',             label: 'Conversion Pixels', levels: [['', '—'], ['granted','Granted'], ['denied','Denied']] },
  { key: 'access_management',  label: 'Access Mgmt',       levels: [['', '—'], ['granted','Granted'], ['denied','Denied']] },
]

const PRESETS = {
  Lockdown: {
    administrator: { php_snippets:'full', snippet_management:'granted', file_editor:'granted', theme_editor:'granted', plugin_editor:'granted', pixels:'granted', access_management:'granted' },
    editor:        { php_snippets:'none', snippet_management:'denied',  file_editor:'denied',  theme_editor:'denied',  plugin_editor:'denied',  pixels:'denied',  access_management:'denied' },
    author:        { php_snippets:'none', snippet_management:'denied',  file_editor:'denied',  theme_editor:'denied',  plugin_editor:'denied',  pixels:'denied',  access_management:'denied' },
    contributor:   { php_snippets:'none', snippet_management:'denied',  file_editor:'denied',  theme_editor:'denied',  plugin_editor:'denied',  pixels:'denied',  access_management:'denied' },
    subscriber:    { php_snippets:'none', snippet_management:'denied',  file_editor:'denied',  theme_editor:'denied',  plugin_editor:'denied',  pixels:'denied',  access_management:'denied' },
  },
  Standard: {
    administrator: { php_snippets:'full', snippet_management:'granted', file_editor:'granted', theme_editor:'granted', plugin_editor:'granted', pixels:'granted', access_management:'granted' },
    editor:        { php_snippets:'text', snippet_management:'granted', file_editor:'denied',  theme_editor:'denied',  plugin_editor:'denied',  pixels:'granted', access_management:'denied' },
  },
  Open: {
    administrator: { php_snippets:'full', snippet_management:'granted', file_editor:'granted', theme_editor:'granted', plugin_editor:'granted', pixels:'granted', access_management:'granted' },
    editor:        { php_snippets:'full', snippet_management:'granted', file_editor:'granted', theme_editor:'granted', plugin_editor:'granted', pixels:'granted', access_management:'denied' },
  },
}

export default function AccessManagementPanel({ site }) {
  const [roles, setRoles] = useState({})
  const [policy, setPolicy] = useState({})
  const [livePolicy, setLivePolicy] = useState({})
  const [globalDisableFileEdit, setGlobalDisableFileEdit] = useState(false)
  const [snapshots, setSnapshots] = useState([])
  const [stored, setStored] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { if (site?.id) load() }, [site?.id, site?.wpsc_api_key])

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'am_load', site_id: site.id }),
      })
      const data = await res.json()
      if (!data.remote_ok) setError(data.error || 'Could not reach plugin')
      setRoles(data.roles || {})
      setLivePolicy(data.live_policy || {})
      setGlobalDisableFileEdit(!!data.global_disable_file_edit)
      setStored(data.stored || null)
      setPolicy(data.stored?.policy || data.live_policy || {})
      await loadSnapshots()
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function loadSnapshots() {
    const res = await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'am_list_snapshots', site_id: site.id }),
    })
    const data = await res.json()
    setSnapshots(data.snapshots || [])
  }

  function setCell(role, feature, value) {
    setPolicy(p => ({
      ...p,
      [role]: { ...(p[role] || {}), [feature]: value || undefined },
    }))
  }

  function applyPreset(name) {
    if (!confirm(`Replace current draft with "${name}" preset?`)) return
    setPolicy({ ...PRESETS[name] })
    toast(`Loaded ${name} preset (not yet applied)`, { icon: '✏️' })
  }

  async function save() {
    setBusy(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'am_save', site_id: site.id,
          policy, file_editor_disabled_globally: globalDisableFileEdit,
        }),
      })
      const data = await res.json()
      if (data.error) toast.error(data.error)
      else { toast.success('Saved (not yet applied)'); setStored(data.policy) }
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  async function apply() {
    if (!confirm('Apply this policy to the live WP site? Caps will be added/removed on each role.')) return
    setBusy(true)
    try {
      await save()
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'am_apply', site_id: site.id }),
      })
      const data = await res.json()
      if (data.error) toast.error(data.error)
      else { toast.success('Applied'); await load() }
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  async function snapshot() {
    const note = prompt('Snapshot note (optional)') || ''
    setBusy(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'am_snapshot', site_id: site.id, note }),
      })
      const data = await res.json()
      if (data.error) toast.error(data.error)
      else { toast.success('Snapshot taken'); await loadSnapshots() }
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  async function revertTo(snap) {
    if (!confirm(`Revert all roles to the snapshot from ${new Date(snap.created_at).toLocaleString()}?`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'am_revert', site_id: site.id, snapshot_id: snap.id }),
      })
      const data = await res.json()
      if (data.error) toast.error(data.error)
      else { toast.success('Reverted'); await load() }
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  if (loading) return <Centered><Loader2 className="spin" size={18}/> Loading roles…</Centered>
  if (error && !Object.keys(roles).length) return <Centered><AlertTriangle color={AMB} size={20}/><div style={{marginTop:8,fontFamily:FB,color:'#6b7280',fontSize:13}}>{error}</div><div style={{marginTop:8,fontSize:12,color:'#9ca3af'}}>Pair the KotoIQ plugin on this site first.</div></Centered>

  const roleSlugs = Object.keys(roles)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <ShieldCheck size={16} color={R}/>
          <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK}}>Permission Matrix</div>
          <div style={{flex:1}}/>
          <div style={{display:'flex',gap:6}}>
            {Object.keys(PRESETS).map(p => (
              <button key={p} onClick={() => applyPreset(p)} style={mini()}>{p}</button>
            ))}
          </div>
        </div>
        <div style={{fontSize:12,color:'#6b7280',fontFamily:FB,marginBottom:10}}>
          Edits stay as a draft. Save persists to Koto; Apply pushes to the live site (auto-saves first).
        </div>

        <div style={{padding:'8px 12px',background:globalDisableFileEdit?`${R}10`:'#f9fafb',borderRadius:9,marginBottom:14,display:'flex',alignItems:'center',gap:10,border:`1px solid ${globalDisableFileEdit?R:'#e5e7eb'}`}}>
          <input type="checkbox" checked={globalDisableFileEdit} onChange={e => setGlobalDisableFileEdit(e.target.checked)} style={{margin:0}}/>
          <div style={{flex:1}}>
            <div style={{fontFamily:FH,fontSize:12,fontWeight:700,color:BLK}}>Disable file editor globally</div>
            <div style={{fontSize:11,color:'#6b7280',fontFamily:FB}}>Mirrors <code>DISALLOW_FILE_EDIT</code> for every role without touching wp-config.php.</div>
          </div>
        </div>

        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:FB}}>
            <thead>
              <tr>
                <th style={th()}>Role</th>
                {FEATURES.map(f => <th key={f.key} style={th()}>{f.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {roleSlugs.map(slug => (
                <tr key={slug} style={{borderTop:'1px solid #f1f5f9'}}>
                  <td style={td()}>
                    <div style={{fontFamily:FH,fontWeight:700,color:BLK,fontSize:12}}>{roles[slug]?.name || slug}</div>
                    <div style={{fontSize:10,color:'#9ca3af',fontFamily:'ui-monospace,Menlo,monospace'}}>{slug}</div>
                  </td>
                  {FEATURES.map(f => {
                    const v = policy[slug]?.[f.key] || ''
                    const liveV = livePolicy[slug]?.[f.key] || ''
                    const drift = v !== liveV
                    return (
                      <td key={f.key} style={td()}>
                        <select value={v} onChange={e => setCell(slug, f.key, e.target.value)} style={sel(drift)}>
                          {f.levels.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                        </select>
                        {drift && <div style={{fontSize:9,color:AMB,marginTop:2,fontFamily:FH}}>drift: live={liveV||'unset'}</div>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{display:'flex',gap:8,marginTop:14}}>
          <button onClick={save} disabled={busy} style={btn({bg:'#fff',color:BLK,border:'1.5px solid #e5e7eb'})}><Save size={13}/> Save draft</button>
          <button onClick={apply} disabled={busy} style={btn({bg:R,color:'#fff'})}><UploadCloud size={13}/> Apply to site</button>
          <div style={{flex:1}}/>
          <button onClick={snapshot} disabled={busy} style={btn({bg:'#fff',color:'#6b7280',border:'1.5px solid #e5e7eb'})}><Camera size={13}/> Snapshot now</button>
        </div>
      </div>

      <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <History size={14} color="#6b7280"/>
          <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK}}>Snapshots</div>
        </div>
        {snapshots.length === 0 ? (
          <div style={{padding:18,textAlign:'center',color:'#9ca3af',fontSize:12,fontFamily:FB}}>No snapshots yet. Snapshot before applying for a 1-click revert.</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {snapshots.map(s => (
              <div key={s.id} style={{padding:'8px 10px',background:'#fafafa',borderRadius:8,border:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:10}}>
                <div style={{flex:1,fontFamily:FH,fontSize:12,fontWeight:600,color:BLK}}>{s.note || '(no note)'}</div>
                <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{new Date(s.created_at).toLocaleString()}</div>
                <button onClick={() => revertTo(s)} style={mini({color:AMB,borderColor:AMB})}><Undo2 size={10}/> Revert</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const Centered = ({children}) => <div style={{padding:60,textAlign:'center',color:'#6b7280'}}>{children}</div>
const th = () => ({textAlign:'left',padding:'8px 6px',fontFamily:FH,fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.04em'})
const td = () => ({padding:'8px 6px',verticalAlign:'top'})
const sel = (drift) => ({padding:'6px 8px',borderRadius:7,border:`1.5px solid ${drift?AMB:'#e5e7eb'}`,fontSize:11,fontFamily:FH,background:'#fff',width:'100%'})
const mini = (x={}) => ({display:'inline-flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,border:`1px solid ${x.borderColor||'#e5e7eb'}`,background:x.bg||'#fff',color:x.color||'#6b7280',fontSize:11,fontFamily:FH,fontWeight:600,cursor:'pointer'})
const btn = (x={}) => ({display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px 14px',borderRadius:9,border:x.border||'none',background:x.bg||R,color:x.color||'#fff',fontSize:13,fontFamily:FH,fontWeight:800,cursor:'pointer',opacity:x.disabled?0.5:1})
