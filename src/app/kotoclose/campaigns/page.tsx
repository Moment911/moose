'use client'
import { useState, useEffect } from 'react'

const KC = { acc:'#E6007E',blue:'#4A4EFF',green:'#16a34a',greenTint:'#f0fdf4',text:'#111',secondary:'#555',border:'rgba(0,0,0,0.08)',borderMd:'rgba(0,0,0,0.13)',bg:'#F7F7F6',white:'#fff',fd:"'Proxima Nova',sans-serif" }

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name:'', daily_limit:'150', start_hour:'9', end_hour:'17', ghl_pipeline:'' })

  useEffect(() => { load() }, [])
  async function load() {
    const res = await fetch('/api/kotoclose?action=campaigns').then(r=>r.json()).catch(()=>({data:[]}))
    setCampaigns(res?.data || []); setLoading(false)
  }
  async function create(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/kotoclose', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'create_campaign', ...form, daily_limit:parseInt(form.daily_limit)||150 }) })
    setShowCreate(false); setForm({ name:'', daily_limit:'150', start_hour:'9', end_hour:'17', ghl_pipeline:'' }); load()
  }
  async function toggle(id: string, status: string) {
    await fetch('/api/kotoclose', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'toggle_campaign', id, status }) }); load()
  }
  const fi: React.CSSProperties = { background:KC.white, border:`0.5px solid ${KC.borderMd}`, borderRadius:6, padding:'7px 10px', fontSize:12, outline:'none', width:'100%', boxSizing:'border-box' }
  const pill = (s: string) => s==='active'?{bg:KC.greenTint,c:KC.green,t:'Active'}:s==='paused'?{bg:'#fffbeb',c:'#92400e',t:'Paused'}:{bg:'#f5f5f4',c:'#999',t:'Draft'}

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:14, fontWeight:600, color:KC.text, fontFamily:KC.fd }}>Campaigns</span>
        <button onClick={()=>setShowCreate(!showCreate)} style={{ background:'#111', color:'white', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ New Campaign</button>
      </div>
      {showCreate && (
        <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:20, marginBottom:14 }}>
          <form onSubmit={create} style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Campaign Name" required style={fi} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              <input type="number" value={form.daily_limit} onChange={e=>setForm(f=>({...f,daily_limit:e.target.value}))} style={fi} />
              <select value={form.start_hour} onChange={e=>setForm(f=>({...f,start_hour:e.target.value}))} style={fi}>{[7,8,9,10,11,12].map(h=><option key={h} value={h}>{h} AM</option>)}</select>
              <select value={form.end_hour} onChange={e=>setForm(f=>({...f,end_hour:e.target.value}))} style={fi}>{[12,13,14,15,16,17,18,19,20].map(h=><option key={h} value={h}>{h>12?h-12:h} {h>=12?'PM':'AM'}</option>)}</select>
            </div>
            <input value={form.ghl_pipeline} onChange={e=>setForm(f=>({...f,ghl_pipeline:e.target.value}))} placeholder="GHL Pipeline (optional)" style={fi} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" onClick={()=>setShowCreate(false)} style={{ background:'none', border:`0.5px solid ${KC.borderMd}`, borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer', color:KC.secondary }}>Cancel</button>
              <button type="submit" style={{ background:'#111', color:'white', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>Create</button>
            </div>
          </form>
        </div>
      )}
      {!loading && campaigns.length===0 && !showCreate && (
        <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:'60px 40px', textAlign:'center' }}>
          <div style={{ fontSize:16, fontWeight:600, color:KC.text, marginBottom:8 }}>No campaigns yet</div>
          <div style={{ fontSize:12, color:'#999' }}>Create your first campaign to start calling</div>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:12 }}>
        {campaigns.map((c: any) => { const p = pill(c.status); return (
          <div key={c.id} style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:14, fontWeight:600, color:KC.text }}>{c.name||'Untitled'}</span>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:p.bg, color:p.c }}>{p.t}</span>
                <button onClick={()=>toggle(c.id, c.status==='active'?'paused':'active')} style={{ fontSize:10, background:'none', border:`0.5px solid ${KC.borderMd}`, borderRadius:5, padding:'3px 8px', cursor:'pointer', color:KC.secondary }}>{c.status==='active'?'Pause':'Resume'}</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:10 }}>
              {[{l:'Leads',v:c.total_leads??0},{l:'Called',v:c.leads_called??0},{l:'Opt-ins',v:c.opted_ins??0},{l:'Appts',v:c.appointments??0}].map(st=>(
                <div key={st.l} style={{ background:KC.bg, borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:KC.text, fontFamily:KC.fd }}>{st.v}</div>
                  <div style={{ fontSize:9, color:'#999', textTransform:'uppercase' }}>{st.l}</div>
                </div>
              ))}
            </div>
            <div style={{ height:4, background:'#f0f0ef', borderRadius:2, overflow:'hidden' }}>
              <div style={{ width:`${(c.total_leads??0)>0?Math.round((c.leads_called??0)/(c.total_leads||1)*100):0}%`, height:'100%', background:KC.blue, borderRadius:2 }} />
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}
