"use client";
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Check, ChevronRight, ChevronLeft, Loader2, AlertCircle, ExternalLink, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ACCESS_SECTIONS, STATUS_CONFIG } from '../data/accountAccessTemplate'
import toast from 'react-hot-toast'

const ACCENT = '#E8551A'
const INP = { width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', background:'#fff', boxSizing:'border-box', color:'#111111' }

const TYPE_GUIDE = {
  credentials: { title:'Provide Login Credentials', steps:['Log into the platform','Go to account settings or admin panel','Copy the login URL, username/email, and password','Paste them in the fields below'] },
  invite:      { title:'Send an Email Invite', steps:['Log into the platform','Go to Settings → Users or Team Access','Click Invite or Add User','Enter the agency email shown below and assign the role listed','Click Send or Save'] },
  file_link:   { title:'Share a Document or Folder Link', steps:['Find the file or folder in Google Drive or Dropbox','Right-click → Share or Get Link','Set sharing to "Anyone with the link can view"','Paste the link below'] },
  setup:       { title:'Agency Will Handle This', steps:['No action needed from you for this item','Your agency team will set this up','Mark as Done once your agency confirms'] },
  call:        { title:'Phone Call Required', steps:['This information is too sensitive for a form','Contact your agency to schedule a quick call','They will collect this securely over the phone','Mark as Done once the call is complete'] },
}

function PwField({ value, onChange }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <input type={show?'text':'password'} value={value||''} onChange={e=>onChange(e.target.value)} placeholder="Password / API key" style={{ ...INP, paddingRight:44 }}/>
      <button onClick={()=>setShow(s=>!s)} type="button" style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>
        {show?<EyeOff size={15}/>:<Eye size={15}/>}
      </button>
    </div>
  )
}

