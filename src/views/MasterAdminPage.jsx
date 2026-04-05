"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw,
  Users, Star, CreditCard, Database, Server, Globe, Zap, Shield,
  TrendingUp, FileText, Settings, ChevronDown, ChevronUp,
  Terminal, Bell, BarChart2, Loader2, Circle, ArrowRight,
  Eye, Trash2, Download, Search, Filter, X, AlertCircle,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const STATUS_CFG = {
  ok:    { color: GREEN,  bg: '#f0fdf4', icon: CheckCircle, label: 'Healthy'  },
  warn:  { color: AMBER,  bg: '#fffbeb', icon: AlertTriangle,label: 'Warning' },
  error: { color: RED,    bg: '#fef2f2', icon: XCircle,     label: 'Error'    },
}

function StatusBadge({ status, small }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.ok
  const Icon = cfg.icon
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding: small?'2px 8px':'4px 10px', borderRadius:20, background:cfg.bg, color:cfg.color, fontSize: small?11:12, fontWeight:700, fontFamily:FH }}>
      <Icon size={small?11:13}/> {cfg.label}
    </span>
  )
}

function CheckRow({ check }) {
  const cfg = STATUS_CFG[check.status] || STATUS_CFG.ok
  const Icon = cfg.icon
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'1px solid #f3f4f6' }}>
      <Icon size={15} color={cfg.color} style={{ flexShrink:0 }}/>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:BLK, fontFamily:FH }}>{check.name}</div>
        <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{check.message}{check.detail ? ' — ' + check.detail : ''}</div>
      </div>
      {check.latency_ms != null && (
        <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace', flexShrink:0 }}>{check.latency_ms}ms</div>
      )}
      <div style={{ width:8, height:8, borderRadius:'50%', background:cfg.color, flexShrink:0 }}/>
    </div>
  )
}

function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
        {Icon && <Icon size={13} color={color||'#9ca3af'}/>}
        <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH }}>{label}</div>
      </div>
      <div style={{ fontFamily:FH, fontSize:28, fontWeight:900, color:color||BLK, letterSpacing:'-.03em' }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginTop:3 }}>{sub}</div>}
    </div>
  )
}

function UptimeDot({ status }) {
  const color = status==='ok' ? GREEN : status==='warn' ? AMBER : status==='error' ? RED : '#e5e7eb'
  return <div title={status} style={{ width:12, height:12, borderRadius:3, background:color, flexShrink:0 }}/>
}

