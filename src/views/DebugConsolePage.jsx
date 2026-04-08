"use client"
import { useState, useEffect, useRef } from 'react'
import { Search, RefreshCw, AlertCircle, Info, AlertTriangle, Bug, Plus, X, Check, Clock, Activity, Globe, Zap, Users, FileText, Shield, ChevronDown, ChevronRight, Loader2, Sparkles, ExternalLink } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'

const R   = '#E6007E',T='#00C2CB',BLK='#111111',GRY='#F9F9F9',GRN='#16a34a',AMB='#f59e0b'
const FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB="'Raleway','Helvetica Neue',sans-serif"

const LEVEL_COLOR={info:T,warn:AMB,error:R,debug:'#9ca3af'}
const LEVEL_ICON={info:Info,warn:AlertTriangle,error:AlertCircle,debug:Bug}
const SEVERITY_MAP={p1:{label:'P1 Critical',color:R,icon:AlertCircle},p2:{label:'P2 Warning',color:AMB,icon:AlertTriangle},p3:{label:'P3 Info',color:T,icon:Info}}
const ERROR_TYPES=['js_error','api_error','db_error','wp_error']
const SERVICES=['supabase','vercel','auth','api','wordpress']

/* ───────── Sub-components ───────── */

function StatCard({label,value,icon:Icon,color,subtitle}){
  return(
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:'16px 20px',display:'flex',alignItems:'center',gap:12,transition:'box-shadow .15s',cursor:'default'}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.06)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
      <div style={{width:40,height:40,borderRadius:10,background:color+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <Icon size={18} color={color}/>
      </div>
      <div>
        <div style={{fontFamily:FH,fontSize:22,fontWeight:900,color:BLK,lineHeight:1}}>{value??'--'}</div>
        <div style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginTop:2}}>{label}</div>
        {subtitle&&<div style={{fontSize:10,color:'#b0b0b0',fontFamily:FB}}>{subtitle}</div>}
      </div>
    </div>
  )
}

function SeverityBadge({severity}){
  const s=SEVERITY_MAP[severity]||SEVERITY_MAP.p3
  return(
    <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:s.color+'20',color:s.color,fontFamily:FH,textTransform:'uppercase',whiteSpace:'nowrap'}}>
      {s.label}
    </span>
  )
}

function ServiceRow({service,status,response_ms}){
  const c=status==='operational'?GRN:status==='degraded'?AMB:R
  return(
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #f3f4f6'}}>
      <span style={{width:8,height:8,borderRadius:'50%',background:c,flexShrink:0,display:'inline-block'}}/>
      <span style={{fontFamily:FH,fontSize:13,fontWeight:600,color:BLK,flex:1,textTransform:'capitalize'}}>{service}</span>
      {response_ms!=null&&<span style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>{response_ms}ms</span>}
      <span style={{fontSize:11,fontWeight:700,color:c,fontFamily:FH}}>{status}</span>
    </div>
  )
}

function TimelineChart({errors}){
  const now=Date.now()
  const hours=Array.from({length:24},(_,i)=>i)
  const buckets=hours.map(h=>{
    const start=now-(24-h)*3600000
    const end=now-(23-h)*3600000
    return errors.filter(e=>{const t=new Date(e.created_at).getTime();return t>=start&&t<end}).length
  })
  const max=Math.max(...buckets,1)
  return(
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'18px 20px',marginBottom:20}}>
      <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:12}}>Error Timeline (24h)</div>
      <div style={{display:'flex',alignItems:'flex-end',gap:3,height:80}}>
        {buckets.map((count,i)=>{
          const pct=count/max*100
          const isRecent=i>=22
          return(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}} title={`${24-i}h ago: ${count} errors`}>
              <div style={{width:'100%',minHeight:2,height:`${pct}%`,background:count===0?'#f3f4f6':isRecent?R:R+'80',borderRadius:3,transition:'height .3s'}}/>
            </div>
          )
        })}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
        <span style={{fontSize:9,color:'#9ca3af',fontFamily:FB}}>24h ago</span>
        <span style={{fontSize:9,color:'#9ca3af',fontFamily:FB}}>now</span>
      </div>
    </div>
  )
}

