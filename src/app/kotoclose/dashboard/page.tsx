'use client'
import { useState, useEffect } from 'react'

const KC = { acc:'#E6007E',accTint:'#FFF0F7',blue:'#4A4EFF',blueTint:'#EEF0FF',green:'#16a34a',greenTint:'#f0fdf4',text:'#111',secondary:'#555',tertiary:'#999',border:'rgba(0,0,0,0.08)',borderMd:'rgba(0,0,0,0.13)',bg:'#F7F7F6',white:'#fff',fd:"'Proxima Nova',sans-serif",fb:"'Raleway',sans-serif" }

const STATUS_STYLES: Record<string,{bg:string;color:string;border:string}> = {
  live:{bg:'#f0fdf4',color:'#16a34a',border:'0.5px solid rgba(22,163,74,0.2)'},
  completed:{bg:'#EEF0FF',color:'#4A4EFF',border:'0.5px solid rgba(74,78,255,0.2)'},
  voicemail:{bg:'#fffbeb',color:'#92400e',border:'0.5px solid rgba(146,64,14,0.2)'},
  callback:{bg:'#faf5ff',color:'#7c3aed',border:'0.5px solid rgba(124,58,237,0.2)'},
  no_answer:{bg:'#f5f5f4',color:'#999',border:'0.5px solid rgba(0,0,0,0.08)'},
  opted_in:{bg:'#FFF0F7',color:'#E6007E',border:'0.5px solid rgba(230,0,126,0.2)'},
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch('/api/kotoclose?action=dashboard_stats').then(r=>r.json()),
        fetch('/api/kotoclose?action=recent_calls&limit=6').then(r=>r.json()),
      ]).then(([s,c])=>{ setStats(s); setCalls(c?.data||[]); setLoading(false) }).catch(()=>setLoading(false))
    }
    load()
    const iv = setInterval(load, 15000)
    return ()=>clearInterval(iv)
  },[])

  const s = {
    live_calls: stats?.live_calls ?? 0,
    total_today: stats?.total_today ?? 0,
    connect_rate: stats?.connect_rate ?? 0,
    connected: stats?.connected ?? 0,
    opted_ins: stats?.opted_ins ?? 0,
    voicemails: stats?.voicemails ?? 0,
    callbacks: stats?.callbacks ?? 0,
    appointments: stats?.appointments ?? 0,
    avg_duration: stats?.avg_duration ?? '0:00',
  }

  const STATS = [
    { label:'Live Calls',value:s.live_calls,color:'#16a34a',delta:'Active now',dir:'neutral' },
    { label:'Calls Today',value:s.total_today,color:'#111',delta:'+12% vs yesterday',dir:'up' },
    { label:'Connect Rate',value:`${s.connect_rate}%`,color:'#4A4EFF',delta:'+4pts vs avg',dir:'up' },
    { label:'Opt-ins Today',value:s.opted_ins,color:'#E6007E',delta:'+3 this hour',dir:'up' },
    { label:'Voicemails',value:s.voicemails,color:'#111',delta:'17% VM rate',dir:'neutral' },
    { label:'Callbacks Sched.',value:s.callbacks,color:'#7c3aed',delta:'9 today',dir:'neutral' },
    { label:'Appointments',value:s.appointments,color:'#16a34a',delta:'5.7% book rate',dir:'up' },
    { label:'Avg Talk Time',value:s.avg_duration,color:'#111',delta:'+18s vs avg',dir:'up' },
  ]

  const deltaStyle = (dir:string) => dir==='up'?{background:'#f0fdf4',color:'#16a34a'}:dir==='down'?{background:'#fef2f2',color:'#991b1b'}:{background:'#f5f5f4',color:'#999'}

  if (loading) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
      {Array.from({length:8}).map((_,i)=>(
        <div key={i} style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:'16px 18px', height:90 }}>
          <div style={{ width:'40%', height:10, background:'#f0f0ef', borderRadius:4, marginBottom:10, animation:'kcpulse 1.5s infinite' }} />
          <div style={{ width:'60%', height:22, background:'#f0f0ef', borderRadius:4, animation:'kcpulse 1.5s infinite' }} />
        </div>
      ))}
      <style>{`@keyframes kcpulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )

  return (
    <div>
      {/* Stats Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
        {STATS.map(st=>(
          <div key={st.label} style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:'16px 18px' }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',letterSpacing:'0.6px', color:'#999', marginBottom:8, fontFamily:KC.fb }}>{st.label}</div>
            <div style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.5px', lineHeight:1, color:st.color, fontFamily:KC.fd }}>{st.value}</div>
            <div style={{ display:'inline-flex', gap:3, fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:10, marginTop:6, ...deltaStyle(st.dir) }}>
              {st.dir==='up'&&<span>&#9650;</span>}{st.dir==='down'&&<span>&#9660;</span>}{st.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:12 }}>
        {/* Recent Calls */}
        <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`0.5px solid ${KC.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:8,height:8,borderRadius:'50%',background:'#16a34a',boxShadow:'0 0 0 3px rgba(22,163,74,0.15)',animation:'kcpulse 1.5s infinite' }}/>
              <span style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd }}>Live Calls</span>
              <span style={{ fontSize:10, fontWeight:600, background:'#f0fdf4', color:'#16a34a', padding:'1px 6px', borderRadius:10 }}>{s.live_calls} active</span>
            </div>
            <button style={{ background:'none', border:`0.5px solid ${KC.borderMd}`, borderRadius:5, padding:'3px 10px', fontSize:11, color:KC.secondary, cursor:'pointer' }}>Monitor All</button>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:KC.bg }}>
                {['Contact','Duration','Stage','Sentiment','Actions'].map(h=>(
                  <th key={h} style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',color:'#999',padding:'8px 10px',textAlign:'left',borderBottom:`0.5px solid ${KC.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.length===0?(
                <tr><td colSpan={5} style={{ textAlign:'center', padding:30, fontSize:12, color:'#999' }}>No calls today yet</td></tr>
              ):calls.map((c:any,i:number)=>{
                const ss = STATUS_STYLES[c.status]||STATUS_STYLES.no_answer
                return(
                  <tr key={c.id||i} style={{ borderBottom:`0.5px solid ${KC.border}` }}>
                    <td style={{ padding:'9px 10px' }}>
                      <div style={{ fontSize:12, fontWeight:500, color:KC.text }}>{c.contact_name||'Unknown'}</div>
                      <div style={{ fontSize:10, color:'#999' }}>{c.company_name||''}</div>
                    </td>
                    <td style={{ padding:'9px 10px' }}>
                      <span style={{ display:'inline-flex', gap:4, padding:'3px 8px', borderRadius:20, fontSize:10, fontWeight:600, background:KC.greenTint, color:KC.green, border:'0.5px solid rgba(22,163,74,0.2)' }}>
                        {c.duration_seconds?`${Math.floor(c.duration_seconds/60)}:${String(c.duration_seconds%60).padStart(2,'0')}`:'--'}
                      </span>
                    </td>
                    <td style={{ padding:'9px 10px', fontSize:12, color:KC.blue }}>{c.status||'--'}</td>
                    <td style={{ padding:'9px 10px' }}>
                      <div style={{ width:40, height:4, background:'#f0f0ef', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ width:`${c.intelligence_score||50}%`, height:'100%', background:KC.blue, borderRadius:2 }}/>
                      </div>
                    </td>
                    <td style={{ padding:'9px 10px', whiteSpace:'nowrap' }}>
                      <button style={{ background:KC.white, border:`0.5px solid ${KC.borderMd}`, borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', marginRight:3 }}>View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Funnel */}
          <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:16 }}>
            <div style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd, marginBottom:12 }}>Today&apos;s Outcome Funnel</div>
            {[
              { label:'Dialed', value:s.total_today, color:'#111', pct:s.total_today>0?100:0 },
              { label:'Connected', value:s.connected, color:'#4A4EFF', pct:s.total_today>0?Math.round(s.connected/s.total_today*100):0 },
              { label:'Opted In', value:s.opted_ins, color:'#E6007E', pct:s.total_today>0?Math.round(s.opted_ins/s.total_today*100):0 },
              { label:'Appt Set', value:s.appointments, color:'#16a34a', pct:s.total_today>0?Math.round(s.appointments/s.total_today*100):0 },
            ].map(f=>(
              <div key={f.label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ minWidth:70, fontSize:11, color:KC.secondary }}>{f.label}</span>
                <div style={{ flex:1, height:4, background:'#f0f0ef', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ width:`${f.pct}%`, height:'100%', background:f.color, borderRadius:2, transition:'width 0.8s' }}/>
                </div>
                <span style={{ fontSize:11, fontWeight:600, color:KC.text, minWidth:24, textAlign:'right' }}>{f.value}</span>
                <span style={{ fontSize:10, color:'#999', minWidth:28 }}>{f.pct}%</span>
              </div>
            ))}
          </div>

          {/* Queue Status */}
          <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:16 }}>
            <div style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd, marginBottom:10 }}>Queue Status</div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:KC.secondary, marginBottom:6 }}>
              <span>{s.total_today} of 3,000 called</span>
              <span>{s.total_today>0?Math.round(s.total_today/3000*100):0}%</span>
            </div>
            <div style={{ height:6, background:'#f0f0ef', borderRadius:3, overflow:'hidden', marginBottom:12 }}>
              <div style={{ width:`${Math.min(100,s.total_today/30)}%`, height:'100%', background:KC.blue, borderRadius:3, transition:'width 0.8s' }}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:KC.bg, borderRadius:8, padding:10, textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:700, color:'#16a34a', fontFamily:KC.fd }}>{s.total_today>0?Math.round(s.total_today/(new Date().getHours()||1)):0}</div>
                <div style={{ fontSize:10, color:'#999' }}>calls / hr</div>
              </div>
              <div style={{ background:KC.bg, borderRadius:8, padding:10, textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:700, color:'#E6007E', fontFamily:KC.fd }}>{s.live_calls}</div>
                <div style={{ fontSize:10, color:'#999' }}>concurrent</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes kcpulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