export default function MasterAdminPage() {
  const [tab,           setTab]           = useState('overview')
  const [health,        setHealth]        = useState(null)
  const [stats,         setStats]         = useState(null)
  const [logs,          setLogs]          = useState([])
  const [checking,      setChecking]      = useState(false)
  const [autoRefresh,   setAutoRefresh]   = useState(false)
  const [refreshSecs,   setRefreshSecs]   = useState(60)
  const [countdown,     setCountdown]     = useState(0)
  const [agencies,      setAgencies]      = useState([])
  const [clients,       setClients]       = useState([])
  const [clientSearch,  setClientSearch]  = useState('')
  const [expandedLog,   setExpandedLog]   = useState(null)
  const [runningAudit,  setRunningAudit]  = useState(false)
  const [auditResult,   setAuditResult]   = useState(null)
  const intervalRef = useRef(null)
  const countRef    = useRef(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    loadStats()
    loadLogs()
    loadAgencies()
    loadClients()
  }

  async function loadStats() {
    const res = await fetch('/api/system?mode=stats')
    const d   = await res.json()
    setStats(d)
  }

  async function loadLogs() {
    const { data } = await supabase
      .from('system_health_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setLogs(data || [])
  }

  async function loadAgencies() {
    const { data } = await supabase.from('agencies').select('*').order('created_at', { ascending: false })
    setAgencies(data || [])
  }

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*,agencies(name)').order('created_at', { ascending: false })
    setClients(data || [])
  }

  async function runHealthCheck(mode = 'full') {
    setChecking(true)
    setHealth(null)
    try {
      const res = await fetch(`/api/system?mode=${mode}`)
      const d   = await res.json()
      setHealth(d)
      loadLogs()
      if (d.status === 'error') toast.error(`${d.errors} system error${d.errors > 1 ? 's' : ''} detected`)
      else if (d.status === 'warn') toast('⚠️ Warnings detected — check system health', { icon: '⚠️' })
      else toast.success('All systems operational')
    } catch (e) { toast.error('Health check failed: ' + e.message) }
    setChecking(false)
  }

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      setCountdown(refreshSecs)
      intervalRef.current = setInterval(() => runHealthCheck('quick'), refreshSecs * 1000)
      countRef.current = setInterval(() => setCountdown(c => c <= 1 ? refreshSecs : c - 1), 1000)
    } else {
      if(intervalRef.current) clearInterval(intervalRef.current)
      if(countRef.current) clearInterval(countRef.current)
    }
    return () => { if(intervalRef.current) clearInterval(intervalRef.current); if(countRef.current) clearInterval(countRef.current) }
  }, [autoRefresh, refreshSecs])

  async function runFullAudit() {
    setRunningAudit(true)
    setAuditResult(null)
    try {
      const res = await fetch('/api/system?mode=full')
      const d   = await res.json()
      setAuditResult(d)
      setHealth(d)
      loadLogs()
    } catch (e) { toast.error('Audit failed: ' + e.message) }
    setRunningAudit(false)
  }

  const fClients = clients.filter(c =>
    !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const lastOk   = health?.status === 'ok'
  const overallCfg = STATUS_CFG[health?.status || 'ok']

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'18px 28px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:'#fff', margin:0, letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:9 }}>
                <Shield size={18} color={RED}/> Master Admin
              </h1>
              <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', margin:'2px 0 0', fontFamily:FB }}>
                Full platform control — {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {/* Auto-refresh toggle */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:9, background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: autoRefresh ? GREEN : '#6b7280', animation: autoRefresh ? 'pulse 2s infinite' : 'none' }}/>
                <span style={{ fontSize:12, color:'rgba(255,255,255,.7)', fontFamily:FH, fontWeight:600 }}>
                  {autoRefresh ? `Auto-refresh ${countdown}s` : 'Auto-refresh off'}
                </span>
                <select value={refreshSecs} onChange={e=>setRefreshSecs(+e.target.value)}
                  style={{ background:'transparent', border:'none', color:'rgba(255,255,255,.5)', fontSize:11, cursor:'pointer', outline:'none' }}>
                  <option value={30} style={{color:BLK}}>30s</option>
                  <option value={60} style={{color:BLK}}>1m</option>
                  <option value={300} style={{color:BLK}}>5m</option>
                </select>
                <button onClick={()=>setAutoRefresh(a=>!a)}
                  style={{ padding:'3px 10px', borderRadius:7, border:'none', background: autoRefresh ? RED : 'rgba(255,255,255,.15)', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                  {autoRefresh ? 'Stop' : 'Start'}
                </button>
              </div>
              <button onClick={()=>runHealthCheck('full')} disabled={checking}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                {checking ? <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> : <BarChart2 size={13}/>}
                {checking ? 'Checking…' : 'Run Health Check'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:2, marginTop:14 }}>
            {[
              { id:'overview',  label:'Overview'    },
              { id:'health',    label:'System Health'},
              { id:'logs',      label:'Audit Log'    },
              { id:'agencies',  label:'Agencies'     },
              { id:'clients',   label:'All Clients'  },
              { id:'audit',     label:'Full Audit'   },
            ].map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{ padding:'7px 16px', borderRadius:'8px 8px 0 0', border:'none', cursor:'pointer', fontFamily:FH, fontSize:13, fontWeight:700,
                  background: tab===t.id ? '#f2f2f0' : 'transparent',
                  color: tab===t.id ? BLK : 'rgba(255,255,255,.5)' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div>
              {/* Stats row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
                <StatCard label="Agencies"      value={agencies.length}           icon={Shield}    color='#7c3aed'/>
                <StatCard label="Total Clients" value={stats?.clients || '—'}     icon={Users}     color={TEAL}/>
                <StatCard label="Active Subs"   value={stats?.activeSubscriptions||'—'} icon={CreditCard} color={GREEN}/>
                <StatCard label="Open Tickets"  value={stats?.tickets || '—'}     icon={Bell}      color={AMBER}/>
                <StatCard label="Total Reviews" value={stats?.reviews || '—'}     icon={Star}      color={RED}/>
              </div>

              {/* Health status banner */}
              <div style={{ background:'#fff', borderRadius:16, border:`2px solid ${health ? (STATUS_CFG[health.status]?.color||GREEN) : '#e5e7eb'}`, padding:'20px 24px', marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    {health ? (
                      <>
                        {health.status === 'ok' ? <CheckCircle size={28} color={GREEN}/> : health.status === 'warn' ? <AlertTriangle size={28} color={AMBER}/> : <XCircle size={28} color={RED}/>}
                        <div>
                          <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK }}>{STATUS_CFG[health.status]?.label || 'Healthy'}</div>
                          <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>
                            {health.checks?.length} checks · {health.errors} errors · {health.warnings} warnings · {health.duration_ms}ms
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Circle size={28} color="#e5e7eb"/>
                        <div>
                          <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:'#9ca3af' }}>Not checked yet</div>
                          <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>Run a health check to see system status</div>
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={()=>runHealthCheck('full')} disabled={checking}
                    style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', color:BLK, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6 }}>
                    {checking ? <Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> : <RefreshCw size={13}/>}
                    {checking ? 'Checking…' : 'Check Now'}
                  </button>
                </div>
                {health?.ai_analysis && (
                  <div style={{ marginTop:16, padding:'14px 16px', background:'#f8f8ff', borderRadius:10, border:'1px solid #e0e0ff' }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#7c3aed', fontFamily:FH, marginBottom:6, textTransform:'uppercase', letterSpacing:'.07em' }}>
                      🤖 Claude AI Analysis
                    </div>
                    <pre style={{ fontFamily:FB, fontSize:13, color:'#374151', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>{health.ai_analysis}</pre>
                  </div>
                )}
              </div>

              {/* Uptime history strip */}
              {logs.length > 0 && (
                <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:20 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>Uptime History</div>
                    <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>Last {Math.min(logs.length,60)} checks</div>
                  </div>
                  <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                    {logs.slice(0,60).reverse().map(log => (
                      <UptimeDot key={log.id} status={log.status}/>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:16, marginTop:10 }}>
                    {[['ok',GREEN,'Healthy'],['warn',AMBER,'Warning'],['error',RED,'Error']].map(([s,c,l])=>(
                      <div key={s} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#9ca3af', fontFamily:FB }}>
                        <div style={{ width:8, height:8, borderRadius:2, background:c }}/>
                        {l}
                      </div>
                    ))}
                    <div style={{ marginLeft:'auto', fontSize:12, color:'#9ca3af', fontFamily:FB }}>
                      {logs.filter(l=>l.status==='ok').length}/{logs.length} OK ({Math.round(logs.filter(l=>l.status==='ok').length/Math.max(1,logs.length)*100)}% uptime)
                    </div>
                  </div>
                </div>
              )}

              {/* Recent errors */}
              {logs.filter(l=>l.status==='error').length > 0 && (
                <div style={{ background:'#fff', borderRadius:14, border:`1px solid #fecaca`, padding:'16px 20px' }}>
                  <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:RED, marginBottom:12, display:'flex', alignItems:'center', gap:7 }}>
                    <AlertCircle size={15}/> Recent Errors
                  </div>
                  {logs.filter(l=>l.status==='error').slice(0,3).map(log => (
                    <div key={log.id} style={{ padding:'10px 0', borderBottom:'1px solid #f3f4f6' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:RED, fontFamily:FH }}>{log.error_count} error{log.error_count>1?'s':''}</span>
                        <span style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      {log.ai_analysis && <div style={{ fontSize:12, color:'#374151', fontFamily:FB, lineHeight:1.6 }}>{log.ai_analysis.slice(0,200)}…</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── HEALTH ── */}
          {tab === 'health' && (
            <div>
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:16 }}>
                <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK }}>Service Status</div>
                  {health && <StatusBadge status={health.status}/>}
                </div>
                {checking && (
                  <div style={{ padding:'32px', textAlign:'center', color:'#9ca3af', fontFamily:FB }}>
                    <Loader2 size={24} style={{ animation:'spin 1s linear infinite', margin:'0 auto 8px', display:'block' }} color={RED}/>
                    Running health checks across all services…
                  </div>
                )}
                {health?.checks?.map((check, i) => <CheckRow key={i} check={check}/>)}
                {!health && !checking && (
                  <div style={{ padding:'40px', textAlign:'center' }}>
                    <BarChart2 size={32} color="#e5e7eb" style={{ margin:'0 auto 12px', display:'block' }}/>
                    <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:'#9ca3af', marginBottom:8 }}>No health data yet</div>
                    <button onClick={()=>runHealthCheck('full')}
                      style={{ padding:'9px 22px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                      Run Health Check
                    </button>
                  </div>
                )}
              </div>
              {health?.ai_analysis && (
                <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'20px 22px' }}>
                  <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:'#7c3aed', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>
                    🤖 Claude AI Diagnosis
                  </div>
                  <pre style={{ fontFamily:FB, fontSize:14, color:'#374151', lineHeight:1.8, whiteSpace:'pre-wrap', margin:0 }}>{health.ai_analysis}</pre>
                </div>
              )}
            </div>
          )}

          {/* ── LOGS ── */}
          {tab === 'logs' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK }}>System Audit Log</div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={loadLogs} style={{ padding:'7px 14px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                    <RefreshCw size={11}/> Refresh
                  </button>
                </div>
              </div>
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                {logs.length === 0 && (
                  <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontFamily:FB }}>No logs yet — run a health check to start logging.</div>
                )}
                {logs.map(log => (
                  <div key={log.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                    <div onClick={()=>setExpandedLog(expandedLog===log.id ? null : log.id)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:(STATUS_CFG[log.status]||STATUS_CFG.ok).color, flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <StatusBadge status={log.status} small/>
                          <span style={{ fontSize:12, color:'#374151', fontFamily:FB }}>
                            {log.error_count} error{log.error_count!==1?'s':''} · {log.warn_count} warning{log.warn_count!==1?'s':''}
                          </span>
                        </div>
                        <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace', marginTop:2 }}>
                          {new Date(log.created_at).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true})}
                        </div>
                      </div>
                      {expandedLog===log.id ? <ChevronUp size={13} color="#9ca3af"/> : <ChevronDown size={13} color="#9ca3af"/>}
                    </div>
                    {expandedLog===log.id && (
                      <div style={{ padding:'0 16px 16px' }}>
                        {log.checks && (
                          <div style={{ marginBottom:10 }}>
                            <div style={{ fontSize:11, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Check Results</div>
                            {(log.checks || []).map((c,i) => (
                              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'1px solid #f9fafb', fontSize:12 }}>
                                <div style={{ width:6, height:6, borderRadius:'50%', background:(STATUS_CFG[c.status]||STATUS_CFG.ok).color, flexShrink:0 }}/>
                                <span style={{ fontFamily:FH, fontWeight:600, color:BLK, width:180 }}>{c.name}</span>
                                <span style={{ fontFamily:FB, color:'#6b7280', flex:1 }}>{c.message}</span>
                                {c.latency_ms!=null && <span style={{ fontFamily:'monospace', color:'#9ca3af', fontSize:11 }}>{c.latency_ms}ms</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {log.ai_analysis && (
                          <div style={{ padding:'12px 14px', background:'#f8f8ff', borderRadius:9, border:'1px solid #e0e0ff' }}>
                            <div style={{ fontSize:11, fontWeight:800, color:'#7c3aed', fontFamily:FH, marginBottom:6 }}>🤖 Claude AI Analysis</div>
                            <pre style={{ fontFamily:FB, fontSize:12, color:'#374151', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>{log.ai_analysis}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AGENCIES ── */}
          {tab === 'agencies' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
                <StatCard label="Total Agencies" value={agencies.length} icon={Shield} color='#7c3aed'/>
                <StatCard label="Active Subs" value={agencies.filter(a=>a.status==='active').length} icon={CheckCircle} color={GREEN}/>
                <StatCard label="No Plan" value={agencies.filter(a=>!a.plan||a.plan==='none').length} icon={AlertTriangle} color={AMBER}/>
              </div>
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #f3f4f6', fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>All Agencies</div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f9fafb' }}>
                      {['Agency','Plan','Status','Clients','Created'].map(h=>(
                        <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.map(ag => (
                      <tr key={ag.id} style={{ borderTop:'1px solid #f3f4f6' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{ag.name}</div>
                          <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{ag.id.slice(0,8)}…</div>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <span style={{ padding:'3px 10px', borderRadius:20, background:'#f3f4f6', fontSize:12, fontWeight:700, fontFamily:FH, color:BLK }}>
                            {ag.plan || 'none'}
                          </span>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <StatusBadge status={ag.status==='active'?'ok':ag.status==='canceled'?'error':'warn'} small/>
                        </td>
                        <td style={{ padding:'12px 16px', fontSize:13, color:'#374151', fontFamily:FB }}>
                          {clients.filter(c=>c.agency_id===ag.id).length}
                        </td>
                        <td style={{ padding:'12px 16px', fontSize:12, color:'#9ca3af', fontFamily:'monospace' }}>
                          {new Date(ag.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── CLIENTS ── */}
          {tab === 'clients' && (
            <div>
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', padding:'8px 12px' }}>
                  <Search size={14} color="#9ca3af"/>
                  <input value={clientSearch} onChange={e=>setClientSearch(e.target.value)}
                    placeholder="Search clients by name or email…"
                    style={{ border:'none', outline:'none', fontSize:14, flex:1, fontFamily:FH, color:BLK }}/>
                  {clientSearch && <button onClick={()=>setClientSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={12}/></button>}
                </div>
                <div style={{ padding:'8px 14px', background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', fontSize:13, color:'#6b7280', fontFamily:FB, display:'flex', alignItems:'center' }}>
                  {fClients.length} of {clients.length} clients
                </div>
              </div>
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f9fafb' }}>
                      {['Client','Agency','Industry','SIC','Status','Created'].map(h=>(
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fClients.slice(0,100).map(cl => (
                      <tr key={cl.id} style={{ borderTop:'1px solid #f3f4f6' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{cl.name}</div>
                          <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{cl.email}</div>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:'#374151', fontFamily:FB }}>{cl.agencies?.name || '—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:'#374151', fontFamily:FB }}>{cl.industry || '—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{cl.sic_code || '—'}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, fontFamily:FH,
                            background: cl.status==='active'?'#f0fdf4':cl.status==='prospect'?'#f0fbfc':'#f9fafb',
                            color: cl.status==='active'?GREEN:cl.status==='prospect'?TEAL:'#9ca3af' }}>
                            {cl.status||'active'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>
                          {new Date(cl.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fClients.length > 100 && (
                  <div style={{ padding:'12px 16px', textAlign:'center', fontSize:12, color:'#9ca3af', fontFamily:FB, borderTop:'1px solid #f3f4f6' }}>
                    Showing 100 of {fClients.length} — use search to filter
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FULL AUDIT ── */}
          {tab === 'audit' && (
            <div>
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'28px 28px', marginBottom:16, textAlign:'center' }}>
                <Terminal size={40} color={runningAudit ? RED : '#e5e7eb'} style={{ margin:'0 auto 16px', display:'block', animation: runningAudit ? 'spin 3s linear infinite' : 'none' }}/>
                <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, marginBottom:8 }}>Full System Audit</div>
                <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB, maxWidth:520, margin:'0 auto 24px', lineHeight:1.7 }}>
                  Runs all health checks, pings every service, checks all DB tables, and asks Claude to diagnose any issues and suggest fixes. Results are logged with a full timestamp.
                </div>
                <button onClick={runFullAudit} disabled={runningAudit}
                  style={{ padding:'12px 32px', borderRadius:12, border:'none', background:runningAudit?'#f3f4f6':RED, color:runningAudit?'#9ca3af':'#fff', fontSize:15, fontWeight:700, cursor:runningAudit?'default':'pointer', fontFamily:FH, display:'inline-flex', alignItems:'center', gap:8 }}>
                  {runningAudit ? <Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> : <BarChart2 size={16}/>}
                  {runningAudit ? 'Running Audit…' : 'Run Full System Audit'}
                </button>
              </div>

              {auditResult && (
                <div>
                  <div style={{ background:'#fff', borderRadius:14, border:`2px solid ${(STATUS_CFG[auditResult.status]||STATUS_CFG.ok).color}`, padding:'20px 24px', marginBottom:14 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <StatusBadge status={auditResult.status}/>
                      <span style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{auditResult.checks?.length} checks · {auditResult.duration_ms}ms · {new Date(auditResult.timestamp).toLocaleString()}</span>
                    </div>
                    {auditResult.checks?.map((c, i) => <CheckRow key={i} check={c}/>)}
                  </div>
                  {auditResult.ai_analysis && (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'20px 24px' }}>
                      <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:'#7c3aed', marginBottom:12, display:'flex', alignItems:'center', gap:7 }}>
                        🤖 Claude AI Diagnosis & Fix Recommendations
                      </div>
                      <pre style={{ fontFamily:FB, fontSize:14, color:'#374151', lineHeight:1.8, whiteSpace:'pre-wrap', margin:0 }}>{auditResult.ai_analysis}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
      `}</style>
    </div>
  )
}
