'use client'
import { useState, useEffect } from 'react'

const KC = { acc:'#E6007E',blue:'#4A4EFF',green:'#16a34a',text:'#111',tertiary:'#999',border:'rgba(0,0,0,0.08)',borderMd:'rgba(0,0,0,0.13)',bg:'#F7F7F6',white:'#fff',fd:"'Proxima Nova',sans-serif" }

export default function AnalyticsPage() {
  const [weekly, setWeekly] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/kotoclose?action=analytics_weekly').then(r=>r.json()).then(d=>setWeekly(d?.data||[])).catch(()=>{})
  }, [])

  const totalCalls = weekly.reduce((s,d)=>s+(d.total||0),0)
  const totalOptins = weekly.reduce((s,d)=>s+(d.opted_ins||0),0)
  const totalAppts = weekly.reduce((s,d)=>s+(d.appointments||0),0)
  const maxCalls = Math.max(...weekly.map(d=>d.total||0), 1)

  // Simulated heatmap
  const days = ['Mon','Tue','Wed','Thu','Fri']
  const hours = Array.from({length:12},(_,i)=>i+8)
  const heatData = days.map(()=>hours.map(()=>Math.random()))

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
        {[{l:'This Week Calls',v:totalCalls,c:KC.blue},{l:'This Week Opt-ins',v:totalOptins,c:KC.acc},{l:'This Week Appts',v:totalAppts,c:KC.green}].map(s=>(
          <div key={s.l} style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:'16px 18px' }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.6px', color:'#999', marginBottom:8 }}>{s.l}</div>
            <div style={{ fontSize:26, fontWeight:700, color:s.c, fontFamily:KC.fd }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
        {/* Chart */}
        <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd, marginBottom:12 }}>Daily Call Volume (14 days)</div>
          <div style={{ display:'flex', alignItems:'end', gap:4, height:160 }}>
            {weekly.length===0?Array.from({length:14}).map((_,i)=>(
              <div key={i} style={{ flex:1, height:8, background:'#f0f0ef', borderRadius:2 }} />
            )):weekly.map((d:any,i:number)=>(
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ width:'100%', height:`${Math.max(8,(d.total||0)/maxCalls*140)}px`, background:KC.blue, borderRadius:'2px 2px 0 0', transition:'height 0.5s' }} />
                <div style={{ fontSize:8, color:'#999', transform:'rotate(-45deg)', whiteSpace:'nowrap' }}>{d.date?.slice(5)}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:12, marginTop:10 }}>
            <span style={{ fontSize:10, color:KC.blue, fontWeight:600 }}>&#9632; Calls</span>
            <span style={{ fontSize:10, color:KC.acc, fontWeight:600 }}>&#9632; Opt-ins</span>
          </div>
        </div>

        {/* Funnel */}
        <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd, marginBottom:12 }}>Weekly Outcome Funnel</div>
          {[
            {l:'Dialed',v:totalCalls,c:'#111',pct:100},
            {l:'Connected',v:Math.round(totalCalls*0.38),c:KC.blue,pct:38},
            {l:'Opted In',v:totalOptins,c:KC.acc,pct:totalCalls>0?Math.round(totalOptins/totalCalls*100):0},
            {l:'Appt Set',v:totalAppts,c:KC.green,pct:totalCalls>0?Math.round(totalAppts/totalCalls*100):0},
          ].map(f=>(
            <div key={f.l} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ minWidth:70, fontSize:11, color:'#555' }}>{f.l}</span>
              <div style={{ flex:1, height:6, background:'#f0f0ef', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width:`${totalCalls>0?f.pct:0}%`, height:'100%', background:f.c, borderRadius:3, transition:'width 0.8s' }} />
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:KC.text, minWidth:28, textAlign:'right' }}>{f.v}</span>
              <span style={{ fontSize:10, color:'#999', minWidth:28 }}>{totalCalls>0?f.pct:0}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, padding:16 }}>
        <div style={{ fontSize:13, fontWeight:600, color:KC.text, fontFamily:KC.fd, marginBottom:12 }}>Answer Rate by Hour &mdash; This Week</div>
        <div style={{ display:'grid', gridTemplateColumns:'40px repeat(12,1fr)', gap:2 }}>
          <div />
          {hours.map(h=><div key={h} style={{ fontSize:9, color:'#999', textAlign:'center' }}>{h>12?h-12:h}{h>=12?'p':'a'}</div>)}
          {days.map((d,di)=>(
            <>{[<div key={`l${di}`} style={{ fontSize:9, color:'#999', display:'flex', alignItems:'center' }}>{d}</div>]}
            {heatData[di].map((v,hi)=>(
              <div key={`${di}-${hi}`} style={{ height:14, borderRadius:2, background:`rgba(230,0,126,${0.08+v*0.77})` }} title={`${d} ${hours[hi]}:00 — ${Math.round(v*100)}%`} />
            ))}</>
          ))}
        </div>
        <div style={{ display:'flex', gap:4, alignItems:'center', marginTop:8, fontSize:9, color:'#999' }}>
          <span>Low</span>
          {[0.1,0.3,0.5,0.7,0.9].map(v=><div key={v} style={{ width:20, height:8, borderRadius:2, background:`rgba(230,0,126,${v})` }} />)}
          <span>High</span>
        </div>
      </div>
    </div>
  )
}
