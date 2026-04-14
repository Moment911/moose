"use client"
import { useState, useEffect } from 'react'

import { R, T, BLK, GRN, AMB, FH, FB } from '../lib/theme'

function StatusDot({status}){
  const c=status==='operational'?GRN:status==='degraded'?AMB:R
  return <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:c,boxShadow:`0 0 0 3px ${c}25`,flexShrink:0}}/>
}

function StatusBadge({status}){
  const c=status==='operational'?GRN:status==='degraded'?AMB:status==='resolved'?GRN:R
  const label=status==='operational'?'Operational':status==='degraded'?'Degraded':status==='outage'?'Outage':status==='resolved'?'Resolved':status==='investigating'?'Investigating':status==='identified'?'Identified':'Monitoring'
  return <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:c+'20',color:c,fontFamily:FH}}>{label}</span>
}

function IncidentSeverity({severity}){
  const c=severity==='critical'?R:severity==='major'?AMB:T
  return <span style={{fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:20,background:c+'20',color:c,fontFamily:FH,textTransform:'uppercase'}}>{severity}</span>
}

export default function StatusPage(){
  const [health,setHealth]=useState(null)
  const [incidents,setIncidents]=useState([])
  const [maintenance,setMaintenance]=useState([])
  const [loading,setLoading]=useState(true)
  const [lastChecked,setLastChecked]=useState(null)

  async function load(){
    try{
      const [h,i]=await Promise.all([
        fetch('/api/health').then(r=>r.json()),
        fetch('/api/health?action=incidents').then(r=>r.json()),
      ])
      setHealth(h)
      setIncidents(i.incidents||[])
      setMaintenance(i.maintenance||[])
      setLastChecked(new Date())
    }catch(e){console.error(e)}
    setLoading(false)
  }

  useEffect(()=>{load();const t=setInterval(load,60000);return()=>clearInterval(t)},[])

  const overall=health?.overall||'operational'
  const overallColor=overall==='operational'?GRN:overall==='degraded'?AMB:R
  const overallLabel=overall==='operational'?'All Systems Operational':overall==='degraded'?'Partial System Outage':'Major System Outage'
  const activeIncidents=incidents.filter(i=>i.status!=='resolved')
  const resolvedIncidents=incidents.filter(i=>i.status==='resolved')
  const upcomingMaintenance=maintenance.filter(m=>m.status==='scheduled')

  const services=[
    {key:'supabase',label:'Database',icon:'🗄️'},
    {key:'vercel',label:'Application',icon:'⚡'},
    {key:'auth',label:'Authentication',icon:'🔐'},
    {key:'api',label:'API',icon:'🔌'},
  ]

  return(
    <div style={{minHeight:'100vh',background:'#f8fafc',fontFamily:FB}}>
      {/* Header */}
      <div style={{background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'20px 0'}}>
        <div style={{maxWidth:780,margin:'0 auto',padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{fontFamily:FH,fontSize:22,fontWeight:900,color:'#fff',letterSpacing:'-.03em'}}>·koto.</div>
            <span style={{fontSize:13,color: '#999999',fontFamily:FB}}>System Status</span>
          </div>
          {lastChecked&&<div style={{fontSize:11,color:'#999999',fontFamily:FB}}>Updated {lastChecked.toLocaleTimeString()}</div>}
        </div>
      </div>

      <div style={{maxWidth:780,margin:'0 auto',padding:'32px 24px'}}>

        {/* Overall Status */}
        <div style={{background:'#fff',borderRadius:16,border:`2px solid ${overallColor}`,padding:'28px 32px',marginBottom:24,display:'flex',alignItems:'center',gap:16}}>
          <div style={{width:48,height:48,borderRadius:'50%',background:overallColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
            {overall==='operational'?'✓':overall==='degraded'?'⚠':'✕'}
          </div>
          <div>
            <div style={{fontFamily:FH,fontSize:20,fontWeight:800,color:BLK}}>{overallLabel}</div>
            <div style={{fontSize:13,color:'#6b7280',fontFamily:FB,marginTop:3}}>
              {activeIncidents.length>0?`${activeIncidents.length} active incident${activeIncidents.length>1?'s':''}`:upcomingMaintenance.length>0?`${upcomingMaintenance.length} maintenance window${upcomingMaintenance.length>1?'s':''} scheduled`:'No incidents reported'}
            </div>
          </div>
        </div>

        {/* Services */}
        <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden',marginBottom:24}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #f3f4f6'}}>
            <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK}}>Services</div>
          </div>
          {services.map(svc=>{
            const check=health?.services?.find(s=>s.service===svc.key)
            const status=check?.status||'operational'
            return(
              <div key={svc.key} style={{padding:'14px 20px',borderBottom:'1px solid #f9fafb',display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:18}}>{svc.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK}}>{svc.label}</div>
                  {check?.response_ms&&<div style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{check.response_ms}ms response time</div>}
                </div>
                <StatusBadge status={status}/>
              </div>
            )
          })}
          {/* WordPress Sites */}
          {(health?.wordpress||[]).map((wp,i)=>(
            <div key={i} style={{padding:'14px 20px',borderBottom:'1px solid #f9fafb',display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:18}}>🌐</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK}}>{wp.site_url.replace(/^https?:\/\//,'')}</div>
                {wp.response_ms&&<div style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{wp.response_ms}ms response time</div>}
              </div>
              <StatusBadge status={wp.status}/>
            </div>
          ))}
        </div>

        {/* Active Incidents */}
        {activeIncidents.length>0&&(
          <div style={{marginBottom:24}}>
            <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:12}}>Active Incidents</div>
            {activeIncidents.map(inc=>(
              <div key={inc.id} style={{background:'#fff',borderRadius:14,border:`1.5px solid ${R}30`,padding:'18px 20px',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <StatusBadge status={inc.status}/>
                  <IncidentSeverity severity={inc.severity}/>
                  <span style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginLeft:'auto'}}>{new Date(inc.started_at).toLocaleString()}</span>
                </div>
                <div style={{fontFamily:FH,fontSize:15,fontWeight:700,color:BLK,marginBottom:6}}>{inc.title}</div>
                <div style={{fontSize:13,color:'#6b7280',fontFamily:FB,lineHeight:1.6}}>{inc.description}</div>
                {inc.services?.length>0&&<div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>{inc.services.map(s=><span key={s} style={{fontSize:12,fontWeight:600,padding:'2px 8px',borderRadius:10,background:'#f3f4f6',color:'#6b7280',fontFamily:FH}}>{s}</span>)}</div>}
                {(inc.updates||[]).length>0&&(
                  <div style={{marginTop:12,borderTop:'1px solid #f3f4f6',paddingTop:10}}>
                    {[...(inc.updates||[])].reverse().map((u,i)=>(
                      <div key={i} style={{marginBottom:8}}>
                        <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{new Date(u.timestamp).toLocaleString()} · <span style={{color:T,fontWeight:600}}>{u.status}</span></div>
                        <div style={{fontSize:13,color:'#374151',fontFamily:FB}}>{u.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Scheduled Maintenance */}
        {upcomingMaintenance.length>0&&(
          <div style={{marginBottom:24}}>
            <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:12}}>Scheduled Maintenance</div>
            {upcomingMaintenance.map(m=>(
              <div key={m.id} style={{background:'#fff',borderRadius:14,border:`1.5px solid ${AMB}40`,padding:'18px 20px',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:AMB+'20',color:AMB,fontFamily:FH}}>Scheduled</span>
                  <span style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginLeft:'auto'}}>{new Date(m.scheduled_start).toLocaleString()} – {new Date(m.scheduled_end).toLocaleTimeString()}</span>
                </div>
                <div style={{fontFamily:FH,fontSize:15,fontWeight:700,color:BLK,marginBottom:6}}>{m.title}</div>
                <div style={{fontSize:13,color:'#6b7280',fontFamily:FB}}>{m.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Incident History */}
        {resolvedIncidents.length>0&&(
          <div style={{marginBottom:24}}>
            <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:12}}>Incident History</div>
            <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden'}}>
              {resolvedIncidents.slice(0,10).map((inc,i)=>(
                <div key={inc.id} style={{padding:'14px 20px',borderBottom:'1px solid #f9fafb',display:'flex',alignItems:'center',gap:10}}>
                  <StatusDot status='operational'/>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:FH,fontSize:13,fontWeight:600,color:BLK}}>{inc.title}</div>
                    <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{new Date(inc.started_at).toLocaleDateString()} · Resolved {inc.resolved_at?new Date(inc.resolved_at).toLocaleString():''}</div>
                  </div>
                  <IncidentSeverity severity={inc.severity}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{textAlign:'center',fontSize:12,color:'#9ca3af',fontFamily:FB,paddingTop:16}}>
          <div>Powered by <span style={{fontFamily:FH,fontWeight:700,color:BLK}}>Koto</span></div>
          <div style={{marginTop:4}}>© {new Date().getFullYear()} Koto Platform · <a href="https://hellokoto.com" style={{color:T,textDecoration:'none'}}>hellokoto.com</a></div>
        </div>
      </div>
    </div>
  )
}
