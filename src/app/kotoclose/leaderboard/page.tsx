'use client'
import { useState, useEffect } from 'react'

const KC = { acc:'#E6007E',accTint:'#FFF0F7',blue:'#4A4EFF',green:'#16a34a',greenTint:'#f0fdf4',text:'#111',tertiary:'#999',border:'rgba(0,0,0,0.08)',borderMd:'rgba(0,0,0,0.13)',bg:'#F7F7F6',white:'#fff',fd:"'Proxima Nova',sans-serif" }

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [period, setPeriod] = useState('today')

  useEffect(() => {
    fetch(`/api/kotoclose?action=leaderboard&period=${period}`).then(r=>r.json()).then(d=>setAgents(d?.data||[])).catch(()=>{})
  }, [period])

  const rankColor = (i:number) => i===0?'#d97706':i===1?'#9ca3af':i===2?'#cd7c32':'#999'

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:14, fontWeight:600, color:KC.text, fontFamily:KC.fd }}>Agent Leaderboard</span>
        <div style={{ display:'flex', gap:4 }}>
          {['today','week','month'].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{
              padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer',
              background:period===p?'#111':'white', color:period===p?'white':'#555',
              border:period===p?'1px solid #111':`0.5px solid ${KC.borderMd}`, textTransform:'capitalize',
            }}>{p==='today'?'Today':p==='week'?'This Week':'This Month'}</button>
          ))}
        </div>
      </div>

      <div style={{ background:KC.white, borderRadius:14, border:`0.5px solid ${KC.borderMd}`, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:KC.bg }}>
              {['Rank','Agent','Calls Made','Connected','Opt-ins','Appts','Avg Talk','Score'].map(h=>(
                <th key={h} style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#999', padding:'8px 10px', textAlign:'left', borderBottom:`0.5px solid ${KC.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.length===0?(
              <tr><td colSpan={8} style={{ textAlign:'center', padding:30, fontSize:12, color:'#999' }}>No agent data yet — stats update as calls are made</td></tr>
            ):agents.map((a:any,i:number)=>{
              const score = (a.appointments??0)*5 + (a.opted_ins??0)*2 + (a.calls_connected??0)*0.5
              const initials = (a.display_name||'?').split(' ').map((w:string)=>w[0]).join('').toUpperCase().slice(0,2)
              return (
                <tr key={a.id||i} style={{ borderBottom:`0.5px solid ${KC.border}`, background:i===0?KC.accTint:'transparent' }}>
                  <td style={{ padding:'9px 10px', fontSize:14, fontWeight:700, color:rankColor(i), fontFamily:KC.fd }}>#{i+1}</td>
                  <td style={{ padding:'9px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:i===0?KC.acc:i===1?'#555':'#999', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, fontFamily:KC.fd }}>{initials}</div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:500, color:KC.text }}>{a.display_name||'Unknown'}</div>
                        <div style={{ fontSize:10, color:'#999' }}>{a.user_email||''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'9px 10px', fontSize:12, color:KC.text }}>{a.calls_made??0}</td>
                  <td style={{ padding:'9px 10px', fontSize:12, color:KC.text }}>{a.calls_connected??0}</td>
                  <td style={{ padding:'9px 10px', fontSize:12, fontWeight:600, color:KC.acc }}>{a.opted_ins??0}</td>
                  <td style={{ padding:'9px 10px', fontSize:12, fontWeight:600, color:KC.green }}>{a.appointments??0}</td>
                  <td style={{ padding:'9px 10px', fontSize:11, color:'#999' }}>{a.avg_duration?`${Math.floor(a.avg_duration/60)}:${String(a.avg_duration%60).padStart(2,'0')}`:'--'}</td>
                  <td style={{ padding:'9px 10px' }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:score>=30?KC.greenTint:score>=15?KC.accTint:KC.bg, color:score>=30?KC.green:score>=15?KC.acc:'#999' }}>
                      {Math.round(score)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:10, color:'#999', marginTop:8, textAlign:'center' }}>Stats update in real time as calls complete</div>
    </div>
  )
}
