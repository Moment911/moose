'use client'
import { useState, useEffect } from 'react'

const KC = { acc:'#E6007E',text:'#111',secondary:'#555',tertiary:'#999',border:'rgba(0,0,0,0.08)',borderMd:'rgba(0,0,0,0.13)',bg:'#F7F7F6',white:'#fff',fd:"'Proxima Nova',sans-serif",fb:"'Raleway',sans-serif" }

export default function CallbacksPage() {
  const [callbacks, setCallbacks] = useState<any[]>([])
  const [calDates, setCalDates] = useState<Record<string,number>>({})
  const [selectedDate, setSelectedDate] = useState('')
  const [form, setForm] = useState({ contact_name:'',company_name:'',phone:'',date:'',time:'10:00',reason:'Morning Follow-up',notes:'' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadCallbacks(); loadCalendar() },[])
  useEffect(() => { loadCallbacks() },[selectedDate])

  async function loadCallbacks() {
    const params = selectedDate ? `&date=${selectedDate}` : ''
    const res = await fetch(`/api/kotoclose?action=callbacks${params}`).then(r=>r.json()).catch(()=>({data:[]}))
    setCallbacks(res?.data || [])
  }
  async function loadCalendar() {
    const res = await fetch('/api/kotoclose?action=callback_calendar').then(r=>r.json()).catch(()=>({data:[]}))
    const m: Record<string,number> = {}
    for (const d of res?.data||[]) m[d.date] = d.count
    setCalDates(m)
  }
  async function submit(e:React.FormEvent) {
    e.preventDefault()
    if (!form.contact_name||!form.phone||!form.date) return
    setSaving(true)
    await fetch('/api/kotoclose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'schedule_callback',contact_name:form.contact_name,company_name:form.company_name,phone:form.phone,scheduled_at:`${form.date}T${form.time}:00`,reason:form.reason,notes:form.notes})})
    setForm({ contact_name:'',company_name:'',phone:'',date:'',time:'10:00',reason:'Morning Follow-up',notes:'' })
    setSaving(false)
    setToast('Callback scheduled')
    setTimeout(()=>setToast(''),3000)
    loadCallbacks(); loadCalendar()
  }

  const now = new Date()
  const isOverdue = (d:string) => new Date(d) < now

  // Mini calendar
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year,month,1).getDay()
  const daysInMonth = new Date(year,month+1,0).getDate()
  const monthName = today.toLocaleString('en-US',{month:'long',year:'numeric'})
  const calDays: (number|null)[] = Array(firstDay).fill(null).concat(Array.from({length:daysInMonth},(_,i)=>i+1))
  while(calDays.length%7!==0) calDays.push(null)

  const fi = {background:KC.white,border:`0.5px solid ${KC.borderMd}`,borderRadius:6,padding:'7px 10px',fontSize:12,outline:'none',width:'100%',boxSizing:'border-box' as const}

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:14 }}>
      {/* Left — Queue */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <span style={{ fontSize:14, fontWeight:600, color:KC.text, fontFamily:KC.fd }}>Callback Queue</span>
          <span style={{ fontSize:10, fontWeight:600, background:'#faf5ff', color:'#7c3aed', padding:'2px 8px', borderRadius:10 }}>{callbacks.length}</span>
          {selectedDate && <button onClick={()=>setSelectedDate('')} style={{ fontSize:10, color:KC.acc, background:'none', border:'none', cursor:'pointer' }}>Clear date filter</button>}
        </div>
        {callbacks.length===0?(
          <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:30, textAlign:'center', fontSize:12, color:'#999' }}>No callbacks scheduled</div>
        ):callbacks.map((cb:any,i:number)=>(
          <div key={cb.id||i} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:`0.5px solid ${KC.border}` }}>
            <div style={{ minWidth:60, fontSize:11, fontWeight:600, color:isOverdue(cb.scheduled_at)?'#991b1b':'#7c3aed' }}>
              {new Date(cb.scheduled_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
              {isOverdue(cb.scheduled_at)&&<div style={{ fontSize:9, color:'#991b1b' }}>(overdue)</div>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:500, color:KC.text }}>{cb.contact_name}</div>
              <div style={{ fontSize:10, color:'#999' }}>{cb.company_name}</div>
              {cb.reason&&<div style={{ fontSize:10, color:'#999', fontStyle:'italic' }}>{cb.reason}</div>}
            </div>
            <div style={{ display:'flex', gap:4 }}>
              <button style={{ background:KC.white, border:`0.5px solid ${KC.borderMd}`, borderRadius:5, padding:'3px 10px', fontSize:10, cursor:'pointer' }}>Call Now</button>
              <button style={{ background:KC.white, border:`0.5px solid ${KC.borderMd}`, borderRadius:5, padding:'3px 10px', fontSize:10, cursor:'pointer' }}>Reschedule</button>
            </div>
          </div>
        ))}
      </div>

      {/* Right column */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {/* Form */}
        <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd, marginBottom:10 }}>Schedule Callback</div>
          <form onSubmit={submit} noValidate style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input value={form.contact_name} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))} placeholder="Contact name" style={fi} />
            <input value={form.company_name} onChange={e=>setForm(f=>({...f,company_name:e.target.value}))} placeholder="Company name" style={fi} />
            <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="Phone number" style={fi} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={fi} />
              <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} style={fi} />
            </div>
            <select value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} style={fi}>
              <option>Morning Follow-up</option><option>Pricing Question</option><option>Decision Maker Call</option><option>Objection Follow-up</option><option>Custom</option>
            </select>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes (optional)" style={{ ...fi, minHeight:70, resize:'vertical' as const }} />
            <button type="submit" disabled={saving} style={{ width:'100%', background:'#111', color:'white', padding:9, borderRadius:6, fontWeight:600, fontSize:12, cursor:'pointer', border:'none' }}>
              {saving?'Scheduling...':'Schedule Callback'}
            </button>
          </form>
          {toast&&<div style={{ marginTop:8, fontSize:11, color:'#16a34a', fontWeight:600 }}>{toast}</div>}
        </div>

        {/* Calendar */}
        <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:14 }}>
          <div style={{ fontSize:12, fontWeight:600, color:KC.text, marginBottom:8 }}>{monthName}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {['S','M','T','W','T','F','S'].map(d=><div key={d} style={{ fontSize:9, fontWeight:700, color:'#999', textAlign:'center', padding:2 }}>{d}</div>)}
            {calDays.map((day,i)=>{
              if (!day) return <div key={i}/>
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isToday = day===today.getDate()
              const hasCb = calDates[dateStr]
              const isSelected = dateStr===selectedDate
              return (
                <div key={i} onClick={()=>setSelectedDate(dateStr===selectedDate?'':dateStr)} style={{
                  fontSize:10, padding:'4px 2px', borderRadius:isToday?6:4, textAlign:'center', cursor:'pointer',
                  background:isToday?'#111':isSelected?KC.acc:hasCb?'#faf5ff':'transparent',
                  color:isToday||isSelected?'white':hasCb?'#7c3aed':KC.text,
                  fontWeight:hasCb||isToday?600:400,
                }}>{day}</div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
