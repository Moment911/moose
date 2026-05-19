"use client"
import { useState, useEffect } from 'react'
import { Code2, Plus, Trash2, Power, AlertTriangle, Loader2, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'

const TYPES = [
  { key: 'php',  label: 'PHP',  cap: 'execute_php_snippets', danger: true },
  { key: 'html', label: 'HTML', cap: 'create_text_snippets' },
  { key: 'js',   label: 'JS',   cap: 'create_text_snippets' },
  { key: 'css',  label: 'CSS',  cap: 'create_text_snippets' },
]

const LOCATIONS = {
  php:  [['everywhere','Everywhere'], ['admin','Admin only'], ['frontend','Frontend only']],
  html: [['head','<head>'], ['footer','Footer']],
  js:   [['head','<head>'], ['footer','Footer']],
  css:  [['head','<head>']],
}

const empty = () => ({ id: '', name: '', type: 'html', code: '', location: 'head', active: false, read_roles: [], execute_roles: [] })

export default function SnippetsPanel({ site }) {
  const [snippets, setSnippets] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { if (site?.id) load() }, [site?.id])

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snip_list', site_id: site.id }),
      })
      const data = await res.json()
      if (!data.ok) setError(data.data?.error || 'Could not load snippets')
      setSnippets(data.data?.snippets || [])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function save(snippet) {
    const res = await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snip_save', site_id: site.id, snippet }),
    })
    const data = await res.json()
    if (!data.ok) { toast.error(data.data?.error || 'Save failed'); return }
    toast.success('Saved')
    setEditing(null)
    await load()
  }

  async function del(s) {
    if (!confirm(`Delete "${s.name}"?`)) return
    await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snip_delete', site_id: site.id, id: s.id }),
    })
    await load()
  }

  async function toggle(s) {
    await fetch('/api/wp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snip_toggle', site_id: site.id, id: s.id, active: !s.active }),
    })
    await load()
  }

  if (loading) return <Centered><Loader2 className="spin" size={18}/> Loading snippets…</Centered>
  if (error && !snippets.length) return <Centered><AlertTriangle color={AMB} size={20}/><div style={{marginTop:8,fontFamily:FB,color:'#6b7280',fontSize:13}}>{error}</div></Centered>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <Code2 size={16} color={R}/>
          <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK}}>Snippets</div>
          <div style={{flex:1}}/>
          <button onClick={() => setEditing(empty())} style={btn({bg:R,color:'#fff'})}><Plus size={13}/> New snippet</button>
        </div>
        <div style={{fontSize:11,color:'#6b7280',fontFamily:FB,marginBottom:8}}>
          PHP snippets execute server-side. HTML/JS/CSS inject into &lt;head&gt; or &lt;footer&gt;. Active toggle is required for execution.
        </div>

        {snippets.length === 0 ? (
          <div style={{padding:30,textAlign:'center',color:'#9ca3af',fontSize:12,fontFamily:FB}}>No snippets yet.</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {snippets.map(s => (
              <div key={s.id} style={{padding:'10px 12px',background:'#fafafa',borderRadius:9,border:'1px solid #f1f5f9'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={() => toggle(s)} title={s.active?'Deactivate':'Activate'} style={{...mini({color:s.active?GRN:'#9ca3af',borderColor:s.active?GRN:'#e5e7eb'})}}>
                    <Power size={11}/>
                  </button>
                  <Pill label={s.type} color={s.type==='php'?'#b91c1c':'#0e7490'} bg={s.type==='php'?'#fee2e2':'#cffafe'}/>
                  <Pill label={s.location} color="#374151" bg="#e5e7eb"/>
                  <div style={{flex:1,fontFamily:FH,fontSize:13,fontWeight:700,color:BLK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
                  <span style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{s.updated_at?new Date(s.updated_at).toLocaleString():''}</span>
                  <button onClick={() => setEditing(s)} style={mini()}>Edit</button>
                  <button onClick={() => del(s)} style={mini({color:R,borderColor:R})}><Trash2 size={10}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && <SnippetEditor snippet={editing} onSave={save} onCancel={() => setEditing(null)} availableRoles={[]}/>}
    </div>
  )
}

function SnippetEditor({ snippet, onSave, onCancel }) {
  const [s, setS] = useState({ ...empty(), ...snippet })
  const tDef = TYPES.find(x => x.key === s.type) || TYPES[0]
  const locs = LOCATIONS[s.type] || LOCATIONS.html

  // Re-set location if it's no longer valid for the new type
  useEffect(() => {
    if (!locs.find(l => l[0] === s.location)) setS(p => ({ ...p, location: locs[0][0] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.type])

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.45)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:60,zIndex:1000}}>
      <div style={{background:'#fff',borderRadius:14,maxWidth:780,width:'100%',padding:20,boxShadow:'0 30px 80px rgba(0,0,0,.18)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <Code2 size={16} color={R}/>
          <div style={{fontFamily:FH,fontSize:16,fontWeight:800,color:BLK}}>{s.id ? 'Edit snippet' : 'New snippet'}</div>
          <div style={{flex:1}}/>
          <button onClick={onCancel} style={mini()}><X size={11}/></button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10}}>
          <input value={s.name} onChange={e => setS({...s, name: e.target.value})} placeholder="Snippet name" style={inp()}/>
          <select value={s.type} onChange={e => setS({...s, type: e.target.value})} style={inp()}>
            {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select value={s.location} onChange={e => setS({...s, location: e.target.value})} style={inp()}>
            {locs.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {tDef.danger && (
          <div style={{padding:'8px 10px',background:`${R}10`,border:`1px solid ${R}30`,borderRadius:8,marginBottom:10,fontSize:11,fontFamily:FB,color:BLK,display:'flex',gap:8,alignItems:'center'}}>
            <AlertTriangle size={13} color={R}/>
            <span>PHP snippets execute server-side. Requires <code>execute_php_snippets</code> capability.</span>
          </div>
        )}

        <textarea value={s.code} onChange={e => setS({...s, code: e.target.value})} placeholder={s.type==='php'?'<?php\n// your code':'<!-- HTML -->\n'} rows={16} style={{...inp(),fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',fontSize:12,lineHeight:1.5,resize:'vertical'}}/>

        <div style={{display:'flex',gap:10,alignItems:'center',marginTop:14}}>
          <label style={{display:'flex',gap:6,alignItems:'center',fontFamily:FH,fontSize:12,color:BLK}}>
            <input type="checkbox" checked={!!s.active} onChange={e => setS({...s, active: e.target.checked})}/>
            Active (run this snippet)
          </label>
          <div style={{flex:1}}/>
          <button onClick={onCancel} style={btn({bg:'#fff',color:BLK,border:'1.5px solid #e5e7eb'})}>Cancel</button>
          <button onClick={() => onSave(s)} disabled={!s.name||!s.code} style={btn({bg:R,color:'#fff'})}><Save size={13}/> Save</button>
        </div>
      </div>
    </div>
  )
}

const Pill = ({label, color, bg}) => <span style={{display:'inline-block',padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:700,color,background:bg,fontFamily:FH,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</span>
const Centered = ({children}) => <div style={{padding:60,textAlign:'center',color:'#6b7280'}}>{children}</div>
const inp = (x={}) => ({width:'100%',padding:'9px 12px',borderRadius:9,border:'1.5px solid #e5e7eb',fontSize:13,fontFamily:FB,outline:'none',background:'#fff',boxSizing:'border-box',...x})
const mini = (x={}) => ({display:'inline-flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,border:`1px solid ${x.borderColor||'#e5e7eb'}`,background:x.bg||'#fff',color:x.color||'#6b7280',fontSize:11,fontFamily:FH,fontWeight:600,cursor:'pointer'})
const btn = (x={}) => ({display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px 14px',borderRadius:9,border:x.border||'none',background:x.bg||R,color:x.color||'#fff',fontSize:13,fontFamily:FH,fontWeight:800,cursor:'pointer',opacity:x.disabled?0.5:1})
