"use client"
import { useState, useEffect, useRef } from 'react'
import { Search, RefreshCw, AlertCircle, Info, AlertTriangle, Bug, Plus, X, Check, Clock, Activity, Globe, Zap, Users, FileText } from 'lucide-react'
import Sidebar from '../components/Sidebar'

const R='#ea2729',T='#5bc6d0',BLK='#0a0a0a',GRY='#f2f2f0',GRN='#16a34a',AMB='#f59e0b'
const FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB="'Raleway','Helvetica Neue',sans-serif"

const LEVEL_COLOR={info:T,warn:AMB,error:R,debug:'#9ca3af'}
const LEVEL_ICON={info:Info,warn:AlertTriangle,error:AlertCircle,debug:Bug}

function StatCard({label,value,icon:Icon,color}){
  return(
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:'16px 20px',display:'flex',alignItems:'center',gap:12}}>
      <div style={{width:40,height:40,borderRadius:10,background:color+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <Icon size={18} color={color}/>
      </div>
      <div>
        <div style={{fontFamily:FH,fontSize:22,fontWeight:900,color:BLK,lineHeight:1}}>{value??'—'}</div>
        <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginTop:2}}>{label}</div>
      </div>
    </div>
  )
}

function ServiceRow({service,status,response_ms}){
  const c=status==='operational'?GRN:status==='degraded'?AMB:R
  return(
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #f3f4f6'}}>
      <span style={{width:8,height:8,borderRadius:'50%',background:c,flexShrink:0,display:'inline-block'}}/>
      <span style={{fontFamily:FH,fontSize:13,fontWeight:600,color:BLK,flex:1,textTransform:'capitalize'}}>{service}</span>
      {response_ms&&<span style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{response_ms}ms</span>}
      <span style={{fontSize:11,fontWeight:700,color:c,fontFamily:FH}}>{status}</span>
    </div>
  )
}

