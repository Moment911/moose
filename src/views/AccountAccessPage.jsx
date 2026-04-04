"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, ChevronDown, ExternalLink, Eye, EyeOff, Copy, Save, Link2, Settings, AlertTriangle, RefreshCw, Shield, ShieldCheck, Activity, Radio, Stamp, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ACCESS_SECTIONS, PRIORITY_CONFIG, STATUS_CONFIG, TYPE_CONFIG } from '../data/accountAccessTemplate'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'

const ACCENT = '#ea2729'
const TEAL = '#5bc6d0'
const INP = { width:'100%', padding:'8px 11px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', background:'#fff', boxSizing:'border-box', color:'#111' }

function PwField({ value, onChange }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <input type={show?'text':'password'} value={value||''} onChange={e=>onChange(e.target.value)} style={{ ...INP, paddingRight:36 }} />
      <button onClick={()=>setShow(s=>!s)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#4b5563' }}>
        {show?<EyeOff size={13}/>:<Eye size={13}/>}
      </button>
    </div>
  )
}

function ActivityEntry({ entry }) {
  const isClient = entry.change_type==='access_item_updated'
  const isStaff  = entry.change_type==='access_verified'
  const color = isClient?'#3b82f6':isStaff?'#10b981':'#9ca3af'
  const section = ACCESS_SECTIONS.flatMap(s=>s.items).find(i=>i.id===entry.field_name)
  const itemLabel = section?.label || entry.field_name || 'item'
  return (
    <div style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:'1px solid #f9fafb' }}>
      <div style={{ width:28, height:28, borderRadius:'50%', background:color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{isStaff?<CheckCircle size={13} color={color}/>:isClient?<User size={13} color={color}/>:<Bell size={13} color={color}/>}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, color:'#374151', fontWeight:600 }}>
          <strong style={{ color }}>{isStaff?`Staff: ${entry.changed_by}`:isClient?'Client':entry.changed_by}</strong>{' '}
          {isStaff?`verified: ${itemLabel}`:isClient?`completed: ${itemLabel}`:(entry.description||'')}
        </div>
        {entry.staff_note&&<div style={{ fontSize:13, color:'#374151', fontStyle:'italic' }}>"{entry.staff_note}"</div>}
        <div style={{ fontSize:13, color:'#4b5563', marginTop:2 }}>{entry.created_at?formatDistanceToNow(new Date(entry.created_at),{addSuffix:true}):'—'}</div>
      </div>
      {entry.created_at&&(Date.now()-new Date(entry.created_at).getTime())<30000&&(
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', flexShrink:0, marginTop:8, animation:'pulse 1.5s infinite' }}/>
      )}
    </div>
  )
}

