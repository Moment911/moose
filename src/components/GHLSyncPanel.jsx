"use client"
import { useState, useEffect } from 'react'
import {
  RefreshCw, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  CheckCircle, XCircle, AlertCircle, Loader2, Settings, ChevronDown,
  ChevronUp, Users, Clock, Zap, ExternalLink, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'

import { R as RED, T as TEAL, BLK, GRN as GREEN, AMB as AMBER, FH, FB } from '../lib/theme'

const DIRECTION_CFG = {
  pull: { label: 'GHL → Koto', icon: ArrowDownToLine, color: TEAL,  desc: 'Import all GHL contacts as Koto clients' },
  push: { label: 'Koto → GHL', icon: ArrowUpFromLine, color: GREEN, desc: 'Export all Koto clients to GHL as contacts' },
  both: { label: 'Two-Way Sync',icon: ArrowLeftRight,  color: AMBER, desc: 'Pull from GHL, then push Koto-only clients back' },
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ textAlign:'center', padding:'10px 16px', background:'#f9fafb', borderRadius:10, border:'1px solid #f3f4f6' }}>
      <div style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:color||BLK }}>{value}</div>
      <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginTop:2 }}>{label}</div>
    </div>
  )
}

export default function GHLSyncPanel({ integration, agencyId, onRefresh }) {
  const [syncing,       setSyncing]       = useState(false)
  const [direction,     setDirection]     = useState('pull')
  const [syncStats,     setSyncStats]     = useState(null)
  const [logs,          setLogs]          = useState([])
  const [showLogs,      setShowLogs]      = useState(false)
  const [showMapping,   setShowMapping]   = useState(false)
  const [ghlFields,     setGhlFields]     = useState([])
  const [kotoFields,    setKotoFields]    = useState([])
  const [mappings,      setMappings]      = useState([])
  const [loadingFields, setLoadingFields] = useState(false)
  const [savingMapping, setSavingMapping] = useState(false)

  useEffect(() => { if (integration) loadSyncStatus() }, [integration?.id])

  async function loadSyncStatus() {
    try {
      const res  = await fetch(`/api/integrations/ghl/sync?integration_id=${integration.id}`)
      const data = await res.json()
      setLogs(data.logs || [])
      if (data.stats) setSyncStats(data.stats)
    } catch {}
  }

  async function runSync() {
    setSyncing(true)
    setSyncStats(null)
    const toastId = toast.loading(`${DIRECTION_CFG[direction].label} — syncing…`)
    try {
      const res  = await fetch('/api/integrations/ghl/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: integration.id, direction }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const stats = direction === 'both'
        ? { created: (data.stats.pull?.created||0), updated: (data.stats.pull?.updated||0) + (data.stats.push?.pushed||0), errors: (data.stats.pull?.errors||0) + (data.stats.push?.errors||0) }
        : (data.stats.created !== undefined ? data.stats : { created:0, updated:data.stats.pushed||0, errors:data.stats.errors||0 })

      setSyncStats(stats)
      toast.success(`Sync complete — ${stats.created} imported, ${stats.updated} updated`, { id: toastId })
      loadSyncStatus()
      onRefresh?.()
    } catch (e) {
      toast.error('Sync failed: ' + e.message, { id: toastId })
    }
    setSyncing(false)
  }

  async function loadFieldMappings() {
    setLoadingFields(true)
    try {
      const res  = await fetch(`/api/integrations/ghl/fields?integration_id=${integration.id}`)
      const data = await res.json()
      setGhlFields(data.ghl_fields || [])
      setKotoFields(data.koto_fields || [])
      setMappings(data.mappings || [])
    } catch (e) { toast.error('Failed to load fields: ' + e.message) }
    setLoadingFields(false)
  }

  async function saveMappings() {
    setSavingMapping(true)
    try {
      const res  = await fetch('/api/integrations/ghl/fields', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: integration.id, agency_id: agencyId, mappings }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success(`${data.saved} field mappings saved`)
    } catch (e) { toast.error('Failed: ' + e.message) }
    setSavingMapping(false)
  }

  function addMapping() {
    setMappings(m => [...m, { ghl_field_key: '', ghl_field_name: '', koto_field: '', direction: 'both', active: true }])
  }

  function updateMapping(i, key, val) {
    setMappings(m => m.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }

  function removeMapping(i) {
    setMappings(m => m.filter((_, idx) => idx !== i))
  }

  const dirCfg = DIRECTION_CFG[direction]
  const DirIcon = dirCfg.icon

  return (
    <div style={{ marginTop: 16 }}>

      {/* Sync direction selector */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {Object.entries(DIRECTION_CFG).map(([key, cfg]) => {
          const Icon = cfg.icon
          const active = direction === key
          return (
            <button key={key} onClick={() => setDirection(key)}
              style={{ flex:1, padding:'10px 12px', borderRadius:10, border:`2px solid ${active?cfg.color:'#e5e7eb'}`, background:active?cfg.color+'10':'#fff', cursor:'pointer', textAlign:'left' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                <Icon size={13} color={active?cfg.color:'#9ca3af'}/>
                <span style={{ fontFamily:FH, fontSize:12, fontWeight:active?800:500, color:active?cfg.color:'#374151' }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{cfg.desc}</div>
            </button>
          )
        })}
      </div>

      {/* Sync button */}
      <button onClick={runSync} disabled={syncing}
        style={{ width:'100%', padding:'13px', borderRadius:11, border:'none', background:dirCfg.color, color:'#fff', fontSize:14, fontWeight:700, cursor:syncing?'default':'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:syncing?.75:1, marginBottom:14 }}>
        {syncing ? <Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/> : <DirIcon size={15}/>}
        {syncing ? 'Syncing — this may take a moment…' : `Run ${dirCfg.label}`}
      </button>

      {/* Sync result stats */}
      {syncStats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
          <StatBox label="Imported"  value={syncStats.created || 0} color={TEAL} />
          <StatBox label="Updated"   value={syncStats.updated || 0} color={GREEN} />
          <StatBox label="Errors"    value={syncStats.errors  || 0} color={syncStats.errors?RED:'#9ca3af'} />
        </div>
      )}

      {/* Integration meta */}
      <div style={{ background:'#f9fafb', borderRadius:10, border:'1px solid #f3f4f6', padding:'10px 14px', marginBottom:14, display:'flex', gap:16, flexWrap:'wrap' }}>
        {[
          { label:'Location ID', value:integration.location_id || '—' },
          { label:'Last Sync',   value:integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Never' },
          { label:'Total Synced',value:integration.total_synced || 0 },
        ].map(s => (
          <div key={s.label} style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH }}>{s.label}</div>
            <div style={{ fontSize:13, fontWeight:700, color:BLK, fontFamily:FH, marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Field Mapping */}
      <div style={{ borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:12 }}>
        <button onClick={() => { setShowMapping(!showMapping); if (!showMapping && !ghlFields.length) loadFieldMappings() }}
          style={{ width:'100%', padding:'12px 16px', background:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, display:'flex', alignItems:'center', gap:7 }}>
            <Settings size={13}/> Field Mapping ({mappings.filter(m=>m.ghl_field_key&&m.koto_field).length} mapped)
          </span>
          {showMapping ? <ChevronUp size={14} color="#9ca3af"/> : <ChevronDown size={14} color="#9ca3af"/>}
        </button>

        {showMapping && (
          <div style={{ padding:'14px 16px', borderTop:'1px solid #f3f4f6', background:'#fafafa' }}>
            {loadingFields ? (
              <div style={{ textAlign:'center', padding:'16px', color:'#9ca3af', fontSize:13 }}>
                <Loader2 size={16} style={{animation:'spin 1s linear infinite', display:'inline-block', marginRight:8}}/>
                Loading GHL custom fields…
              </div>
            ) : (
              <>
                <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginBottom:12, lineHeight:1.5 }}>
                  Map GoHighLevel fields to Koto client fields. Standard fields (name, email, phone, etc.) are mapped automatically. Use this to sync custom fields.
                </div>

                {/* Header row */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 100px 36px', gap:8, marginBottom:8 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH }}>GHL Field</div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH }}>Koto Field</div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH }}>Direction</div>
                  <div/>
                </div>

                {mappings.map((m, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 100px 36px', gap:8, marginBottom:8, alignItems:'center' }}>
                    <select value={m.ghl_field_key} onChange={e => {
                      const field = ghlFields.find(f => f.key === e.target.value)
                      updateMapping(i, 'ghl_field_key', e.target.value)
                      if (field) updateMapping(i, 'ghl_field_name', field.name)
                    }}
                      style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB, outline:'none', background:'#fff' }}>
                      <option value="">GHL field…</option>
                      {ghlFields.map(f => <option key={f.key} value={f.key}>{f.name}{f.custom?' (custom)':''}</option>)}
                    </select>
                    <select value={m.koto_field} onChange={e => updateMapping(i, 'koto_field', e.target.value)}
                      style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB, outline:'none', background:'#fff' }}>
                      <option value="">Koto field…</option>
                      {kotoFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                    <select value={m.direction} onChange={e => updateMapping(i, 'direction', e.target.value)}
                      style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB, outline:'none', background:'#fff' }}>
                      <option value="both">Both</option>
                      <option value="pull">GHL→Koto</option>
                      <option value="push">Koto→GHL</option>
                    </select>
                    <button onClick={() => removeMapping(i)}
                      style={{ width:32, height:32, borderRadius:8, border:'1px solid #fee2e2', background:'#fef2f2', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Trash2 size={12} color={RED}/>
                    </button>
                  </div>
                ))}

                <div style={{ display:'flex', gap:8, marginTop:12 }}>
                  <button onClick={addMapping}
                    style={{ padding:'8px 16px', borderRadius:9, border:'1.5px dashed #d1d5db', background:'#fff', color:'#6b7280', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                    + Add Field Mapping
                  </button>
                  <button onClick={saveMappings} disabled={savingMapping}
                    style={{ padding:'8px 16px', borderRadius:9, border:'none', background:GREEN, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                    {savingMapping ? <Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/> : <CheckCircle size={12}/>}
                    Save Mappings
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sync Log */}
      <div style={{ borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <button onClick={() => setShowLogs(!showLogs)}
          style={{ width:'100%', padding:'12px 16px', background:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, display:'flex', alignItems:'center', gap:7 }}>
            <Clock size={13}/> Sync Log ({logs.length})
          </span>
          {showLogs ? <ChevronUp size={14} color="#9ca3af"/> : <ChevronDown size={14} color="#9ca3af"/>}
        </button>

        {showLogs && (
          <div style={{ maxHeight:280, overflowY:'auto', borderTop:'1px solid #f3f4f6' }}>
            {logs.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', color:'#9ca3af', fontSize:13, fontFamily:FB }}>No sync activity yet</div>
            ) : logs.map((log, i) => (
              <div key={i} style={{ padding:'8px 14px', borderBottom:'1px solid #f9fafb', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flexShrink:0 }}>
                  {log.status === 'success'
                    ? <CheckCircle size={13} color={GREEN}/>
                    : <XCircle size={13} color={RED}/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:BLK, fontFamily:FH }}>
                    {log.direction === 'pull' ? '↓ GHL→Koto' : '↑ Koto→GHL'} · {log.action} · {log.entity_type}
                  </div>
                  {log.error_message && <div style={{ fontSize:11, color:RED, fontFamily:FB }}>{log.error_message}</div>}
                </div>
                <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FB, flexShrink:0 }}>
                  {new Date(log.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