export default function DebugConsolePage(){
  const [tab,setTab]=useState('overview')
  const [health,setHealth]=useState(null)
  const [stats,setStats]=useState(null)
  const [logs,setLogs]=useState([])
  const [incidents,setIncidents]=useState([])
  const [maintenance,setMaintenance]=useState([])
  const [loading,setLoading]=useState(true)
  const [logFilter,setLogFilter]=useState({level:'',service:'',search:''})
  const [showIncidentForm,setShowIncidentForm]=useState(false)
  const [showMaintenanceForm,setShowMaintenanceForm]=useState(false)
  const [incidentForm,setIncidentForm]=useState({title:'',description:'',severity:'minor',services:[]})
  const [maintenanceForm,setMaintenanceForm]=useState({title:'',description:'',services:[],scheduled_start:'',scheduled_end:''})
  const [checkingHealth,setCheckingHealth]=useState(false)
  const [lastUpdated,setLastUpdated]=useState(null)
  const logsRef=useRef(null)

  const SERVICES=['supabase','vercel','auth','api','wordpress']

  async function loadAll(){
    try{
      const [h,s,l,i]=await Promise.all([
        fetch('/api/health').then(r=>r.json()),
        fetch('/api/health?action=stats').then(r=>r.json()),
        fetch(`/api/health?action=logs&level=${logFilter.level}&service=${logFilter.service}&search=${logFilter.search}`).then(r=>r.json()),
        fetch('/api/health?action=incidents').then(r=>r.json()),
      ])
      setHealth(h);setStats(s);setLogs(l.logs||[]);setIncidents(i.incidents||[]);setMaintenance(i.maintenance||[])
      setLastUpdated(new Date())
    }catch(e){console.error(e)}
    setLoading(false)
  }

  async function refreshHealth(){
    setCheckingHealth(true)
    const h=await fetch('/api/health').then(r=>r.json())
    setHealth(h);setLastUpdated(new Date())
    setCheckingHealth(false)
  }

  async function loadLogs(){
    const params=new URLSearchParams({action:'logs',...Object.fromEntries(Object.entries(logFilter).filter(([,v])=>v))})
    const l=await fetch(`/api/health?${params}`).then(r=>r.json())
    setLogs(l.logs||[])
  }

  async function createIncident(){
    await fetch('/api/health',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_incident',...incidentForm})})
    setShowIncidentForm(false);setIncidentForm({title:'',description:'',severity:'minor',services:[]});loadAll()
  }

  async function createMaintenance(){
    await fetch('/api/health',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_maintenance',...maintenanceForm})})
    setShowMaintenanceForm(false);setMaintenanceForm({title:'',description:'',services:[],scheduled_start:'',scheduled_end:''});loadAll()
  }

  async function resolveIncident(id){
    await fetch('/api/health',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_incident',id,status:'resolved',update_message:'Issue has been resolved.'})})
    loadAll()
  }

  useEffect(()=>{loadAll()},[])
  useEffect(()=>{if(tab==='logs')loadLogs()},[logFilter,tab])

  const overall=health?.overall||'operational'
  const overallColor=overall==='operational'?GRN:overall==='degraded'?AMB:R
  const activeIncidents=incidents.filter(i=>i.status!=='resolved')

  const TABS=[
    {key:'overview',label:'Overview',icon:Activity},
    {key:'logs',label:'Logs',icon:Bug,badge:logs.filter(l=>l.level==='error').length},
    {key:'incidents',label:'Incidents',icon:AlertCircle,badge:activeIncidents.length},
    {key:'maintenance',label:'Maintenance',icon:Clock},
  ]

  const inp={width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #e5e7eb',fontSize:12,fontFamily:FB,outline:'none',boxSizing:'border-box'}

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:GRY}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Header */}
        <div style={{background:BLK,padding:'16px 28px',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily:FH,fontSize:18,fontWeight:800,color:'#fff',letterSpacing:'-.02em',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:overallColor,display:'inline-block',boxShadow:`0 0 0 3px ${overallColor}30`}}/>
              Debug Console
            </div>
            <div style={{fontSize:12,color:'rgba(255,255,255,.35)',fontFamily:FB,marginTop:2}}>
              {overall==='operational'?'All systems operational':overall==='degraded'?'Partial outage detected':'Major outage'}
              {lastUpdated&&` · Updated ${lastUpdated.toLocaleTimeString()}`}
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <a href="/status" target="_blank" style={{padding:'7px 14px',borderRadius:9,border:'1px solid rgba(255,255,255,.15)',color:'rgba(255,255,255,.6)',fontSize:12,fontWeight:600,fontFamily:FH,textDecoration:'none',display:'flex',alignItems:'center',gap:5}}>
              <Globe size={12}/> Public Status
            </a>
            <button onClick={refreshHealth} disabled={checkingHealth} style={{padding:'7px 14px',borderRadius:9,border:'none',background:T,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:5}}>
              <RefreshCw size={12} style={{animation:checkingHealth?'spin 1s linear infinite':'none'}}/> Check Now
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'0 28px',display:'flex',gap:2,flexShrink:0}}>
          {TABS.map(t=>{const Icon=t.icon;const active=tab===t.key;return(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{display:'flex',alignItems:'center',gap:5,padding:'12px 16px',border:'none',borderBottom:`2px solid ${active?R:'transparent'}`,background:'transparent',color:active?R:'#6b7280',fontSize:13,fontWeight:active?700:400,cursor:'pointer',fontFamily:FH}}>
              <Icon size={13}/>{t.label}
              {t.badge>0&&<span style={{fontSize:9,fontWeight:800,padding:'1px 5px',borderRadius:10,background:R,color:'#fff'}}>{t.badge}</span>}
            </button>
          )})}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'20px 28px'}}>

          {/* OVERVIEW */}
          {tab==='overview'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
                <StatCard label="Total Users" value={stats?.userCount} icon={Users} color={T}/>
                <StatCard label="Pages Generated (24h)" value={stats?.pageCount} icon={FileText} color={GRN}/>
                <StatCard label="Errors (24h)" value={stats?.errorCount} icon={AlertCircle} color={R}/>
                <StatCard label="Active Incidents" value={activeIncidents.length} icon={AlertTriangle} color={AMB}/>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
                {/* Service Health */}
                <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'18px 20px'}}>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:14}}>Service Health</div>
                  {(health?.services||[]).map(s=><ServiceRow key={s.service} {...s}/>)}
                  {(health?.wordpress||[]).map((w,i)=><ServiceRow key={i} service={w.site_url.replace(/^https?:\/\//,'')} status={w.status} response_ms={w.response_ms}/>)}
                  {!health?.services?.length&&<div style={{fontSize:13,color:'#9ca3af',fontFamily:FB,textAlign:'center',padding:'20px 0'}}>Click Check Now to run health check</div>}
                </div>

                {/* Recent Errors */}
                <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'18px 20px'}}>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:14}}>Recent Errors</div>
                  {logs.filter(l=>l.level==='error').slice(0,8).map(log=>(
                    <div key={log.id} style={{padding:'8px 0',borderBottom:'1px solid #f3f4f6'}}>
                      <div style={{fontFamily:FH,fontSize:12,fontWeight:600,color:R}}>{log.service} · {log.action}</div>
                      <div style={{fontSize:12,color:'#6b7280',fontFamily:FB,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.message}</div>
                      <div style={{fontSize:10,color:'#9ca3af',fontFamily:FB}}>{new Date(log.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                  {!logs.filter(l=>l.level==='error').length&&<div style={{fontSize:13,color:'#9ca3af',fontFamily:FB,textAlign:'center',padding:'20px 0'}}>No errors logged</div>}
                </div>
              </div>
            </div>
          )}

          {/* LOGS */}
          {tab==='logs'&&(
            <div>
              <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
                <div style={{position:'relative',flex:1,minWidth:200}}>
                  <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}/>
                  <input value={logFilter.search} onChange={e=>setLogFilter(p=>({...p,search:e.target.value}))} placeholder="Search logs..." style={{...inp,paddingLeft:30}}/>
                </div>
                <select value={logFilter.level} onChange={e=>setLogFilter(p=>({...p,level:e.target.value}))} style={{...inp,width:120}}>
                  <option value="">All Levels</option>
                  <option value="error">Error</option>
                  <option value="warn">Warning</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
                <select value={logFilter.service} onChange={e=>setLogFilter(p=>({...p,service:e.target.value}))} style={{...inp,width:140}}>
                  <option value="">All Services</option>
                  {SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden'}} ref={logsRef}>
                <div style={{display:'grid',gridTemplateColumns:'80px 90px 120px 1fr 120px',gap:12,padding:'10px 16px',borderBottom:'1px solid #f3f4f6',fontSize:10,fontWeight:700,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',letterSpacing:'.06em'}}>
                  <span>Level</span><span>Service</span><span>Action</span><span>Message</span><span>Time</span>
                </div>
                {logs.length===0&&<div style={{padding:'40px',textAlign:'center',color:'#9ca3af',fontFamily:FB,fontSize:13}}>No logs found</div>}
                {logs.map(log=>{
                  const Icon=LEVEL_ICON[log.level]||Info
                  const color=LEVEL_COLOR[log.level]||'#9ca3af'
                  return(
                    <div key={log.id} style={{display:'grid',gridTemplateColumns:'80px 90px 120px 1fr 120px',gap:12,padding:'9px 16px',borderBottom:'1px solid #f9fafb',alignItems:'center',background:log.level==='error'?R+'05':'transparent'}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <Icon size={11} color={color}/>
                        <span style={{fontSize:10,fontWeight:700,color,fontFamily:FH,textTransform:'uppercase'}}>{log.level}</span>
                      </div>
                      <span style={{fontSize:11,color:'#6b7280',fontFamily:FB,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.service}</span>
                      <span style={{fontSize:11,color:'#374151',fontFamily:FH,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.action}</span>
                      <span style={{fontSize:12,color:'#374151',fontFamily:FB,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.message}</span>
                      <span style={{fontSize:10,color:'#9ca3af',fontFamily:FB}}>{new Date(log.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* INCIDENTS */}
          {tab==='incidents'&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK}}>Incidents</div>
                <button onClick={()=>setShowIncidentForm(true)} style={{padding:'8px 16px',borderRadius:9,border:'none',background:R,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:6}}>
                  <Plus size={12}/> New Incident
                </button>
              </div>

              {showIncidentForm&&(
                <div style={{background:'#fff',borderRadius:14,border:`1.5px solid ${R}`,padding:'20px',marginBottom:16}}>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:14}}>Create Incident</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                    <div><label style={{fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,display:'block',marginBottom:4,textTransform:'uppercase'}}>Title *</label><input value={incidentForm.title} onChange={e=>setIncidentForm(p=>({...p,title:e.target.value}))} placeholder="Brief incident title" style={inp}/></div>
                    <div><label style={{fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,display:'block',marginBottom:4,textTransform:'uppercase'}}>Severity</label>
                      <select value={incidentForm.severity} onChange={e=>setIncidentForm(p=>({...p,severity:e.target.value}))} style={inp}>
                        <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,display:'block',marginBottom:4,textTransform:'uppercase'}}>Description</label><textarea value={incidentForm.description} onChange={e=>setIncidentForm(p=>({...p,description:e.target.value}))} placeholder="What is happening?" style={{...inp,height:80,resize:'vertical'}}/></div>
                  <div style={{marginBottom:14}}><label style={{fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,display:'block',marginBottom:6,textTransform:'uppercase'}}>Affected Services</label>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {SERVICES.map(s=>{const sel=incidentForm.services.includes(s);return(
                        <button key={s} onClick={()=>setIncidentForm(p=>({...p,services:sel?p.services.filter(x=>x!==s):[...p.services,s]}))}
                          style={{padding:'5px 12px',borderRadius:20,border:`1.5px solid ${sel?R:'#e5e7eb'}`,background:sel?R+'10':'#fff',color:sel?R:'#6b7280',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:FH}}>
                          {s}
                        </button>
                      )})}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={createIncident} style={{padding:'8px 18px',borderRadius:9,border:'none',background:R,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH}}>Create Incident</button>
                    <button onClick={()=>setShowIncidentForm(false)} style={{padding:'8px 18px',borderRadius:9,border:'1px solid #e5e7eb',background:'#fff',color:'#6b7280',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:FH}}>Cancel</button>
                  </div>
                </div>
              )}

              {incidents.map(inc=>{
                const isActive=inc.status!=='resolved'
                return(
                  <div key={inc.id} style={{background:'#fff',borderRadius:14,border:`1.5px solid ${isActive?R+'30':'#e5e7eb'}`,padding:'18px 20px',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:(inc.status==='resolved'?GRN:R)+'20',color:inc.status==='resolved'?GRN:R,fontFamily:FH,textTransform:'capitalize'}}>{inc.status}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:(inc.severity==='critical'?R:inc.severity==='major'?AMB:T)+'20',color:inc.severity==='critical'?R:inc.severity==='major'?AMB:T,fontFamily:FH,textTransform:'uppercase'}}>{inc.severity}</span>
                      <span style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginLeft:'auto'}}>{new Date(inc.started_at).toLocaleString()}</span>
                      {isActive&&<button onClick={()=>resolveIncident(inc.id)} style={{padding:'4px 10px',borderRadius:7,border:`1px solid ${GRN}`,background:GRN+'10',color:GRN,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:4}}><Check size={10}/> Resolve</button>}
                    </div>
                    <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK,marginBottom:4}}>{inc.title}</div>
                    <div style={{fontSize:13,color:'#6b7280',fontFamily:FB}}>{inc.description}</div>
                  </div>
                )
              })}
              {incidents.length===0&&<div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'48px',textAlign:'center',color:'#9ca3af',fontFamily:FB,fontSize:13}}>No incidents recorded</div>}
            </div>
          )}

          {/* MAINTENANCE */}
          {tab==='maintenance'&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK}}>Scheduled Maintenance</div>
                <button onClick={()=>setShowMaintenanceForm(true)} style={{padding:'8px 16px',borderRadius:9,border:'none',background:AMB,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:6}}>
                  <Plus size={12}/> Schedule Maintenance
                </button>
              </div>

              {showMaintenanceForm&&(
                <div style={{background:'#fff',borderRadius:14,border:`1.5px solid ${AMB}`,padding:'20px',marginBottom:16}}>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:14}}>Schedule Maintenance Window</div>
                  <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,display:'block',marginBottom:4,textTransform:'uppercase'}}>Title *</label><input value={maintenanceForm.title} onChange={e=>setMaintenanceForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Database upgrade" style={inp}/></div>
                  <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,display:'block',marginBottom:4,textTransform:'uppercase'}}>Description</label><textarea value={maintenanceForm.description} onChange={e=>setMaintenanceForm(p=>({...p,description:e.target.value}))} placeholder="What will be done and expected impact?" style={{...inp,height:70,resize:'vertical'}}/></div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                    <div><label style={{fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,display:'block',marginBottom:4,textTransform:'uppercase'}}>Start Time</label><input type="datetime-local" value={maintenanceForm.scheduled_start} onChange={e=>setMaintenanceForm(p=>({...p,scheduled_start:e.target.value}))} style={inp}/></div>
                    <div><label style={{fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,display:'block',marginBottom:4,textTransform:'uppercase'}}>End Time</label><input type="datetime-local" value={maintenanceForm.scheduled_end} onChange={e=>setMaintenanceForm(p=>({...p,scheduled_end:e.target.value}))} style={inp}/></div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={createMaintenance} style={{padding:'8px 18px',borderRadius:9,border:'none',background:AMB,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH}}>Schedule</button>
                    <button onClick={()=>setShowMaintenanceForm(false)} style={{padding:'8px 18px',borderRadius:9,border:'1px solid #e5e7eb',background:'#fff',color:'#6b7280',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:FH}}>Cancel</button>
                  </div>
                </div>
              )}

              {maintenance.map(m=>(
                <div key={m.id} style={{background:'#fff',borderRadius:14,border:`1.5px solid ${AMB}40`,padding:'18px 20px',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:AMB+'20',color:AMB,fontFamily:FH,textTransform:'capitalize'}}>{m.status}</span>
                    <span style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginLeft:'auto'}}>{new Date(m.scheduled_start).toLocaleString()} – {new Date(m.scheduled_end).toLocaleTimeString()}</span>
                  </div>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK,marginBottom:4}}>{m.title}</div>
                  <div style={{fontSize:13,color:'#6b7280',fontFamily:FB}}>{m.description}</div>
                </div>
              ))}
              {maintenance.length===0&&<div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'48px',textAlign:'center',color:'#9ca3af',fontFamily:FB,fontSize:13}}>No maintenance scheduled</div>}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