function StaffVerification({ clientId, itemId, itemLabel, user, verifications, onVerify }) {
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const latest = verifications?.[0]

  async function verify() {
    setSaving(true)
    const entry = { client_id:clientId, changed_by:user?.email?.split('@')[0]||'Staff', changed_by_email:user?.email, change_type:'access_verified', field_name:itemId, new_value:'verified', description:`Staff verified: ${itemLabel}`, staff_note:note.trim()||null }
    await supabase.from('client_change_history').insert(entry)
    onVerify({ ...entry, created_at:new Date().toISOString() })
    setNote(''); setShowForm(false); setSaving(false)
    toast.success(`✓ Verified: ${itemLabel}`)
  }

  return (
    <div style={{ marginTop:10, padding:'10px 12px', background:'#f0fdf4', borderRadius:9, border:'1px solid #bbf7d0' }}>
      {latest ? (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <ShieldCheck size={14} color="#16a34a"/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#16a34a' }}>✓ Verified by {latest.changed_by}</div>
            <div style={{ fontSize:13, color:'#4b5563' }}>{latest.created_at?format(new Date(latest.created_at),'MMM d, yyyy h:mm a'):''}{latest.staff_note?` · "${latest.staff_note}"`:''}</div>
          </div>
          <button onClick={()=>setShowForm(v=>!v)} style={{ fontSize:13, padding:'2px 7px', borderRadius:6, border:'1px solid #bbf7d0', background:'#fff', cursor:'pointer', color:'#16a34a' }}>Re-verify</button>
        </div>
      ) : (
        <button onClick={()=>setShowForm(v=>!v)} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#16a34a', fontWeight:700, padding:0, width:'100%' }}>
          <Stamp size={13}/> Staff: Mark as Verified & Working
        </button>
      )}
      {showForm&&(
        <div style={{ marginTop:8, display:'flex', gap:7 }}>
          <input value={note} onChange={e=>setNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&verify()} placeholder="Optional note (e.g. 'Confirmed — full admin access')" style={{ ...INP, flex:1, fontSize:14 }}/>
          <button onClick={verify} disabled={saving} style={{ padding:'6px 13px', borderRadius:8, border:'none', background:'#16a34a', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', flexShrink:0 }}>{saving?'…':'Stamp ✓'}</button>
        </div>
      )}
    </div>
  )
}

function AccessItem({ item, data, onChange, agencyEmail, expanded, onToggle, clientId, user, history }) {
  const d = data||{}
  const status = d.status||'not_started'
  const priority = PRIORITY_CONFIG[item.priority]||PRIORITY_CONFIG.mid
  const statusCfg = STATUS_CONFIG[status]||STATUS_CONFIG.not_started
  const typeCfg = TYPE_CONFIG[item.type]||TYPE_CONFIG.credentials
  const verifications = (history||[]).filter(h=>h.change_type==='access_verified'&&h.field_name===item.id)
  const clientAct = (history||[]).filter(h=>h.change_type==='access_item_updated'&&h.field_name===item.id)
  const isVerified = d.staff_verified||verifications.length>0
  function set(k,v){ onChange({...d,[k]:v,item_id:item.id}) }

  return (
    <div style={{ borderBottom:'1px solid #f3f4f6', background:isVerified?'#f9fffb':status==='complete'?'#fefffe':'#fff' }}>
      <div style={{ display:'grid', gridTemplateColumns:'26px 1fr 110px 90px 120px 110px 28px', gap:0, padding:'10px 14px', alignItems:'center', cursor:'pointer' }} onClick={onToggle}>
        <div onClick={e=>{e.stopPropagation();set('status',status==='complete'?'not_started':'complete')}}>
          <div style={{ width:19, height:19, borderRadius:5, border:`2px solid ${status==='complete'?'#16a34a':'#d1d5db'}`, background:status==='complete'?'#16a34a':'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            {status==='complete'&&<Check size={10} color="#fff" strokeWidth={3}/>}
          </div>
        </div>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:15, fontWeight:700, color:status==='complete'?'#9ca3af':'#111', textDecoration:status==='complete'?'line-through':'' }}>{item.label}</span>
            <span style={{ fontSize:13, padding:'1px 5px', borderRadius:6, background:'#f3f4f6', color:'#374151' }}>{typeCfg.icon}</span>
            {isVerified&&<ShieldCheck size={12} color="#16a34a"/>}
            {d.client_completed_at&&<span style={{ fontSize:12, background:'#e8f9fa', color:'#0e7490', padding:'1px 5px', borderRadius:6, fontWeight:700 }}>CLIENT ✓</span>}
          </div>
          {clientAct.length>0&&<div style={{ fontSize:13, color:'#4b5563' }}>Client updated {formatDistanceToNow(new Date(clientAct[0].created_at),{addSuffix:true})}</div>}
        </div>
        <div style={{ fontSize:13, color:'#4b5563' }}>{item.access_level}</div>
        <div><span style={{ fontSize:13, fontWeight:700, padding:'2px 6px', borderRadius:8, background:priority.bg, color:priority.color, border:`1px solid ${priority.border}` }}>{item.priority.toUpperCase()}</span></div>
        <div onClick={e=>e.stopPropagation()}>
          <select value={status} onChange={e=>set('status',e.target.value)} style={{ ...INP, fontSize:13, padding:'3px 6px', background:statusCfg.bg, color:statusCfg.color, fontWeight:700, border:'none', cursor:'pointer' }}>
            {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ fontSize:13, color:isVerified?'#16a34a':'#d1d5db' }}>
          {isVerified?<span style={{ display:'flex', alignItems:'center', gap:2 }}><ShieldCheck size={10}/>{(d.staff_verified_by||verifications[0]?.changed_by||'').slice(0,8)}</span>:'—'}
        </div>
        <ChevronDown size={12} color="#9ca3af" style={{ transform:expanded?'rotate(180deg)':'rotate(0)', transition:'transform .2s' }}/>
      </div>

      {expanded&&(
        <div style={{ padding:'0 14px 14px 40px', background:'#fafafa', borderTop:'1px solid #f3f4f6' }}>
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:9, padding:'10px 14px', marginBottom:12, marginTop:12, fontSize:14, color:'#1e40af', lineHeight:1.5 }}>
            📋 <strong>Instructions:</strong> {item.instructions}
            {item.link&&<a href={item.link} target="_blank" rel="noreferrer" style={{ color:'#1d4ed8', marginLeft:6, display:'inline-flex', alignItems:'center', gap:2 }}>Docs<ExternalLink size={9}/></a>}
          </div>
          {agencyEmail&&item.type==='invite'&&(
            <div style={{ background:'#f0fbfc', border:`1px solid ${ACCENT}30`, borderRadius:9, padding:'8px 12px', marginBottom:10, fontSize:14, color:'#92400e', display:'flex', gap:8 }}>
              <span style={{ fontWeight:700 }}>Agency Email:</span>
              <code style={{ background:'rgba(0,0,0,.06)', padding:'1px 7px', borderRadius:5, fontWeight:700 }}>{agencyEmail}</code>
              <span style={{ color:'#4b5563' }}>Role: {item.access_level}</span>
            </div>
          )}
          {/* Client-submitted data */}
          {(d.login_url||d.username||d.file_link||d.account_id||d.client_notes)&&(
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:9, padding:'10px 14px', marginBottom:10 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:7 }}>📥 Client Submitted</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['Login URL',d.login_url,false],['Username',d.username,false],['Password',d.password,true],['File Link',d.file_link,false],['Account ID',d.account_id,false],['Client Notes',d.client_notes,false]].filter(([,v])=>v).map(([label,val,pw])=>(
                  <div key={label}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#4b5563', marginBottom:2, textTransform:'uppercase' }}>{label}</div>
                    {pw?<PwField value={val} onChange={v=>set('password',v)}/>:(
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ fontSize:14, color:'#111', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{val}</span>
                        <button onClick={()=>{navigator.clipboard.writeText(val);toast.success('Copied')}} style={{ background:'none', border:'none', cursor:'pointer', color:'#4b5563', padding:1 }}><Copy size={10}/></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {d.client_completed_at&&<div style={{ fontSize:13, color:'#4b5563', marginTop:6 }}>Completed: {format(new Date(d.client_completed_at),'MMM d, yyyy h:mm a')}</div>}
            </div>
          )}
          {/* Agency fields */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:10 }}>
            {item.type==='credentials'&&!d.login_url&&<><div><label style={{ fontSize:13, fontWeight:700, color:'#4b5563', display:'block', marginBottom:3, textTransform:'uppercase' }}>Login URL</label><input value={d.login_url||''} onChange={e=>set('login_url',e.target.value)} style={INP}/></div><div><label style={{ fontSize:13, fontWeight:700, color:'#4b5563', display:'block', marginBottom:3, textTransform:'uppercase' }}>Username</label><input value={d.username||''} onChange={e=>set('username',e.target.value)} style={INP}/></div><div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:13, fontWeight:700, color:'#4b5563', display:'block', marginBottom:3, textTransform:'uppercase' }}>Password</label><PwField value={d.password||''} onChange={v=>set('password',v)}/></div></>}
            <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:13, fontWeight:700, color:'#4b5563', display:'block', marginBottom:3, textTransform:'uppercase' }}>Internal Notes</label><input value={d.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Any caveats or notes…" style={INP}/></div>
          </div>
          <StaffVerification clientId={clientId} itemId={item.id} itemLabel={item.label} user={user} verifications={verifications} onVerify={v=>{ set('staff_verified',true); set('staff_verified_by',v.changed_by); set('staff_verified_at',v.created_at) }}/>
        </div>
      )}
    </div>
  )
}