function CodeBlock({code}){
  if(!code)return null
  return(
    <pre style={{background:'#1e1e1e',color:'#d4d4d4',padding:16,borderRadius:10,fontSize:12,fontFamily:"'Fira Code','Cascadia Code',monospace",overflow:'auto',maxHeight:300,lineHeight:1.6,margin:'8px 0',whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
      {code}
    </pre>
  )
}

/* ───────── Helper: group errors by message ───────── */

function groupErrors(errors){
  const map={}
  errors.forEach(e=>{
    const key=e.message||e.error_message||'Unknown error'
    if(!map[key]){
      map[key]={message:key,errors:[e],count:1,severity:e.metadata?.severity||'p3',type:e.metadata?.error_type||e.error_type||'js_error',firstSeen:e.created_at,lastSeen:e.created_at,users:new Set(),resolved:!!e.resolved}
    }else{
      map[key].errors.push(e)
      map[key].count++
      if(new Date(e.created_at)<new Date(map[key].firstSeen))map[key].firstSeen=e.created_at
      if(new Date(e.created_at)>new Date(map[key].lastSeen))map[key].lastSeen=e.created_at
      if(!e.resolved)map[key].resolved=false
    }
    const uid=e.metadata?.user_id||e.user_id
    if(uid)map[key].users.add(uid)
  })
  return Object.values(map).sort((a,b)=>b.count-a.count).map(g=>({...g,userCount:g.users.size}))
}

/* ───────── Main Component ───────── */

export default function DebugConsolePage(){
  const [tab,setTab]=useState('overview')
  const [health,setHealth]=useState(null)
  const [stats,setStats]=useState(null)
  const [errors,setErrors]=useState([])
  const [allLogs,setAllLogs]=useState([])
  const [incidents,setIncidents]=useState([])
  const [repairs,setRepairs]=useState([])
  const [loading,setLoading]=useState(true)
  const [autoRefresh,setAutoRefresh]=useState(true)
  const [lastUpdated,setLastUpdated]=useState(null)
  const [checkingHealth,setCheckingHealth]=useState(false)

  // Errors tab state
  const [errorFilter,setErrorFilter]=useState({search:'',severity:'',type:'',resolved:false})
  const [expandedGroup,setExpandedGroup]=useState(null)
  const [repairingId,setRepairingId]=useState(null)
  const [repairResults,setRepairResults]=useState({})

  // Incidents tab state
  const [showIncidentForm,setShowIncidentForm]=useState(false)
  const [incidentForm,setIncidentForm]=useState({title:'',description:'',severity:'minor',services:[]})

  const pollRef=useRef(null)
  const logsRef=useRef(null)

  /* ── Data fetching ── */

  async function fetchErrors(){
    try{
      const res=await fetch('/api/errors?level=error')
      const data=await res.json()
      return Array.isArray(data)?data:(data.errors||data.data||[])
    }catch(e){console.error('fetchErrors:',e);return[]}
  }

  async function fetchStats(){
    try{
      const res=await fetch('/api/health?action=stats')
      const data=await res.json()
      return data
    }catch(e){console.error('fetchStats:',e);return null}
  }

  async function fetchHealth(){
    try{
      const res=await fetch('/api/health')
      const data=await res.json()
      return data
    }catch(e){console.error('fetchHealth:',e);return null}
  }

  async function fetchIncidents(){
    try{
      const res=await fetch('/api/health?action=incidents')
      const data=await res.json()
      return{incidents:data.incidents||[],maintenance:data.maintenance||[]}
    }catch(e){console.error('fetchIncidents:',e);return{incidents:[],maintenance:[]}}
  }

  async function fetchRepairs(){
    try{
      const res=await fetch('/api/autorepair?action=log')
      const data=await res.json()
      return Array.isArray(data)?data:(data.repairs||data.data||[])
    }catch(e){console.error('fetchRepairs:',e);return[]}
  }

  async function loadAll(silent=false){
    if(!silent)setLoading(true)
    try{
      const [errs,st,h,inc,rep]=await Promise.all([
        fetchErrors(),fetchStats(),fetchHealth(),fetchIncidents(),fetchRepairs()
      ])
      setErrors(errs)
      setStats(st)
      setHealth(h)
      setIncidents(inc.incidents||[])
      setRepairs(rep)
      setLastUpdated(new Date())
    }catch(e){
      console.error('loadAll:',e)
      if(!silent)toast.error('Failed to load dashboard data')
    }
    setLoading(false)
  }

  async function refreshHealth(){
    setCheckingHealth(true)
    try{
      const h=await fetchHealth()
      setHealth(h)
      setLastUpdated(new Date())
      toast.success('Health check completed')
    }catch(e){
      toast.error('Health check failed')
    }
    setCheckingHealth(false)
  }

  /* ── Actions ── */

  async function markResolved(errorId){
    try{
      await fetch('/api/errors',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:errorId,resolved:true})})
      toast.success('Error marked as resolved')
      loadAll(true)
    }catch(e){
      toast.error('Failed to mark resolved')
    }
  }

  async function triggerAutoRepair(error){
    const id=error.id||error.errors?.[0]?.id
    setRepairingId(id)
    try{
      const res=await fetch('/api/autorepair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({error_id:id,message:error.message,stack:error.stack||error.errors?.[0]?.stack,metadata:error.metadata||error.errors?.[0]?.metadata})})
      const data=await res.json()
      setRepairResults(prev=>({...prev,[id]:data}))
      toast.success('Auto-repair suggestion generated')
    }catch(e){
      toast.error('Auto-repair failed')
      setRepairResults(prev=>({...prev,[id]:{error:'Auto-repair request failed'}}))
    }
    setRepairingId(null)
  }

  async function createIncident(){
    if(!incidentForm.title.trim()){toast.error('Title is required');return}
    try{
      await fetch('/api/health',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_incident',...incidentForm})})
      setShowIncidentForm(false)
      setIncidentForm({title:'',description:'',severity:'minor',services:[]})
      toast.success('Incident created')
      loadAll(true)
    }catch(e){toast.error('Failed to create incident')}
  }

  async function resolveIncident(id){
    try{
      await fetch('/api/health',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_incident',id,status:'resolved',update_message:'Issue has been resolved.'})})
      toast.success('Incident resolved')
      loadAll(true)
    }catch(e){toast.error('Failed to resolve incident')}
  }

  /* ── Polling ── */

  useEffect(()=>{loadAll()},[])

  useEffect(()=>{
    if(autoRefresh){
      pollRef.current=setInterval(()=>loadAll(true),10000)
    }
    return()=>{if(pollRef.current)clearInterval(pollRef.current)}
  },[autoRefresh])

  /* ── Derived state ── */

  const overall=health?.overall||'operational'
  const overallColor=overall==='operational'?GRN:overall==='degraded'?AMB:R
  const activeIncidents=incidents.filter(i=>i.status!=='resolved')

  const now24h=Date.now()-86400000
  const errors24h=errors.filter(e=>new Date(e.created_at).getTime()>now24h)
  const p1Count=errors24h.filter(e=>(e.metadata?.severity||'').toLowerCase()==='p1').length
  const p2Count=errors24h.filter(e=>(e.metadata?.severity||'').toLowerCase()==='p2').length
  const p3Count=errors24h.filter(e=>(e.metadata?.severity||'').toLowerCase()==='p3').length

  // Filtered errors
  const filteredErrors=errors.filter(e=>{
    if(errorFilter.severity&&(e.metadata?.severity||'')!==errorFilter.severity)return false
    if(errorFilter.type&&(e.metadata?.error_type||e.error_type||'')!==errorFilter.type)return false
    if(!errorFilter.resolved&&e.resolved)return false
    if(errorFilter.search){
      const s=errorFilter.search.toLowerCase()
      const msg=(e.message||e.error_message||'').toLowerCase()
      const url=(e.metadata?.url||e.url||'').toLowerCase()
      if(!msg.includes(s)&&!url.includes(s))return false
    }
    return true
  })
  const grouped=groupErrors(filteredErrors)

  const TABS=[
    {key:'overview',label:'Overview',icon:Activity},
    {key:'errors',label:'Errors',icon:AlertCircle,badge:errors24h.length},
    {key:'health',label:'Health',icon:Shield},
    {key:'incidents',label:'Incidents',icon:AlertTriangle,badge:activeIncidents.length},
    {key:'repairs',label:'Auto-Repairs',icon:Sparkles,badge:repairs.length},
  ]

  const inp={width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #e5e7eb',fontSize:12,fontFamily:FB,outline:'none',boxSizing:'border-box'}

  if(loading){
    return(
      <div style={{display:'flex',height:'100vh',overflow:'hidden',background:GRY}}>
        <Sidebar/>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{textAlign:'center'}}>
            <Loader2 size={32} color={T} style={{animation:'spin 1s linear infinite'}}/>
            <div style={{fontFamily:FH,fontSize:14,fontWeight:600,color:'#9ca3af',marginTop:12}}>Loading debug console...</div>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>
    )
  }

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:GRY}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* ══════════ HEADER ══════════ */}
        <div style={{background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'16px 28px',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily:FH,fontSize:18,fontWeight:800,color:'#fff',letterSpacing:'-.02em',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:overallColor,display:'inline-block',boxShadow:`0 0 0 3px ${overallColor}30`}}/>
              Debug Console
              {autoRefresh&&(
                <span style={{display:'inline-flex',alignItems:'center',gap:4,marginLeft:8,padding:'2px 8px',borderRadius:20,background:GRN+'20',fontSize:10,fontWeight:700,color:GRN,fontFamily:FH}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:GRN,display:'inline-block',animation:'pulse 2s ease-in-out infinite'}}/>
                  LIVE
                </span>
              )}
            </div>
            <div style={{fontSize:12,color:'#999999',fontFamily:FB,marginTop:2}}>
              {overall==='operational'?'All systems operational':overall==='degraded'?'Partial outage detected':'Major outage'}
              {lastUpdated&&` · Updated ${lastUpdated.toLocaleTimeString()}`}
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={()=>setAutoRefresh(p=>!p)} style={{padding:'7px 14px',borderRadius:9,border:`1px solid ${autoRefresh?GRN+'60':'rgba(255,255,255,.15)'}`,background:autoRefresh?GRN+'15':'transparent',color:autoRefresh?GRN:'rgba(255,255,255,.6)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:5}}>
              <Activity size={12}/> {autoRefresh?'Auto-refresh ON':'Auto-refresh OFF'}
            </button>
            <a href="/status" target="_blank" style={{padding:'7px 14px',borderRadius:9,border:'1px solid rgba(255,255,255,.15)',color:'#999999',fontSize:12,fontWeight:600,fontFamily:FH,textDecoration:'none',display:'flex',alignItems:'center',gap:5}}>
              <Globe size={12}/> Public Status
            </a>
            <button onClick={refreshHealth} disabled={checkingHealth} style={{padding:'7px 14px',borderRadius:9,border:'none',background:T,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:5,opacity:checkingHealth?.7:1}}>
              <RefreshCw size={12} style={{animation:checkingHealth?'spin 1s linear infinite':'none'}}/> Check Now
            </button>
          </div>
        </div>

        {/* ══════════ TABS ══════════ */}
        <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'0 28px',display:'flex',gap:2,flexShrink:0}}>
          {TABS.map(t=>{const Icon=t.icon;const active=tab===t.key;return(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{display:'flex',alignItems:'center',gap:5,padding:'12px 16px',border:'none',borderBottom:`2px solid ${active?R:'transparent'}`,background:'transparent',color:active?R:'#6b7280',fontSize:13,fontWeight:active?700:400,cursor:'pointer',fontFamily:FH,transition:'color .15s'}}>
              <Icon size={13}/>{t.label}
              {t.badge>0&&<span style={{fontSize:9,fontWeight:800,padding:'1px 5px',borderRadius:10,background:R,color:'#fff'}}>{t.badge}</span>}
            </button>
          )})}
        </div>

        {/* ══════════ CONTENT AREA ══════════ */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 28px'}}>

          {/* ──────── OVERVIEW TAB ──────── */}
          {tab==='overview'&&(
            <div>
              {/* Severity Stat Cards */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
                <StatCard label="P1 Critical" value={p1Count} icon={AlertCircle} color={R} subtitle="Last 24h"/>
                <StatCard label="P2 Warning" value={p2Count} icon={AlertTriangle} color={AMB} subtitle="Last 24h"/>
                <StatCard label="P3 Info" value={p3Count} icon={Info} color={T} subtitle="Last 24h"/>
                <StatCard label="Total Errors" value={errors24h.length} icon={Zap} color={BLK} subtitle="Last 24h"/>
              </div>

              {/* Timeline */}
              <TimelineChart errors={errors}/>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
                {/* Service Health */}
                <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'18px 20px'}}>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
                    <Shield size={14} color={T}/> Service Health
                  </div>
                  {(health?.services||[]).map(s=><ServiceRow key={s.service} {...s}/>)}
                  {(health?.wordpress||[]).map((w,i)=><ServiceRow key={i} service={w.site_url?.replace(/^https?:\/\//,'')||'WP Site'} status={w.status} response_ms={w.response_ms}/>)}
                  {!health?.services?.length&&<div style={{fontSize:13,color:'#9ca3af',fontFamily:FB,textAlign:'center',padding:'20px 0'}}>Click "Check Now" to run health check</div>}
                </div>

                {/* Recent Errors */}
                <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'18px 20px'}}>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
                    <AlertCircle size={14} color={R}/> Recent Errors
                  </div>
                  {errors.slice(0,8).map((err,idx)=>(
                    <div key={err.id||idx} style={{padding:'8px 0',borderBottom:'1px solid #f3f4f6'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <SeverityBadge severity={err.metadata?.severity||'p3'}/>
                        <span style={{fontFamily:FH,fontSize:12,fontWeight:600,color:R}}>{err.metadata?.service||err.service||'app'}</span>
                      </div>
                      <div style={{fontSize:12,color:'#6b7280',fontFamily:FB,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2}}>{err.message||err.error_message||'Unknown error'}</div>
                      <div style={{fontSize:10,color:'#9ca3af',fontFamily:FB}}>{err.created_at?new Date(err.created_at).toLocaleString():'--'}</div>
                    </div>
                  ))}
                  {errors.length===0&&<div style={{fontSize:13,color:'#9ca3af',fontFamily:FB,textAlign:'center',padding:'20px 0'}}>No errors logged</div>}
                </div>
              </div>

              {/* Quick Stats Row */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                <StatCard label="Total Users" value={stats?.userCount} icon={Users} color={T}/>
                <StatCard label="Pages Generated" value={stats?.pageCount} icon={FileText} color={GRN}/>
                <StatCard label="Active Incidents" value={activeIncidents.length} icon={AlertTriangle} color={AMB}/>
                <StatCard label="Auto-Repairs" value={repairs.length} icon={Sparkles} color={'#8b5cf6'}/>
              </div>
            </div>
          )}

          {/* ──────── ERRORS TAB ──────── */}
          {tab==='errors'&&(
            <div>
              {/* Severity Stat Cards */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
                <StatCard label="P1 Critical" value={p1Count} icon={AlertCircle} color={R} subtitle="Last 24h"/>
                <StatCard label="P2 Warning" value={p2Count} icon={AlertTriangle} color={AMB} subtitle="Last 24h"/>
                <StatCard label="P3 Info" value={p3Count} icon={Info} color={T} subtitle="Last 24h"/>
                <StatCard label="Total Errors" value={errors24h.length} icon={Zap} color={BLK} subtitle="Last 24h"/>
              </div>

              {/* Timeline */}
              <TimelineChart errors={filteredErrors}/>

              {/* Filters Bar */}
              <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
                <div style={{position:'relative',flex:1,minWidth:200}}>
                  <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}/>
                  <input value={errorFilter.search} onChange={e=>setErrorFilter(p=>({...p,search:e.target.value}))} placeholder="Search errors by message or URL..." style={{...inp,paddingLeft:30}}/>
                </div>
                <select value={errorFilter.severity} onChange={e=>setErrorFilter(p=>({...p,severity:e.target.value}))} style={{...inp,width:130}}>
                  <option value="">All Severity</option>
                  <option value="p1">P1 Critical</option>
                  <option value="p2">P2 Warning</option>
                  <option value="p3">P3 Info</option>
                </select>
                <select value={errorFilter.type} onChange={e=>setErrorFilter(p=>({...p,type:e.target.value}))} style={{...inp,width:140}}>
                  <option value="">All Types</option>
                  {ERROR_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ').toUpperCase()}</option>)}
                </select>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontFamily:FH,color:'#6b7280',cursor:'pointer',padding:'6px 12px',borderRadius:8,border:'1.5px solid #e5e7eb',background:'#fff',userSelect:'none'}}>
                  <input type="checkbox" checked={errorFilter.resolved} onChange={e=>setErrorFilter(p=>({...p,resolved:e.target.checked}))} style={{accentColor:T}}/>
                  Show resolved
                </label>
              </div>

              {/* Grouped Errors List */}
              <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden'}} ref={logsRef}>
                {/* Header row */}
                <div style={{display:'grid',gridTemplateColumns:'32px 1fr 80px 80px 80px 80px 100px',gap:8,padding:'10px 16px',borderBottom:'1px solid #f3f4f6',fontSize:10,fontWeight:700,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',letterSpacing:'.06em',alignItems:'center'}}>
                  <span/>
                  <span>Error Message</span>
                  <span>Count</span>
                  <span>Severity</span>
                  <span>Type</span>
                  <span>Users</span>
                  <span>Last Seen</span>
                </div>

                {grouped.length===0&&<div style={{padding:'48px',textAlign:'center',color:'#9ca3af',fontFamily:FB,fontSize:13}}>No errors found matching filters</div>}

                {grouped.map((group,gi)=>{
                  const isExpanded=expandedGroup===gi
                  const latestError=group.errors[0]
                  return(
                    <div key={gi}>
                      {/* Group Row */}
                      <div onClick={()=>setExpandedGroup(isExpanded?null:gi)}
                        style={{display:'grid',gridTemplateColumns:'32px 1fr 80px 80px 80px 80px 100px',gap:8,padding:'11px 16px',borderBottom:'1px solid #f9fafb',alignItems:'center',cursor:'pointer',background:isExpanded?R+'06':group.severity==='p1'?R+'04':'transparent',transition:'background .15s'}}
                        onMouseEnter={e=>{if(!isExpanded)e.currentTarget.style.background='#f9fafb'}}
                        onMouseLeave={e=>{if(!isExpanded)e.currentTarget.style.background=group.severity==='p1'?R+'04':'transparent'}}>
                        <div style={{display:'flex',justifyContent:'center'}}>
                          {isExpanded?<ChevronDown size={14} color="#6b7280"/>:<ChevronRight size={14} color="#9ca3af"/>}
                        </div>
                        <div style={{overflow:'hidden'}}>
                          <div style={{fontSize:12,fontWeight:600,color:'#374151',fontFamily:FH,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{group.message}</div>
                          <div style={{fontSize:10,color:'#9ca3af',fontFamily:FB,marginTop:1}}>First: {new Date(group.firstSeen).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                        </div>
                        <div>
                          <span style={{fontSize:12,fontWeight:800,color:group.count>50?R:group.count>10?AMB:'#6b7280',fontFamily:FH,display:'inline-flex',alignItems:'center',gap:3}}>
                            <X size={10}/>{group.count}
                          </span>
                        </div>
                        <div><SeverityBadge severity={group.severity}/></div>
                        <div style={{fontSize:10,color:'#6b7280',fontFamily:FB,textTransform:'uppercase'}}>{group.type?.replace('_',' ')||'--'}</div>
                        <div style={{fontSize:11,color:'#6b7280',fontFamily:FB,display:'flex',alignItems:'center',gap:3}}>
                          <Users size={10}/>{group.userCount}
                        </div>
                        <div style={{fontSize:10,color:'#9ca3af',fontFamily:FB}}>{new Date(group.lastSeen).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded&&(
                        <div style={{padding:'16px 20px 16px 48px',background:'#fafafa',borderBottom:'1px solid #e5e7eb'}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                            <div>
                              <div style={{fontSize:10,fontWeight:700,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',marginBottom:4}}>URL</div>
                              <div style={{fontSize:12,color:'#374151',fontFamily:FB,wordBreak:'break-all'}}>{latestError.metadata?.url||latestError.url||'N/A'}</div>
                            </div>
                            <div>
                              <div style={{fontSize:10,fontWeight:700,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',marginBottom:4}}>User / Agency</div>
                              <div style={{fontSize:12,color:'#374151',fontFamily:FB}}>{latestError.metadata?.user_email||latestError.user_id||'Anonymous'}{latestError.metadata?.agency_name?` · ${latestError.metadata.agency_name}`:''}</div>
                            </div>
                            <div>
                              <div style={{fontSize:10,fontWeight:700,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',marginBottom:4}}>Timestamp</div>
                              <div style={{fontSize:12,color:'#374151',fontFamily:FB}}>{latestError.created_at?new Date(latestError.created_at).toLocaleString():'--'}</div>
                            </div>
                            <div>
                              <div style={{fontSize:10,fontWeight:700,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',marginBottom:4}}>Occurrences</div>
                              <div style={{fontSize:12,color:'#374151',fontFamily:FB}}>{group.count} times across {group.userCount} user{group.userCount!==1?'s':''}</div>
                            </div>
                          </div>

                          {/* Stack Trace */}
                          {(latestError.stack||latestError.metadata?.stack)&&(
                            <div style={{marginBottom:16}}>
                              <div style={{fontSize:10,fontWeight:700,color:'#9ca3af',fontFamily:FH,textTransform:'uppercase',marginBottom:4}}>Stack Trace</div>
                              <CodeBlock code={latestError.stack||latestError.metadata?.stack}/>
                            </div>
                          )}

                          {/* Repair Result */}
                          {repairResults[latestError.id]&&(
                            <div style={{marginBottom:16,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:16}}>
                              <div style={{fontSize:10,fontWeight:700,color:GRN,fontFamily:FH,textTransform:'uppercase',marginBottom:6,display:'flex',alignItems:'center',gap:4}}>
                                <Sparkles size={11}/> Auto-Repair Suggestion
                              </div>
                              {repairResults[latestError.id].error?(
                                <div style={{fontSize:12,color:R,fontFamily:FB}}>{repairResults[latestError.id].error}</div>
                              ):(
                                <>
                                  <div style={{fontSize:12,color:'#374151',fontFamily:FB,marginBottom:8}}>{repairResults[latestError.id].explanation||repairResults[latestError.id].suggestion||'Repair suggestion generated.'}</div>
                                  {repairResults[latestError.id].code&&<CodeBlock code={repairResults[latestError.id].code}/>}
                                  {repairResults[latestError.id].fix&&<CodeBlock code={repairResults[latestError.id].fix}/>}
                                </>
                              )}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>markResolved(latestError.id)} style={{padding:'7px 14px',borderRadius:9,border:`1px solid ${GRN}`,background:GRN+'10',color:GRN,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:5}}>
                              <Check size={12}/> Mark Resolved
                            </button>
                            <button onClick={()=>triggerAutoRepair(group)} disabled={repairingId===latestError.id} style={{padding:'7px 14px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:5,opacity:repairingId===latestError.id?.6:1}}>
                              {repairingId===latestError.id?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={12}/>}
                              {repairingId===latestError.id?'Analyzing...':'Auto-Repair'}
                            </button>
                            {latestError.metadata?.url&&(
                              <a href={latestError.metadata.url} target="_blank" rel="noopener noreferrer" style={{padding:'7px 14px',borderRadius:9,border:'1px solid #e5e7eb',background:'#fff',color:'#6b7280',fontSize:12,fontWeight:600,fontFamily:FH,display:'flex',alignItems:'center',gap:5,textDecoration:'none',cursor:'pointer'}}>
                                <ExternalLink size={12}/> View Page
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ──────── HEALTH TAB ──────── */}
          {tab==='health'&&(
            <div>
              {/* Overall status banner */}
              <div style={{background:overallColor+'10',border:`1.5px solid ${overallColor}40`,borderRadius:14,padding:'20px 24px',marginBottom:20,display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:48,height:48,borderRadius:12,background:overallColor+'20',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Shield size={24} color={overallColor}/>
                </div>
                <div>
                  <div style={{fontFamily:FH,fontSize:16,fontWeight:800,color:BLK}}>
                    {overall==='operational'?'All Systems Operational':overall==='degraded'?'Partial System Outage':'Major Outage Detected'}
                  </div>
                  <div style={{fontSize:12,color:'#6b7280',fontFamily:FB,marginTop:2}}>
                    Last checked: {lastUpdated?lastUpdated.toLocaleString():'Never'}
                  </div>
                </div>
                <div style={{marginLeft:'auto'}}>
                  <button onClick={refreshHealth} disabled={checkingHealth} style={{padding:'8px 18px',borderRadius:9,border:'none',background:T,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:5}}>
                    <RefreshCw size={12} style={{animation:checkingHealth?'spin 1s linear infinite':'none'}}/> Re-check
                  </button>
                </div>
              </div>

              {/* Service Cards Grid */}
              <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:12}}>Core Services</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
                {(health?.services||[]).map(s=>{
                  const c=s.status==='operational'?GRN:s.status==='degraded'?AMB:R
                  return(
                    <div key={s.service} style={{background:'#fff',borderRadius:12,border:`1.5px solid ${c}30`,padding:'16px 20px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <span style={{width:10,height:10,borderRadius:'50%',background:c,display:'inline-block'}}/>
                        <span style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK,textTransform:'capitalize'}}>{s.service}</span>
                        <span style={{marginLeft:'auto',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:c+'20',color:c,fontFamily:FH,textTransform:'uppercase'}}>{s.status}</span>
                      </div>
                      {s.response_ms!=null&&(
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <Clock size={11} color="#9ca3af"/>
                          <span style={{fontSize:12,color:'#6b7280',fontFamily:FB}}>Response: {s.response_ms}ms</span>
                          <div style={{flex:1,height:4,background:'#f3f4f6',borderRadius:2,overflow:'hidden',marginLeft:4}}>
                            <div style={{height:'100%',borderRadius:2,background:s.response_ms<200?GRN:s.response_ms<500?AMB:R,width:`${Math.min(s.response_ms/1000*100,100)}%`,transition:'width .3s'}}/>
                          </div>
                        </div>
                      )}
                      {s.error&&<div style={{fontSize:11,color:R,fontFamily:FB,marginTop:6}}>{s.error}</div>}
                    </div>
                  )
                })}
                {(!health?.services||health.services.length===0)&&(
                  <div style={{gridColumn:'1/-1',background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'48px',textAlign:'center',color:'#9ca3af',fontFamily:FB,fontSize:13}}>No service data. Click "Check Now" to run health checks.</div>
                )}
              </div>

              {/* WordPress Sites */}
              {health?.wordpress&&health.wordpress.length>0&&(
                <>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
                    <Globe size={14} color={T}/> WordPress Sites
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:24}}>
                    {health.wordpress.map((w,i)=>{
                      const c=w.status==='operational'?GRN:w.status==='degraded'?AMB:R
                      return(
                        <div key={i} style={{background:'#fff',borderRadius:12,border:`1.5px solid ${c}30`,padding:'16px 20px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                            <Globe size={14} color={c}/>
                            <span style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{w.site_url?.replace(/^https?:\/\//,'')||'WordPress Site'}</span>
                            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:c+'20',color:c,fontFamily:FH}}>{w.status}</span>
                          </div>
                          <div style={{display:'flex',gap:12,alignItems:'center'}}>
                            {w.response_ms!=null&&<span style={{fontSize:11,color:'#6b7280',fontFamily:FB}}>Response: {w.response_ms}ms</span>}
                            {w.wp_version&&<span style={{fontSize:11,color:'#9ca3af',fontFamily:FB}}>WP {w.wp_version}</span>}
                          </div>
                          {w.error&&<div style={{fontSize:11,color:R,fontFamily:FB,marginTop:6}}>{w.error}</div>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Health Stats */}
              {stats&&(
                <>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK,marginBottom:12}}>System Statistics</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                    <StatCard label="Total Users" value={stats.userCount} icon={Users} color={T}/>
                    <StatCard label="Pages Generated" value={stats.pageCount} icon={FileText} color={GRN}/>
                    <StatCard label="Errors (24h)" value={stats.errorCount} icon={AlertCircle} color={R}/>
                    <StatCard label="Uptime" value={stats.uptime||'99.9%'} icon={Activity} color={GRN}/>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ──────── INCIDENTS TAB ──────── */}
          {tab==='incidents'&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK}}>Incidents</div>
                <button onClick={()=>setShowIncidentForm(true)} style={{padding:'8px 16px',borderRadius:9,border:'none',background:R,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:6}}>
                  <Plus size={12}/> New Incident
                </button>
              </div>

              {/* Active incidents count */}
              {activeIncidents.length>0&&(
                <div style={{background:R+'08',border:`1px solid ${R}20`,borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                  <AlertTriangle size={14} color={R}/>
                  <span style={{fontFamily:FH,fontSize:13,fontWeight:700,color:R}}>{activeIncidents.length} active incident{activeIncidents.length!==1?'s':''}</span>
                </div>
              )}

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
                const sevColor=inc.severity==='critical'?R:inc.severity==='major'?AMB:T
                return(
                  <div key={inc.id} style={{background:'#fff',borderRadius:14,border:`1.5px solid ${isActive?R+'30':'#e5e7eb'}`,padding:'18px 20px',marginBottom:10,transition:'border-color .15s'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:(inc.status==='resolved'?GRN:R)+'20',color:inc.status==='resolved'?GRN:R,fontFamily:FH,textTransform:'capitalize'}}>{inc.status}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:sevColor+'20',color:sevColor,fontFamily:FH,textTransform:'uppercase'}}>{inc.severity}</span>
                      {inc.services&&inc.services.map&&inc.services.map(s=>(
                        <span key={s} style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'#f3f4f6',color:'#6b7280',fontFamily:FB}}>{s}</span>
                      ))}
                      <span style={{fontSize:11,color:'#9ca3af',fontFamily:FB,marginLeft:'auto'}}>{new Date(inc.started_at||inc.created_at).toLocaleString()}</span>
                      {isActive&&<button onClick={()=>resolveIncident(inc.id)} style={{padding:'4px 10px',borderRadius:7,border:`1px solid ${GRN}`,background:GRN+'10',color:GRN,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:4}}><Check size={10}/> Resolve</button>}
                    </div>
                    <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK,marginBottom:4}}>{inc.title}</div>
                    <div style={{fontSize:13,color:'#6b7280',fontFamily:FB}}>{inc.description}</div>
                    {inc.updates&&inc.updates.length>0&&(
                      <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #f3f4f6'}}>
                        {inc.updates.map((u,ui)=>(
                          <div key={ui} style={{fontSize:12,color:'#6b7280',fontFamily:FB,marginBottom:4}}>
                            <span style={{fontWeight:600,color:'#374151'}}>{new Date(u.created_at).toLocaleTimeString()}</span> — {u.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {incidents.length===0&&<div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'48px',textAlign:'center',color:'#9ca3af',fontFamily:FB,fontSize:13}}>No incidents recorded</div>}
            </div>
          )}

          {/* ──────── AUTO-REPAIRS TAB ──────── */}
          {tab==='repairs'&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div>
                  <div style={{fontFamily:FH,fontSize:15,fontWeight:800,color:BLK}}>Auto-Repair Log</div>
                  <div style={{fontSize:12,color:'#9ca3af',fontFamily:FB,marginTop:2}}>AI-generated repair suggestions for detected errors</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <Sparkles size={14} color="#8b5cf6"/>
                  <span style={{fontSize:12,fontWeight:700,color:'#8b5cf6',fontFamily:FH}}>{repairs.length} repair{repairs.length!==1?'s':''}</span>
                </div>
              </div>

              {repairs.length===0&&(
                <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'48px',textAlign:'center'}}>
                  <Sparkles size={32} color="#d1d5db" style={{marginBottom:12}}/>
                  <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:'#9ca3af',marginBottom:4}}>No auto-repairs yet</div>
                  <div style={{fontSize:12,color:'#b0b0b0',fontFamily:FB}}>Click "Auto-Repair" on any error to generate an AI fix suggestion</div>
                </div>
              )}

              {repairs.map((rep,ri)=>(
                <div key={rep.id||ri} style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'18px 20px',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <div style={{width:32,height:32,borderRadius:8,background:'#8b5cf620',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <Sparkles size={14} color="#8b5cf6"/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{rep.error_message||rep.message||'Error repair'}</div>
                      <div style={{fontSize:10,color:'#9ca3af',fontFamily:FB}}>{rep.created_at?new Date(rep.created_at).toLocaleString():'--'}</div>
                    </div>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:rep.status==='applied'?GRN+'20':rep.status==='dismissed'?'#f3f4f6':'#8b5cf620',color:rep.status==='applied'?GRN:rep.status==='dismissed'?'#9ca3af':'#8b5cf6',fontFamily:FH,textTransform:'uppercase'}}>{rep.status||'suggested'}</span>
                  </div>
                  {rep.explanation&&<div style={{fontSize:12,color:'#374151',fontFamily:FB,marginBottom:8}}>{rep.explanation}</div>}
                  {rep.suggestion&&<div style={{fontSize:12,color:'#374151',fontFamily:FB,marginBottom:8}}>{rep.suggestion}</div>}
                  {(rep.code||rep.fix)&&<CodeBlock code={rep.code||rep.fix}/>}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>
    </div>
  )
}