function ItemCard({ item, data, onChange, agencyEmail }) {
  const d = data||{}
  const status = d.status||'not_started'
  const [expanded, setExpanded] = useState(status!=='complete'&&status!=='na')
  const guide = TYPE_GUIDE[item.type]||TYPE_GUIDE.credentials
  const done = status==='complete', na = status==='na'

  function set(k,v) { onChange({...d,[k]:v,item_id:item.id,client_updated_at:new Date().toISOString()}) }
  function markDone() { onChange({...d,status:'complete',item_id:item.id,client_completed_at:new Date().toISOString(),client_updated_at:new Date().toISOString()}); setExpanded(false) }
  function markNA() { onChange({...d,status:'na',item_id:item.id,client_updated_at:new Date().toISOString()}); setExpanded(false) }

  return (
    <div style={{ borderRadius:14, border:done?'2px solid #22c55e':'1.5px solid #e5e7eb', background:done?'#f0fdf4':na?'#f9fafb':'#fff', marginBottom:12, overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={()=>!done&&!na&&setExpanded(e=>!e)}>
        <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:done?'#22c55e':na?'#f3f4f6':'#f9fafb', border:done?'none':na?'2px solid #d1d5db':'2px solid #e5e7eb' }}>
          {done?<Check size={16} color="#fff" strokeWidth={3}/>:na?<span style={{ fontSize:10, fontWeight:700, color:'#9ca3af' }}>N/A</span>:<span style={{ fontSize:13, color:'#9ca3af' }}>○</span>}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:done||na?'#9ca3af':'#111', textDecoration:done?'line-through':'' }}>{item.label}</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2, display:'flex', gap:7 }}>
            <span style={{ background:'#f3f4f6', padding:'1px 7px', borderRadius:10, fontWeight:500 }}>{item.priority==='high'?'🔴 Required':item.priority==='mid'?'🟡 Important':'⚪ Optional'}</span>
            {done&&<span style={{ color:'#22c55e', fontWeight:600 }}>✓ Submitted</span>}
          </div>
        </div>
        {(done||na)&&<button onClick={e=>{e.stopPropagation();set('status','not_started');setExpanded(true)}} style={{ fontSize:11, color:'#9ca3af', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Edit</button>}
        {!done&&!na&&<ChevronRight size={16} color="#9ca3af" style={{ transform:expanded?'rotate(90deg)':'rotate(0)', transition:'transform .2s', flexShrink:0 }}/>}
      </div>

      {expanded&&!done&&!na&&(
        <div style={{ padding:'0 18px 18px' }}>
          <div style={{ borderTop:'1px solid #f3f4f6', paddingTop:14 }}>
            <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10, padding:'11px 14px', marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#0369a1', marginBottom:7 }}>📋 {guide.title}</div>
              <ol style={{ margin:0, paddingLeft:18 }}>{guide.steps.map((s,i)=><li key={i} style={{ fontSize:13, color:'#374151', marginBottom:4, lineHeight:1.5 }}>{s}</li>)}</ol>
              {item.link&&<a href={item.link} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:7, fontSize:12, color:'#0369a1', textDecoration:'none', fontWeight:500 }}>View Instructions<ExternalLink size={10}/></a>}
            </div>
            {item.type==='invite'&&agencyEmail&&(
              <div style={{ background:'#fff7f5', border:`1px solid ${ACCENT}30`, borderRadius:9, padding:'9px 13px', marginBottom:12, fontSize:13, color:'#92400e', display:'flex', gap:7, alignItems:'center' }}>
                <span style={{ fontWeight:700 }}>Agency Email to Invite:</span>
                <code style={{ background:'rgba(0,0,0,.06)', padding:'2px 8px', borderRadius:5, fontWeight:700 }}>{agencyEmail}</code>
                <span style={{ color:'#9ca3af', fontSize:11 }}>Role: {item.access_level}</span>
              </div>
            )}
            {item.type==='credentials'&&(
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:12 }}>
                <div><label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Login URL</label><input value={d.login_url||''} onChange={e=>set('login_url',e.target.value)} placeholder="https://admin.example.com" style={INP}/></div>
                <div><label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Username or Email</label><input value={d.username||''} onChange={e=>set('username',e.target.value)} placeholder="admin@yourbusiness.com" style={INP}/></div>
                <div><label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Password</label><PwField value={d.password} onChange={v=>set('password',v)}/></div>
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:7, padding:'7px 11px', fontSize:11, color:'#166534' }}>🔒 Encrypted — only your agency team can see this</div>
              </div>
            )}
            {item.type==='invite'&&<div style={{ marginBottom:12 }}><label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Account URL or ID (optional)</label><input value={d.account_id||''} onChange={e=>set('account_id',e.target.value)} placeholder="e.g. facebook.com/yourpage" style={INP}/></div>}
            {item.type==='file_link'&&(
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Document or Folder Link</label>
                <div style={{ display:'flex', gap:7 }}>
                  <input value={d.file_link||''} onChange={e=>set('file_link',e.target.value)} placeholder="https://drive.google.com/..." style={{ ...INP, flex:1 }}/>
                  {d.file_link&&<a href={d.file_link} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', padding:'0 13px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', textDecoration:'none', color:'#374151' }}><ExternalLink size={13}/></a>}
                </div>
              </div>
            )}
            <div style={{ marginBottom:14 }}><label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Notes for your agency (optional)</label><input value={d.client_notes||''} onChange={e=>set('client_notes',e.target.value)} placeholder="Anything your agency should know…" style={INP}/></div>
            <div style={{ display:'flex', gap:9 }}>
              <button onClick={markDone} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'12px 0', borderRadius:10, border:'none', background:'#22c55e', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}><Check size={15} strokeWidth={3}/> Mark as Done</button>
              <button onClick={markNA} style={{ padding:'12px 16px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:13, cursor:'pointer', color:'#9ca3af' }}>Not Applicable</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClientAccessFormPage() {
  const { token } = useParams()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessData, setAccessData] = useState({})
  const [agencyEmail, setAgencyEmail] = useState('admin@yourmooseagency.com')
  const [activeSection, setActiveSection] = useState(0)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    supabase.from('clients').select('id,name,email,access_checklist,agency_email_override,access_form_token,onboarding_token')
      .or(`access_form_token.eq.${token},onboarding_token.eq.${token}`).single()
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        setClient(data)
        if (data.access_checklist) { try { setAccessData(typeof data.access_checklist==='string'?JSON.parse(data.access_checklist):data.access_checklist) } catch {} }
        if (data.agency_email_override) setAgencyEmail(data.agency_email_override)
        setLoading(false)
      })
  }, [token])

  async function handleItemChange(itemId, data) {
    const next = {...accessData,[itemId]:data}
    setAccessData(next)
    setSaved(false)
    await supabase.from('clients').update({ access_checklist:JSON.stringify(next), updated_at:new Date().toISOString() }).eq('id', client.id)
    await supabase.from('client_change_history').insert({ client_id:client.id, changed_by:client.name||'Client', changed_by_email:client.email, change_type:'access_item_updated', field_name:itemId, new_value:data.status, description:`Client updated: ${itemId} → ${data.status}` })
    setSaved(true)
  }

  const allItems = ACCESS_SECTIONS.flatMap(s=>s.items)
  const totalItems = allItems.length
  const completeItems = allItems.filter(i=>accessData[i.id]?.status==='complete').length
  const pct = Math.round((completeItems/totalItems)*100)
  const section = ACCESS_SECTIONS[activeSection]

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f4f5' }}><Loader2 size={32} color={ACCENT} style={{ animation:'spin 1s linear infinite' }}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!client) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f4f5' }}>
      <div style={{ textAlign:'center', padding:40 }}><AlertCircle size={48} color="#ef4444" style={{ margin:'0 auto 14px' }}/><div style={{ fontSize:20, fontWeight:800, color:'#111', marginBottom:8 }}>Link Not Found</div><div style={{ fontSize:14, color:'#9ca3af' }}>This link may be invalid or expired. Contact your agency for a new one.</div></div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f4f4f5' }}>
      {/* Header */}
      <div style={{ background:'#18181b', padding:'0 22px', position:'sticky', top:0, zIndex:40, boxShadow:'0 2px 16px rgba(0,0,0,.3)' }}>
        <div style={{ maxWidth:720, margin:'0 auto', display:'flex', alignItems:'center', gap:14, height:58 }}>
          <img src="/moose-logo-white.svg" alt="Moose AI" style={{ height:24, width:'auto' }}/>
          <div style={{ width:1, height:20, background:'rgba(255,255,255,.15)' }}/>
          <div style={{ fontSize:12, color:'#a1a1aa' }}>Account Access Setup</div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
            {saved&&<span style={{ fontSize:11, color:'#22c55e', display:'flex', alignItems:'center', gap:4 }}><Check size={11} strokeWidth={3}/> Saved</span>}
            <span style={{ fontSize:12, color:'#71717a' }}>For: <strong style={{ color:'#fff' }}>{client.name}</strong></span>
          </div>
        </div>
        <div style={{ maxWidth:720, margin:'0 auto', paddingBottom:10 }}>
          <div style={{ height:3, background:'rgba(255,255,255,.1)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:pct===100?'#22c55e':ACCENT, borderRadius:2, transition:'width .5s' }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#52525b', marginTop:4 }}>
            <span>{completeItems} of {totalItems} complete</span>
            <span style={{ fontWeight:700, color:pct===100?'#22c55e':ACCENT }}>{pct}%</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:'0 auto', padding:'24px 18px 60px' }}>
        {pct===0&&(
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'26px 30px', marginBottom:20 }}>
            <div style={{ fontSize:20, fontWeight:800, color:'#111', marginBottom:8 }}>Welcome, {client.name}! 🔑</div>
            <p style={{ fontSize:14, color:'#6b7280', lineHeight:1.7, marginBottom:18 }}>To launch your marketing campaigns, we need access to your business accounts. Takes about 15–20 minutes and saves automatically as you go.</p>
            <div style={{ background:'#fff7f5', border:`1px solid ${ACCENT}25`, borderRadius:10, padding:'11px 14px', fontSize:13, color:'#92400e' }}>🔴 <strong>Required items</strong> are needed for launch · 🟡 Important · ⚪ Optional</div>
          </div>
        )}
        {pct===100&&<div style={{ background:'#f0fdf4', border:'2px solid #22c55e', borderRadius:14, padding:'24px', marginBottom:20, textAlign:'center' }}><CheckCircle size={40} color="#22c55e" style={{ margin:'0 auto 10px' }}/><div style={{ fontSize:20, fontWeight:800, color:'#111', marginBottom:5 }}>All done! 🎉</div><div style={{ fontSize:13, color:'#6b7280' }}>Your agency has been notified and will verify each item shortly.</div></div>}

        {/* Section tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:18, overflowX:'auto', paddingBottom:4 }}>
          {ACCESS_SECTIONS.map((s,i)=>{
            const done2=s.items.filter(item=>accessData[item.id]?.status==='complete').length
            const pct2=Math.round((done2/s.items.length)*100)
            const active=i===activeSection
            return (
              <button key={s.id} onClick={()=>setActiveSection(i)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'9px 14px', borderRadius:12, border:active?`2px solid ${ACCENT}`:'1.5px solid #e5e7eb', background:active?'#fff7f5':'#fff', cursor:'pointer', flexShrink:0, minWidth:90 }}>
                <span style={{ fontSize:18 }}>{s.icon}</span>
                <span style={{ fontSize:10, fontWeight:600, color:active?ACCENT:'#374151', textAlign:'center', lineHeight:1.3 }}>{s.label}</span>
                <div style={{ height:3, width:36, background:'#f3f4f6', borderRadius:2, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct2}%`, background:pct2===100?'#22c55e':s.color, borderRadius:2 }}/></div>
                <span style={{ fontSize:9, color:'#9ca3af' }}>{done2}/{s.items.length}</span>
              </button>
            )
          })}
        </div>

        {section&&(
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:14 }}>
              <span style={{ fontSize:24 }}>{section.icon}</span>
              <div><div style={{ fontSize:16, fontWeight:800, color:'#111' }}>{section.label}</div><div style={{ fontSize:11, color:'#9ca3af' }}>{section.items.filter(i=>accessData[i.id]?.status==='complete').length} of {section.items.length} complete</div></div>
            </div>
            {section.items.map(item=><ItemCard key={item.id} item={item} data={accessData[item.id]} onChange={data=>handleItemChange(item.id,data)} agencyEmail={agencyEmail}/>)}
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:20 }}>
          <button disabled={activeSection===0} onClick={()=>setActiveSection(s=>s-1)} style={{ display:'flex', alignItems:'center', gap:6, padding:'11px 20px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:14, cursor:activeSection===0?'not-allowed':'pointer', color:'#374151', opacity:activeSection===0?.4:1 }}><ChevronLeft size={15}/> Previous</button>
          {activeSection<ACCESS_SECTIONS.length-1
            ? <button onClick={()=>setActiveSection(s=>s+1)} style={{ display:'flex', alignItems:'center', gap:6, padding:'11px 24px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>Next Section<ChevronRight size={15}/></button>
            : <button onClick={()=>toast.success('All sections reviewed! Your agency has been notified.')} style={{ display:'flex', alignItems:'center', gap:6, padding:'11px 24px', borderRadius:10, border:'none', background:'#22c55e', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}><CheckCircle size={15}/> All Done!</button>
          }
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