export default function AccountAccessPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [accessData, setAccessData] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [agencyEmail, setAgencyEmail] = useState('admin@yourmooseagency.com')
  const [showSettings, setShowSettings] = useState(false)
  const [liveActivity, setLiveActivity] = useState([])
  const [isLive, setIsLive] = useState(false)
  const [showActivity, setShowActivity] = useState(true)
  const saveTimeout = useRef(null)

  useEffect(() => { loadClient() }, [clientId])

  useEffect(() => {
    if (!clientId) return
    const channel = supabase.channel(`access_${clientId}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'client_change_history', filter:`client_id=eq.${clientId}` }, payload => {
        const e = payload.new
        if (e.change_type==='access_item_updated'||e.change_type==='access_verified') {
          setLiveActivity(prev=>[e,...prev].slice(0,50))
          if (e.change_type==='access_item_updated') setAccessData(prev=>({...prev,[e.field_name]:{...prev[e.field_name],status:e.new_value}}))
          toast.success(e.change_type==='access_item_updated'?`Live: Client updated ${e.field_name}`:`${e.changed_by} verified ${e.field_name}`,{duration:4000})
        }
      }).subscribe(s=>setIsLive(s==='SUBSCRIBED'))
    return ()=>{ supabase.removeChannel(channel); setIsLive(false) }
  }, [clientId])

  async function loadClient() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
    setClient(data||null)
    if (data?.access_checklist) { try { setAccessData(typeof data.access_checklist==='string'?JSON.parse(data.access_checklist):data.access_checklist) } catch {} }
    const { data: hist } = await supabase.from('client_change_history').select('*').eq('client_id',clientId).in('change_type',['access_item_updated','access_verified']).order('created_at',{ascending:false}).limit(50)
    setLiveActivity(hist||[])
    setLoading(false)
  }

  function handleItemChange(itemId, data) {
    const next = {...accessData,[itemId]:data}
    setAccessData(next)
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(()=>autoSave(next), 1200)
  }

  async function autoSave(data) {
    if (!client) return
    await supabase.from('clients').update({ access_checklist:JSON.stringify(data), updated_at:new Date().toISOString() }).eq('id', client.id)
  }

  async function saveAll() {
    setSaving(true)
    await supabase.from('clients').update({ access_checklist:JSON.stringify(accessData), updated_at:new Date().toISOString() }).eq('id', client.id)
    toast.success('Saved'); setSaving(false)
  }

  function copyClientLink() {
    const tok = client?.access_form_token||client?.onboarding_token
    if (!tok) { toast.error('No access token — save client first'); return }
    navigator.clipboard.writeText(`${window.location.origin}/access/${tok}`)
    toast.success('Client access link copied!')
  }

  const items = ACCESS_SECTIONS.flatMap(s=>s.items)
  const total = items.length
  const complete = items.filter(i=>accessData[i.id]?.status==='complete').length
  const verified = items.filter(i=>accessData[i.id]?.staff_verified||liveActivity.some(h=>h.change_type==='access_verified'&&h.field_name===i.id)).length
  const highPending = items.filter(i=>i.priority==='high'&&(!accessData[i.id]?.status||accessData[i.id]?.status==='not_started')).length
  const pct = Math.round((complete/total)*100)

  if (loading) return <div style={{ display:'flex', minHeight:'100vh' }}><Sidebar/><div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><RefreshCw size={26} color={ACCENT} style={{ animation:'spin 1s linear infinite' }}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div></div>

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f4f5' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'11px 20px', display:'flex', alignItems:'center', gap:11, flexShrink:0 }}>
          <button onClick={()=>navigate('/clients')} style={{ background:'none', border:'none', cursor:'pointer', color:'#4b5563' }}><ChevronLeft size={17}/></button>
          <div style={{ width:34, height:34, borderRadius:8, background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:15 }}>{client?.name?.[0]||'?'}</div>
          <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:700, color:'#111' }}>{client?.name}</div><div style={{ fontSize:13, color:'#4b5563' }}>Account Access Checklist · {complete}/{total} complete · {verified} verified</div></div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background:isLive?'#f0fdf4':'#f3f4f6', border:isLive?'1px solid #bbf7d0':'1px solid #e5e7eb' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:isLive?'#22c55e':'#d1d5db', animation:isLive?'pulse 1.5s infinite':'none' }}/>
            <span style={{ fontSize:13, fontWeight:700, color:isLive?'#16a34a':'#9ca3af' }}>{isLive?'Live':'Offline'}</span>
          </div>
          <div style={{ fontSize:20, fontWeight:900, color:pct===100?'#16a34a':ACCENT, minWidth:48, textAlign:'center' }}>{pct}%</div>
          <div style={{ display:'flex', gap:7 }}>
            <button onClick={()=>setShowSettings(s=>!s)} style={{ padding:'6px 9px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer' }}><Settings size={13}/></button>
            <button onClick={copyClientLink} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}><Link2 size={12}/> Client Link</button>
            <button onClick={()=>setShowActivity(s=>!s)} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:8, border:`1.5px solid ${showActivity?ACCENT:'#e5e7eb'}`, background:showActivity?'#f0fbfc':'#fff', fontSize:14, cursor:'pointer', color:showActivity?ACCENT:'#374151' }}><Activity size={12}/> Feed</button>
            <button onClick={saveAll} disabled={saving} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 14px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}><Save size={12}/>{saving?'Saving…':'Save'}</button>
          </div>
        </div>

        {showSettings&&<div style={{ background:'#f0fbfc', borderBottom:'1px solid #fed7aa', padding:'9px 20px', display:'flex', alignItems:'center', gap:10 }}><span style={{ fontSize:14, fontWeight:700, color:'#92400e' }}>Agency Invite Email:</span><input value={agencyEmail} onChange={e=>setAgencyEmail(e.target.value)} style={{ padding:'5px 10px', borderRadius:7, border:'1.5px solid #fcd34d', fontSize:14, outline:'none', width:280, background:'#fff' }}/></div>}

        {/* Stats */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'9px 20px', display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
          {[{label:'Complete',value:complete,color:'#16a34a'},{label:'Verified',value:verified,color:'#10b981'},{label:'High Pending',value:highPending,color:'#dc2626'}].map(s=>(
            <div key={s.label} style={{ display:'flex', gap:6, alignItems:'center', padding:'4px 10px', borderRadius:8, background:'#f9fafb' }}>
              <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:13, color:'#4b5563' }}>{s.label}</div>
            </div>
          ))}
          <div style={{ marginLeft:'auto', display:'flex', gap:7 }}>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ height:30, padding:'0 8px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer', outline:'none' }}>
              <option value="all">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', display:'flex' }}>
          <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>
            {highPending>0&&<div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'9px 14px', marginBottom:12, display:'flex', gap:9, alignItems:'center' }}><AlertTriangle size={14} color="#dc2626"/><span style={{ fontSize:15, fontWeight:700, color:'#991b1b', flex:1 }}>{highPending} high-priority items need client action</span></div>}
            {ACCESS_SECTIONS.map(section=>{
              const filteredItems = section.items.filter(item=>filterStatus==='all'||(accessData[item.id]?.status||'not_started')===filterStatus)
              if (!filteredItems.length) return null
              const done = section.items.filter(i=>accessData[i.id]?.status==='complete').length
              const pct2 = Math.round((done/section.items.length)*100)
              return (
                <div key={section.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:14 }}>
                  <div style={{ padding:'11px 14px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:10, background:`${section.color}06` }}>
                    <span style={{ fontSize:18 }}>{section.icon}</span>
                    <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:700, color:'#111' }}>{section.label}</div><div style={{ fontSize:13, color:'#4b5563' }}>{done}/{section.items.length} complete</div></div>
                    <div style={{ width:70 }}><div style={{ height:4, background:'#f3f4f6', borderRadius:2, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct2}%`, background:pct2===100?'#16a34a':section.color, borderRadius:2 }}/></div></div>
                    <div style={{ fontSize:15, fontWeight:700, color:pct2===100?'#16a34a':section.color, minWidth:32, textAlign:'right' }}>{pct2}%</div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'26px 1fr 110px 90px 120px 110px 28px', gap:0, padding:'5px 14px', background:'#f8f9fa', borderBottom:'1px solid #e5e7eb' }}>
                    {['','Platform','Access Level','Priority','Status','Verified By',''].map((h,i)=><div key={i} style={{ fontSize:12, fontWeight:700, color:'#4b5563', textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</div>)}
                  </div>
                  {filteredItems.map(item=>(
                    <AccessItem key={item.id} item={item} data={accessData[item.id]} onChange={data=>handleItemChange(item.id,data)} agencyEmail={agencyEmail} expanded={expandedId===item.id} onToggle={()=>setExpandedId(prev=>prev===item.id?null:item.id)} clientId={clientId} user={user} history={liveActivity}/>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Live Feed */}
          {showActivity&&(
            <div style={{ width:280, flexShrink:0, borderLeft:'1px solid #e5e7eb', background:'#fff', display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'12px 14px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:isLive?'#22c55e':'#d1d5db', animation:isLive?'pulse 1.5s infinite':'none' }}/>
                <span style={{ fontSize:14, fontWeight:700, color:'#111' }}>Live Activity</span>
                <span style={{ fontSize:13, color:'#4b5563', marginLeft:'auto' }}>{liveActivity.length} events</span>
              </div>
              {liveActivity.length===0?(
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#4b5563', padding:20, textAlign:'center' }}>
                  <Radio size={26} strokeWidth={1}/>
                  <div style={{ fontSize:14, fontWeight:700 }}>Waiting for activity</div>
                  <div style={{ fontSize:13 }}>Client actions appear here in real time</div>
                </div>
              ):(
                <div style={{ flex:1, overflowY:'auto', padding:'0 14px' }}>
                  {liveActivity.map((e,i)=><ActivityEntry key={i} entry={e}/>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}
