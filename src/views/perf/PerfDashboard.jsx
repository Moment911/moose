"use client";
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, MousePointer, Eye, Target,
  Zap, Search, MapPin, BarChart2, Sparkles, RefreshCw, AlertCircle,
  ChevronRight, ArrowUp, ArrowDown, Minus, Loader2, Globe,
  Settings, Plus, CheckCircle, X, ExternalLink, Brain
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { useMobile } from '../../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileStatStrip, MobileTabs, MobileCard, MobileSectionHeader, MobileRow, MobileEmpty } from '../../components/mobile/MobilePage'

import { R, T, BLK, GRY, W, GRN, AMB, FH, FB } from '../../lib/theme'
const RED = R, TEAL = T, BLACK = BLK, GREEN = GRN

function fmt(n, type='number') {
  if (n == null) return '—'
  if (type === 'currency') return '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:0,maximumFractionDigits:0})
  if (type === 'pct')      return Number(n).toFixed(1) + '%'
  if (type === 'roas')     return Number(n).toFixed(2) + 'x'
  if (type === 'cpc')      return '$' + Number(n).toFixed(2)
  return Number(n).toLocaleString()
}

function DeltaBadge({ pct }) {
  if (pct == null) return null
  const good = pct >= 0
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:3,
      fontSize:13,fontWeight:700,padding:'2px 7px',borderRadius:20,
      background:good?'#f0fdf4':'#fef2f2',
      color:good?GREEN:RED}}>
      {good?<ArrowUp size={9}/>:<ArrowDown size={9}/>}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function KPICard({ label, value, sub, delta, color=RED, icon:Icon, onClick }) {
  return (
    <div onClick={onClick} style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
      padding:'18px 20px',cursor:onClick?'pointer':'default',transition:'all .15s'}}
      onMouseEnter={e=>{if(onClick)e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='none'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:700,color:'#374151'}}>{label}</span>
        <div style={{width:32,height:32,borderRadius:9,background:color+'15',
          display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon size={15} color={color}/>
        </div>
      </div>
      <div style={{fontSize:26,fontWeight:900,color:'#111',lineHeight:1,marginBottom:6}}>{value}</div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        {sub && <span style={{fontSize:13,color:'#9ca3af'}}>{sub}</span>}
        {delta != null && <DeltaBadge pct={delta}/>}
      </div>
    </div>
  )
}

function RecommendationCard({ rec, onApply, onDismiss }) {
  const priColor = rec.priority==='high'?RED:rec.priority==='medium'?'#f59e0b':'#6b7280'
  const priBg    = rec.priority==='high'?'#fef2f2':rec.priority==='medium'?'#fffbeb':'#f9fafb'
  const typeIcon = {
    bid:'💰', budget:'📊', negative_keyword:'🚫', ad_copy:'✍️',
    landing_page:'🏠', audience:'🎯', keyword_pause:'⏸', keyword_add:'➕',
  }[rec.type] || '💡'

  return (
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
      padding:'16px 18px',borderLeft:`3px solid ${priColor}`}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
        <span style={{fontSize:22,flexShrink:0}}>{typeIcon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
            <span style={{fontSize:14,fontWeight:800,color:'#111'}}>{rec.title}</span>
            <span style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,
              background:priBg,color:priColor,textTransform:'capitalize'}}>{rec.priority}</span>
          </div>
          <p style={{fontSize:13,color:'#374151',lineHeight:1.6,margin:'0 0 10px'}}>{rec.description}</p>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:4}}>
            {rec.est_impact && (
              <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',
                borderRadius:20,background:'#f0fdf4',border:'1px solid #bbf7d0'}}>
                <TrendingUp size={12} color={GREEN}/>
                <span style={{fontSize:13,fontWeight:800,color:GREEN}}>{rec.est_impact}</span>
              </div>
            )}
            {rec.recommended?.action_this_week && (
              <div style={{fontSize:13,color:'#7c3aed',background:'#f5f3ff',
                padding:'4px 10px',borderRadius:20,border:'1px solid #e9d5ff'}}>
                This week: {rec.recommended.action_this_week}
              </div>
            )}
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          <button onClick={()=>onApply(rec)}
            style={{padding:'6px 14px',borderRadius:9,border:'none',background:GREEN,
              color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>Apply</button>
          <button onClick={()=>onDismiss(rec.id)}
            style={{padding:'6px 8px',borderRadius:9,border:'1px solid #e5e7eb',
              background:'#fff',color:'#9ca3af',cursor:'pointer',display:'flex',alignItems:'center'}}>
            <X size={13}/>
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function PerfDashboard() {
  const navigate  = useNavigate()
  const { clientId } = useParams()
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [clients,   setClients]   = useState([])
  const [selClient, setSelClient] = useState(clientId || '')
  const [snapshots, setSnapshots] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [keywords,  setKeywords]  = useState([])
  const [recs,      setRecs]      = useState([])
  const [alerts,    setAlerts]    = useState([])
  const [execLog,   setExecLog]   = useState([])
  const [executing, setExecuting] = useState(null)
  const [dbError,   setDbError]   = useState(null)
  const [pages,     setPages]     = useState([])
  const [tab,       setTab]       = useState('overview')
  const [loading,   setLoading]   = useState(true)
  const [syncing,   setSyncing]   = useState(false)
  const [range,     setRange]     = useState('30d')
  const [mTab,     setMTab]     = useState('overview')

  useEffect(() => { loadClients() }, [])
  useEffect(() => { if (selClient) loadClientData() }, [selClient])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name').order('name')
    setClients(data||[])
    if (!selClient && data?.length) setSelClient(data[0].id)
    else setLoading(false)
  }

  async function loadClientData() {
    setLoading(true)
    try {
      const [
        {data:snaps,error:e1},{data:camps,error:e2},{data:kws,error:e3},
        {data:recData,error:e4},{data:alertData,error:e5},{data:pagesData,error:e6},{data:execLogData,error:e7}
      ] = await Promise.all([
        supabase.from('perf_snapshots').select('*').eq('client_id',selClient)
          .order('snapshot_date',{ascending:false}).limit(90),
        supabase.from('perf_campaigns').select('*').eq('client_id',selClient),
        supabase.from('perf_keywords').select('*').eq('client_id',selClient)
          .order('cost',{ascending:false}).limit(100),
        supabase.from('perf_recommendations').select('*').eq('client_id',selClient)
          .eq('status','pending').order('est_impact_val',{ascending:false}).limit(20),
        supabase.from('perf_alerts').select('*').eq('client_id',selClient)
          .eq('acknowledged',false).order('created_at',{ascending:false}).limit(10),
        supabase.from('perf_execution_log').select('*').eq('client_id',selClient)
          .order('applied_at',{ascending:false}).limit(30),
        supabase.from('perf_pages').select('*').eq('client_id',selClient)
          .order('ai_score',{ascending:false}).limit(50),
      ])
      if (e1 || e2 || e3) {
        // Tables don't exist yet — migration not run
        setDbError('Performance tables not set up yet. Please run the database migration in Supabase.')
      }
      setSnapshots(snaps||[]); setCampaigns(camps||[]); setKeywords(kws||[])
      setRecs(recData||[]); setAlerts(alertData||[]); setPages(pagesData||[]); setExecLog(execLogData||[])
    } catch(err) {
      console.error('loadClientData:', err)
      setDbError('Failed to load data: ' + err.message)
    }
    setLoading(false)
  }

  async function runSync() {
    setSyncing(true)
    toast.loading('Syncing data from Google APIs…', {id:'sync'})
    try {
      const res = await fetch('/api/perf/sync', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ clientId: selClient, agencyId: aid })
      })
      const data = await res.json()
      toast.success(`Sync complete — ${data.campaigns||0} campaigns, ${data.keywords||0} keywords`, {id:'sync'})
      loadClientData()
    } catch(e) {
      toast.error('Sync failed: ' + e.message, {id:'sync'})
    }
    setSyncing(false)
  }

  async function applyRec(rec) {
    setExecuting(rec.id)
    toast.loading('Executing recommendation…', {id:'exec-'+rec.id})
    try {
      const res = await fetch('/api/perf/execute', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({recId:rec.id, clientId:selClient, agencyId:aid, agentName:'Agency'})
      })
      const data = await res.json()
      if (data.success) {
        if (data.dry_run) {
          toast.success('Marked as applied (advisory mode — connect Google Ads for auto-push)', {id:'exec-'+rec.id})
        } else {
          toast.success('Applied to Google Ads: ' + data.detail, {id:'exec-'+rec.id})
        }
        setRecs(prev=>prev.filter(r=>r.id!==rec.id))
        loadClientData()
      } else {
        toast.error('Failed: ' + (data.error||data.detail||'Unknown error'), {id:'exec-'+rec.id})
      }
    } catch(e) {
      toast.error('Execution failed: ' + e.message, {id:'exec-'+rec.id})
    }
    setExecuting(null)
  }

  async function dismissRec(id) {
    await supabase.from('perf_recommendations').update({status:'dismissed'}).eq('id',id)
    setRecs(prev=>prev.filter(r=>r.id!==id))
  }

  // ── Aggregate KPIs from snapshots ──
  const cutoffDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - (range==='7d'?7:range==='30d'?30:90))
    return d.toISOString().split('T')[0]
  }, [range])

  const periodSnaps = useMemo(() =>
    snapshots.filter(s => s.snapshot_date >= cutoffDate), [snapshots, cutoffDate])
  const prevSnaps   = useMemo(() => {
    const days = range==='7d'?7:range==='30d'?30:90
    const prevEnd = cutoffDate
    const prevStart = new Date(new Date(cutoffDate)-days*86400000).toISOString().split('T')[0]
    return snapshots.filter(s => s.snapshot_date >= prevStart && s.snapshot_date < prevEnd)
  }, [snapshots, cutoffDate, range])

  const sum = (arr, key) => arr.reduce((s,d)=>s+(d[key]||0), 0)
  const avg = (arr, key) => arr.length ? sum(arr,key)/arr.length : 0
  const delta = (curr, prev) => prev > 0 ? ((curr-prev)/prev*100) : null

  const totalSpend   = sum(periodSnaps,'ads_spend')
  const totalClicks  = sum(periodSnaps,'ads_clicks')
  const totalConvs   = sum(periodSnaps,'ads_conversions')
  const totalSessions= sum(periodSnaps,'ga4_sessions')
  const avgRoas      = avg(periodSnaps,'ads_roas')
  const avgCpa       = totalConvs > 0 ? totalSpend/totalConvs : 0
  const gmbSearches  = sum(periodSnaps,'gmb_searches')
  const gscClicks    = sum(periodSnaps,'gsc_clicks')

  const prevSpend = sum(prevSnaps,'ads_spend')
  const prevRoas  = avg(prevSnaps,'ads_roas')
  const prevCpa   = prevSnaps.length && sum(prevSnaps,'ads_conversions')>0
    ? sum(prevSnaps,'ads_spend')/sum(prevSnaps,'ads_conversions') : 0

  const TABS = [
    {key:'overview',  label:'Overview'},
    {key:'campaigns', label:'Campaigns', count:campaigns.length},
    {key:'keywords',  label:'Keywords',  count:keywords.length},
    {key:'pages',     label:'Landing Pages', count:pages.length},
    {key:'recs',      label:'AI Recommendations', count:recs.length, alert:recs.filter(r=>r.priority==='high').length>0},
    {key:'history',   label:'Change History',       count:execLog.length},
  ]

  const selectedClient = clients.find(c=>c.id===selClient)

  const isMobile = useMobile()

  /* ─── MOBILE ─── */
  if (isMobile) {
    const MOBILE_TABS = [
      {key:'overview',    label:'Overview'},
      {key:'campaigns',   label:'Campaigns'},
      {key:'recs',        label:'AI Recs',  count:recs.filter(r=>r.status==='pending').length},
    ]
    const fRecs = recs.filter(r=>r.status==='pending')
    const totSpend   = campaigns.reduce((s,c)=>s+(c.cost||0),0)
    const totClicks  = campaigns.reduce((s,c)=>s+(c.clicks||0),0)
    const totConv    = campaigns.reduce((s,c)=>s+(c.conversions||0),0)
    const avgROAS    = campaigns.length ? campaigns.reduce((s,c)=>s+(c.roas||0),0)/campaigns.length : 0

    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="Performance"
          subtitle={selectedClientId ? (clients.find(c=>c.id===selectedClientId)?.name||'Client') : 'Select a client'}/>

        {/* Client picker */}
        <div style={{padding:'10px 16px 0'}}>
          <select value={selectedClientId||''} onChange={e=>setSelectedClientId(e.target.value||null)}
            style={{width:'100%',padding:'11px 13px',borderRadius:11,border:'1px solid #ececea',fontSize:16,color:'#0a0a0a',background:'#fff'}}>
            <option value="">Select client…</option>
            {clients.map(cl=><option key={cl.id} value={cl.id}>{cl.name}</option>)}
          </select>
        </div>

        {selectedClientId && <>
          <MobileStatStrip stats={[
            {label:'Spend',    value:'$'+Math.round(totSpend).toLocaleString()},
            {label:'Clicks',   value:totClicks.toLocaleString()},
            {label:'Conv',     value:totConv.toFixed(0)},
            {label:'Avg ROAS', value:avgROAS.toFixed(1)+'x', color:avgROAS>=3?'#16a34a':avgROAS>=1.5?'#f59e0b':'#E6007E'},
          ]}/>

          <MobileTabs tabs={MOBILE_TABS} active={mTab} onChange={setMTab}/>

          {mTab==='overview' && (
            <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
              {campaigns.slice(0,5).map(cam=>(
                <MobileCard key={cam.id} style={{padding:'14px'}}>
                  <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:14,fontWeight:700,color:'#0a0a0a',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cam.name}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[{label:'Spend',v:'$'+Math.round(cam.cost||0).toLocaleString()},{label:'Clicks',v:(cam.clicks||0).toLocaleString()},{label:'Conv',v:(cam.conversions||0).toFixed(0)},{label:'ROAS',v:(cam.roas||0).toFixed(1)+'x'}].map(m=>(
                      <div key={m.label} style={{background:'#f8f8f6',borderRadius:9,padding:'8px 10px'}}>
                        <div style={{fontSize:11,color:'#9a9a96',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em'}}>{m.label}</div>
                        <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:16,fontWeight:800,color:'#0a0a0a'}}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </MobileCard>
              ))}
            </div>
          )}

          {mTab==='campaigns' && (
            <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
              {campaigns.length===0
                ? <div style={{padding:'40px 0',textAlign:'center',color:'#9a9a96',fontSize:14}}>No campaign data yet</div>
                : campaigns.map(cam=>(
                <MobileCard key={cam.id}>
                  <MobileRow title={cam.name}
                    subtitle={`${cam.status||'—'} · Budget $${Math.round(cam.budget_amount||0)}/day`}
                    left={<div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:cam.status==='ENABLED'?'#16a34a':'#9a9a96'}}/>}
                    badge={<span style={{fontSize:11,fontWeight:800,color:cam.roas>=3?'#16a34a':cam.roas>=1?'#f59e0b':'#E6007E',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>{(cam.roas||0).toFixed(1)}x</span>}
                    borderBottom={false}/>
                </MobileCard>
              ))}
            </div>
          )}

          {mTab==='recs' && (
            <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
              {fRecs.length===0
                ? <div style={{padding:'40px 0',textAlign:'center',color:'#9a9a96',fontSize:14}}>No pending recommendations</div>
                : fRecs.map(r=>(
                <MobileCard key={r.id} style={{padding:'14px',borderLeft:`3px solid ${r.priority==='high'?'#E6007E':r.priority==='medium'?'#f59e0b':'#9a9a96'}`}}>
                  <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:14,fontWeight:800,color:'#0a0a0a',marginBottom:4}}>{r.title}</div>
                  <p style={{fontSize:13,color:'#5a5a58',margin:'0 0 10px',lineHeight:1.5}}>{r.description}</p>
                  <div style={{display:'flex',gap:6}}>
                    <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#f0fdf4',color:'#16a34a',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>{r.est_impact}</span>
                    <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#F9F9F9',color:'#9a9a96',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>{Math.round((r.confidence||0)*100)}% confidence</span>
                  </div>
                </MobileCard>
              ))}
            </div>
          )}
        </>}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
 (
    <div className="page-shell" style={{display:'flex',height:'100vh',overflow:'hidden',background:'#F9F9F9'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Header */}
        <div style={{background:BLACK,padding:'16px 28px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:34,height:34,borderRadius:10,background:RED,
                display:'flex',alignItems:'center',justifyContent:'center'}}>
                <TrendingUp size={17} color="#fff"/>
              </div>
              <div>
                <h1 style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:800,color: '#111111', margin: 0, letterSpacing:'-.03em'}}>
                  Performance Marketing
                </h1>
                <p style={{fontSize:13,color:'#999999',margin:0}}>
                  Google Ads · Analytics · Search Console · GMB · AI Optimization
                </p>
              </div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {/* Client selector */}
              <select value={selClient} onChange={e=>setSelClient(e.target.value)}
                style={{padding:'7px 12px',borderRadius:9,border:'1px solid rgba(255,255,255,.2)',
                  background:'rgba(255,255,255,.1)',color:'#fff',fontSize:14,outline:'none',cursor:'pointer'}}>
                {clients.map(c=><option key={c.id} value={c.id} style={{background:'#111'}}>{c.name}</option>)}
              </select>
              {/* Date range */}
              <div style={{display:'flex',gap:4}}>
                {[{k:'7d',l:'7d'},{k:'30d',l:'30d'},{k:'90d',l:'90d'}].map(r=>(
                  <button key={r.k} onClick={()=>setRange(r.k)}
                    style={{padding:'6px 12px',borderRadius:20,border:'none',cursor:'pointer',
                      background:range===r.k?RED:'rgba(255,255,255,.1)',
                      color:range===r.k?'#fff':'rgba(255,255,255,.6)',fontSize:13,fontWeight:700}}>
                    {r.l}
                  </button>
                ))}
              </div>
              <button onClick={()=>navigate('/integrations')}
                style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',borderRadius:9,
                  border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',
                  color:'#999999',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                <Settings size={13}/> Connect
              </button>
              <button onClick={async()=>{
                const email = prompt('Send report to email:')
                if(!email) return
                toast.loading('Generating report…',{id:'rpt'})
                const res = await fetch('/api/perf/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:selClient,agencyId:aid,recipientEmail:email,period:range})})
                const d = await res.json()
                d.sent ? toast.success('Report sent to '+email,{id:'rpt'}) : toast.error(d.error||'Failed',{id:'rpt'})
              }} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:9,
                border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',
                color:'#999999',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Email Report
              </button>
              <button onClick={runSync} disabled={syncing}
                style={{display:'flex',alignItems:'center',gap:6,padding:'7px 16px',borderRadius:9,
                  border:'none',background:RED,color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>
                {syncing
                  ? <><Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> Syncing…</>
                  : <><RefreshCw size={13}/> Sync Now</>}
              </button>
            </div>
          </div>

          {/* Alerts strip */}
          {alerts.length > 0 && (
            <div style={{background:`${RED}15`,border:`1px solid ${RED}30`,borderRadius:10,
              padding:'8px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
              <AlertCircle size={14} color={RED}/>
              <span style={{fontSize:13,fontWeight:700,color:RED}}>
                {alerts.length} alert{alerts.length!==1?'s':''}: {alerts[0].title}
              </span>
              <button onClick={()=>setTab('recs')}
                style={{marginLeft:'auto',fontSize:13,color:RED,background:'none',border:'none',cursor:'pointer',fontWeight:700}}>
                View →
              </button>
            </div>
          )}

          {/* Tabs */}
          <div style={{display:'flex',gap:0,marginTop:4}}>
            {TABS.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{display:'flex',alignItems:'center',gap:6,padding:'10px 18px',
                  border:'none',borderBottom:'2.5px solid '+(tab===t.key?RED:'transparent'),
                  background:'transparent',color:tab===t.key?'#fff':'rgba(255,255,255,.4)',
                  fontSize:14,fontWeight:tab===t.key?800:600,cursor:'pointer'}}>
                {t.label}
                {(t.count||0)>0&&(
                  <span style={{fontSize:13,fontWeight:800,padding:'1px 6px',borderRadius:20,
                    background:t.alert&&tab!==t.key?RED+'80':tab===t.key?RED+'40':'rgba(255,255,255,.1)',
                    color:'#fff'}}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {loading ? (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80}}>
              <Loader2 size={28} color={RED} style={{animation:'spin 1s linear infinite'}}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : dbError ? (
            <div style={{maxWidth:600,margin:'40px auto'}}>
              <div style={{background:'#fff',borderRadius:20,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                <div style={{background:RED,padding:'20px 24px',display:'flex',alignItems:'center',gap:12}}>
                  <AlertCircle size={24} color='#fff'/>
                  <div style={{fontSize:17,fontWeight:800,color:'#fff'}}>Performance tables need setup</div>
                </div>
                <div style={{padding:'24px'}}>
                  <p style={{fontSize:15,color:'#374151',lineHeight:1.7,margin:'0 0 20px'}}>
                    The Performance module uses 10 database tables that haven't been created yet.
                    Run the consolidated SQL in Supabase — it takes about 10 seconds.
                  </p>
                  <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
                    {[
                      {step:'1',label:'Copy the SQL file',action:()=>{fetch('/RUN_THIS_NOW_consolidated.sql').then(r=>r.text()).then(t=>{navigator.clipboard.writeText(t);toast.success('SQL copied!')})},'btn':'Copy SQL','color':TEAL},
                      {step:'2',label:'Open Supabase SQL Editor',action:()=>window.open('https://supabase.com/dashboard','_blank'),'btn':'Open Supabase →','color':'#3ecf8e'},
                      {step:'3',label:'Paste and click Run',action:null,'btn':null,'color':'#9ca3af'},
                    ].map(({step,label,action,btn,color})=>(
                      <div key={step} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',background:'#f9fafb',borderRadius:12}}>
                        <div style={{width:28,height:28,borderRadius:8,background:color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,color:'#fff',flexShrink:0}}>{step}</div>
                        <div style={{flex:1,fontSize:14,color:'#374151',fontWeight:600}}>{label}</div>
                        {btn && action && <button onClick={action} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${color}`,background:'transparent',color:color,fontSize:13,fontWeight:700,cursor:'pointer'}}>{btn}</button>}
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>window.location.href='/db-setup'}
                      style={{flex:1,padding:'11px',borderRadius:10,border:'none',background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                      Go to HardDrive Setup →
                    </button>
                    <button onClick={()=>{setDbError(null);loadClientData()}}
                      style={{padding:'11px 18px',borderRadius:10,border:'1px solid #e5e7eb',background:'#fff',color:'#374151',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            </div>) : !selClient ? (
            <div style={{textAlign:'center',padding:60}}>
              <TrendingUp size={40} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
              <div style={{fontSize:17,fontWeight:800,color:'#111',marginBottom:8}}>No clients found</div>
              <div style={{fontSize:14,color:'#374151'}}>Add a client first, then connect their Google accounts</div>
            </div>
          ) : (
            <>
              {/* ── OVERVIEW ── */}
              {tab==='overview' && (
                <>
                  {/* KPI grid */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
                    <KPICard label="Ad Spend"     value={fmt(totalSpend,'currency')}  sub="total"          delta={delta(totalSpend,prevSpend)}  color={RED}   icon={DollarSign}/>
                    <KPICard label="ROAS"          value={fmt(avgRoas,'roas')}          sub="return on spend" delta={delta(avgRoas,prevRoas)}       color={GREEN} icon={TrendingUp}/>
                    <KPICard label="Conversions"   value={fmt(totalConvs)}              sub={totalConvs>0?'@ $'+avgCpa.toFixed(0)+' CPA':'—'}                          color={TEAL}  icon={Target}/>
                    <KPICard label="Clicks"        value={fmt(totalClicks)}             sub="paid clicks"                                          color='#7c3aed' icon={MousePointer}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
                    <KPICard label="Organic Sessions" value={fmt(totalSessions)} sub="from GA4" color='#3b82f6' icon={Globe}/>
                    <KPICard label="GSC Clicks"       value={fmt(gscClicks)}     sub="organic search clicks" color='#f59e0b' icon={Search}/>
                    <KPICard label="GMB Searches"     value={fmt(gmbSearches)}   sub="people found you on Maps" color='#ea4335' icon={MapPin}/>
                    <KPICard label="AI Recommendations" value={recs.length}       sub={recs.filter(r=>r.priority==='high').length+' high priority'}
                      color={recs.filter(r=>r.priority==='high').length>0?RED:TEAL} icon={Brain}
                      onClick={()=>setTab('recs')}/>
                  </div>

                  {/* Campaign summary */}
                  {campaigns.length > 0 && (
                    <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden',marginBottom:20}}>
                      <div style={{padding:'16px 20px',borderBottom:'1px solid #f3f4f6',
                        display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{fontSize:15,fontWeight:900,color:'#111'}}>Campaign Performance</div>
                        <button onClick={()=>setTab('campaigns')}
                          style={{fontSize:13,color:RED,background:'none',border:'none',cursor:'pointer',fontWeight:700}}>
                          View all →
                        </button>
                      </div>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead><tr style={{background:'#f9fafb'}}>
                          {['Campaign','Status','Spend','ROAS','CPA','Clicks','Conv','IS%'].map(h=>(
                            <th key={h} style={{padding:'10px 16px',fontSize:13,fontWeight:800,
                              color:'#374151',textAlign:'left',textTransform:'uppercase',letterSpacing:'.05em'}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {campaigns.slice(0,5).map((c,i)=>(
                            <tr key={c.id} style={{borderBottom:i<4?'1px solid #f9fafb':'none'}}>
                              <td style={{padding:'12px 16px',fontSize:14,fontWeight:800,color:'#111'}}>{c.name}</td>
                              <td style={{padding:'12px 16px'}}>
                                <span style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,
                                  background:c.status==='ENABLED'?'#f0fdf4':'#f9fafb',
                                  color:c.status==='ENABLED'?GREEN:'#374151'}}>{c.status}</span>
                              </td>
                              <td style={{padding:'12px 16px',fontSize:14,fontWeight:700,color:'#111'}}>{fmt(c.cost,'currency')}</td>
                              <td style={{padding:'12px 16px',fontSize:14,fontWeight:700,
                                color:(c.roas||0)>=3?GREEN:(c.roas||0)>=1?'#f59e0b':RED}}>{fmt(c.roas,'roas')}</td>
                              <td style={{padding:'12px 16px',fontSize:14,color:'#374151'}}>{fmt(c.cpa,'currency')}</td>
                              <td style={{padding:'12px 16px',fontSize:14,color:'#374151'}}>{fmt(c.clicks)}</td>
                              <td style={{padding:'12px 16px',fontSize:14,color:'#374151'}}>{fmt(c.conversions)}</td>
                              <td style={{padding:'12px 16px',fontSize:14,
                                color:(c.impression_share||0)>=70?GREEN:(c.impression_share||0)>=40?'#f59e0b':RED}}>
                                {fmt(c.impression_share,'pct')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Empty state */}
                  {campaigns.length===0 && snapshots.length===0 && (
                    <div style={{background:'#fff',borderRadius:16,border:'2px dashed #e5e7eb',padding:'48px',textAlign:'center'}}>
                      <TrendingUp size={44} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
                      <div style={{fontSize:18,fontWeight:900,color:'#111',marginBottom:8}}>No data yet</div>
                      <div style={{fontSize:15,color:'#374151',marginBottom:24,maxWidth:400,margin:'0 auto 24px'}}>
                        Connect {selectedClient?.name}'s Google Ads, Analytics, and Search Console accounts to start pulling data.
                      </div>
                      <button onClick={()=>navigate('/integrations')}
                        style={{padding:'12px 28px',borderRadius:12,border:'none',background:RED,
                          color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer'}}>
                        Connect Google Accounts →
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── CAMPAIGNS ── */}
              {tab==='campaigns' && (
                <div>
                  {campaigns.length===0 ? (
                    <div style={{textAlign:'center',padding:60,color:'#9ca3af'}}>No campaign data. Run sync to pull from Google Ads.</div>
                  ) : (
                    <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead><tr style={{background:'#f9fafb'}}>
                          {['Campaign','Type','Budget/day','Bidding','Spend','ROAS','CPA','Clicks','Conv','IS%','Lost (Budget)','Lost (Rank)'].map(h=>(
                            <th key={h} style={{padding:'11px 14px',fontSize:13,fontWeight:800,color:'#374151',
                              textAlign:'left',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {campaigns.map((c,i)=>(
                            <tr key={c.id} style={{borderBottom:i<campaigns.length-1?'1px solid #f9fafb':'none'}}
                              onMouseEnter={e=>e.currentTarget.style.background=GRY}
                              onMouseLeave={e=>e.currentTarget.style.background=''}>
                              <td style={{padding:'12px 14px'}}>
                                <div style={{fontSize:14,fontWeight:800,color:'#111'}}>{c.name}</div>
                                <span style={{fontSize:13,fontWeight:700,padding:'1px 7px',borderRadius:20,
                                  background:c.status==='ENABLED'?'#f0fdf4':'#f9fafb',
                                  color:c.status==='ENABLED'?GREEN:'#374151'}}>{c.status}</span>
                              </td>
                              <td style={{padding:'12px 14px',fontSize:13,color:'#374151'}}>{c.campaign_type}</td>
                              <td style={{padding:'12px 14px',fontSize:13,fontWeight:700,color:'#111'}}>{fmt(c.budget_amount,'currency')}</td>
                              <td style={{padding:'12px 14px',fontSize:13,color:'#374151',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.bidding_strategy}</td>
                              <td style={{padding:'12px 14px',fontSize:14,fontWeight:700,color:'#111'}}>{fmt(c.cost,'currency')}</td>
                              <td style={{padding:'12px 14px',fontSize:14,fontWeight:800,color:(c.roas||0)>=3?GREEN:(c.roas||0)>=1?'#f59e0b':RED}}>{fmt(c.roas,'roas')}</td>
                              <td style={{padding:'12px 14px',fontSize:13,color:'#374151'}}>{fmt(c.cpa,'currency')}</td>
                              <td style={{padding:'12px 14px',fontSize:13,color:'#374151'}}>{fmt(c.clicks)}</td>
                              <td style={{padding:'12px 14px',fontSize:13,color:'#374151'}}>{fmt(c.conversions)}</td>
                              <td style={{padding:'12px 14px',fontSize:13,color:(c.impression_share||0)>=70?GREEN:'#f59e0b'}}>{fmt(c.impression_share,'pct')}</td>
                              <td style={{padding:'12px 14px',fontSize:13,color:RED}}>{fmt(c.lost_is_budget,'pct')}</td>
                              <td style={{padding:'12px 14px',fontSize:13,color:'#f59e0b'}}>{fmt(c.lost_is_rank,'pct')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── KEYWORDS ── */}
              {tab==='keywords' && (
                <div>
                  <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
                      <thead><tr style={{background:'#f9fafb'}}>
                        {['Keyword','Match','Status','Bid','Avg CPC','Impressions','Clicks','Conv','Cost','QS','First Page Bid'].map(h=>(
                          <th key={h} style={{padding:'11px 14px',fontSize:13,fontWeight:800,color:'#374151',
                            textAlign:'left',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {keywords.slice(0,50).map((kw,i)=>(
                          <tr key={kw.id} style={{borderBottom:i<keywords.length-1?'1px solid #f9fafb':'none'}}>
                            <td style={{padding:'11px 14px',fontSize:14,fontWeight:800,color:'#111'}}>{kw.keyword}</td>
                            <td style={{padding:'11px 14px'}}>
                              <span style={{fontSize:13,padding:'2px 7px',borderRadius:20,background:'#f3f4f6',color:'#374151',fontWeight:600}}>{kw.match_type}</span>
                            </td>
                            <td style={{padding:'11px 14px'}}>
                              <span style={{fontSize:13,fontWeight:700,color:kw.status==='ENABLED'?GREEN:'#9ca3af'}}>{kw.status}</span>
                            </td>
                            <td style={{padding:'11px 14px',fontSize:13,fontWeight:700,color:'#111'}}>{fmt(kw.bid,'cpc')}</td>
                            <td style={{padding:'11px 14px',fontSize:13,color:'#374151'}}>{fmt(kw.avg_cpc,'cpc')}</td>
                            <td style={{padding:'11px 14px',fontSize:13,color:'#374151'}}>{fmt(kw.impressions)}</td>
                            <td style={{padding:'11px 14px',fontSize:13,color:'#374151'}}>{fmt(kw.clicks)}</td>
                            <td style={{padding:'11px 14px',fontSize:13,color:'#374151'}}>{fmt(kw.conversions)}</td>
                            <td style={{padding:'11px 14px',fontSize:13,fontWeight:700,color:'#111'}}>{fmt(kw.cost,'currency')}</td>
                            <td style={{padding:'11px 14px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:4}}>
                                <div style={{width:28,height:6,borderRadius:3,background:'#f3f4f6',overflow:'hidden'}}>
                                  <div style={{height:'100%',width:((kw.quality_score||0)/10*100)+'%',
                                    background:(kw.quality_score||0)>=7?GREEN:(kw.quality_score||0)>=5?'#f59e0b':RED}}/>
                                </div>
                                <span style={{fontSize:13,fontWeight:700,
                                  color:(kw.quality_score||0)>=7?GREEN:(kw.quality_score||0)>=5?'#f59e0b':RED}}>
                                  {kw.quality_score||'—'}
                                </span>
                              </div>
                            </td>
                            <td style={{padding:'11px 14px',fontSize:13,color:'#374151'}}>{fmt(kw.first_page_bid,'cpc')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── LANDING PAGES ── */}
              {tab==='pages' && (
                <div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:17,fontWeight:900,color:'#111',marginBottom:4}}>Landing Page Intelligence</div>
                      <div style={{fontSize:14,color:'#374151'}}>{pages.length} pages scanned from sitemap · ranked by AI score</div>
                    </div>
                    <button onClick={()=>setTab('pages')}
                      style={{padding:'8px 18px',borderRadius:10,border:'none',background:RED,
                        color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>
                      Scan Sitemap →
                    </button>
                  </div>
                  {pages.length===0 ? (
                    <div style={{background:'#fff',borderRadius:16,border:'2px dashed #e5e7eb',
                      padding:'48px',textAlign:'center'}}>
                      <Globe size={40} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
                      <div style={{fontSize:16,fontWeight:800,color:'#111',marginBottom:8}}>No pages scanned yet</div>
                      <div style={{fontSize:14,color:'#374151',marginBottom:20}}>Enter the sitemap URL to analyze all pages as potential landing pages</div>
                      <button onClick={()=>setTab('pages')}
                        style={{padding:'10px 24px',borderRadius:10,border:'none',background:RED,
                          color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                        Scan Sitemap Now
                      </button>
                    </div>
                  ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {pages.map((page,i)=>(
                        <div key={page.id} style={{background:'#fff',borderRadius:14,
                          border:'1px solid #e5e7eb',padding:'16px 18px',
                          display:'flex',alignItems:'flex-start',gap:16}}>
                          {/* Score ring */}
                          <div style={{width:52,height:52,borderRadius:'50%',flexShrink:0,
                            border:`3px solid ${(page.ai_score||0)>=70?GREEN:(page.ai_score||0)>=50?TEAL:RED}`,
                            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                            <div style={{fontSize:15,fontWeight:900,
                              color:(page.ai_score||0)>=70?GREEN:(page.ai_score||0)>=50?TEAL:RED}}>
                              {page.ai_score||0}
                            </div>
                            <div style={{fontSize:13,color:'#9ca3af'}}>score</div>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                              <div style={{fontSize:14,fontWeight:800,color:'#111',
                                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                {page.page_title || page.h1 || page.url}
                              </div>
                              <a href={page.url} target="_blank" rel="noreferrer"
                                style={{color:TEAL,flexShrink:0}}>
                                <ExternalLink size={12}/>
                              </a>
                            </div>
                            <div style={{fontSize:13,color:'#9ca3af',marginBottom:6,
                              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{page.url}</div>
                            {page.ai_summary && (
                              <div style={{fontSize:13,color:'#374151',marginBottom:8}}>{page.ai_summary}</div>
                            )}
                            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                              {page.has_cta && <span style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#f0fdf4',color:GREEN}}>✓ Has CTA</span>}
                              {page.has_form && <span style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#eff6ff',color:'#3b82f6'}}>✓ Has Form</span>}
                              {page.has_phone && <span style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#f5f3ff',color:'#7c3aed'}}>✓ Has Phone</span>}
                              {page.word_count>0 && <span style={{fontSize:13,color:'#9ca3af'}}>{page.word_count} words</span>}
                              {(page.primary_keywords||[]).slice(0,3).map((kw,j)=>(
                                <span key={j} style={{fontSize:13,padding:'2px 7px',borderRadius:20,background:'#f3f4f6',color:'#374151'}}>#{kw}</span>
                              ))}
                            </div>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,width:140}}>
                              {[
                                {label:'Headline',value:page.ai_headline_score},
                                {label:'Content', value:page.ai_content_score},
                                {label:'CTA',     value:page.ai_cta_score},
                                {label:'Conv',    value:page.conv_rate?+(page.conv_rate*100).toFixed(1)+'%':null},
                              ].map(m=>(
                                <div key={m.label} style={{background:'#f9fafb',borderRadius:8,padding:'6px 8px',textAlign:'center'}}>
                                  <div style={{fontSize:14,fontWeight:800,color:'#111'}}>{m.value||'—'}</div>
                                  <div style={{fontSize:13,color:'#9ca3af'}}>{m.label}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── AI RECOMMENDATIONS ── */}
              {tab==='recs' && (
                <div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:17,fontWeight:900,color:'#111',marginBottom:4}}>AI Recommendations</div>
                      <div style={{fontSize:14,color:'#374151'}}>
                        {recs.length} pending · estimated impact: $
                        {recs.reduce((s,r)=>s+(r.est_impact_val||0),0).toLocaleString()}
                      </div>
                    </div>
                    <button onClick={async()=>{
                      toast.loading('Running AI optimization analysis…',{id:'analyze'})
                      try {
                        await fetch('/api/perf/analyze',{method:'POST',headers:{'Content-Type':'application/json'},
                          body:JSON.stringify({clientId:selClient,agencyId:aid})})
                        toast.success('Analysis complete — new recommendations generated',{id:'analyze'})
                        loadClientData()
                      } catch(e) { toast.error(e.message,{id:'analyze'}) }
                    }} style={{display:'flex',alignItems:'center',gap:7,padding:'8px 18px',
                      borderRadius:10,border:'none',background:RED,color:'#fff',
                      fontSize:14,fontWeight:800,cursor:'pointer'}}>
                      <Sparkles size={14}/> Run AI Analysis
                    </button>
                  </div>

                  {recs.length===0 ? (
                    <div style={{textAlign:'center',padding:60,background:'#fff',borderRadius:16,border:'1px solid #e5e7eb'}}>
                      <Brain size={40} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
                      <div style={{fontSize:16,fontWeight:800,color:'#111',marginBottom:8}}>No recommendations yet</div>
                      <div style={{fontSize:14,color:'#374151',marginBottom:20}}>Click "Run AI Analysis" to analyze the account and generate optimization recommendations</div>
                    </div>
                  ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {/* High priority first */}
                      {['high','medium','low'].map(pri=>{
                        const priRecs = recs.filter(r=>r.priority===pri)
                        if (!priRecs.length) return null
                        return (
                          <div key={pri}>
                            <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',
                              letterSpacing:'.07em',marginBottom:8,marginTop:pri!=='high'?16:0}}>
                              {pri} priority ({priRecs.length})
                            </div>
                            {priRecs.map(rec=>(
                              <div key={rec.id} style={{marginBottom:8}}>
                                <RecommendationCard rec={rec} onApply={applyRec} onDismiss={dismissRec}/>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── CHANGE HISTORY ── */}
              {tab==='history' && (
                <div>
                  <div style={{fontSize:17,fontWeight:900,color:'#111',marginBottom:4}}>Change History</div>
                  <div style={{fontSize:14,color:'#374151',marginBottom:16}}>{execLog.length} changes applied · full audit trail with rollback data</div>
                  {execLog.length===0 ? (
                    <div style={{textAlign:'center',padding:60,background:'#fff',borderRadius:16,border:'1px solid #e5e7eb'}}>
                      <CheckCircle size={40} color="#e5e7eb" style={{margin:'0 auto 16px',display:'block'}}/>
                      <div style={{fontSize:16,fontWeight:800,color:'#111',marginBottom:6}}>No changes yet</div>
                      <div style={{fontSize:14,color:'#374151'}}>When you apply recommendations, they appear here with full rollback data</div>
                    </div>
                  ) : (
                    <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead><tr style={{background:'#f9fafb'}}>
                          {['Change','Applied by','Date','Status','Detail'].map(h=>(
                            <th key={h} style={{padding:'11px 16px',fontSize:13,fontWeight:800,color:'#374151',textAlign:'left',textTransform:'uppercase',letterSpacing:'.05em'}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {execLog.map((log,i)=>(
                            <tr key={log.id} style={{borderBottom:i<execLog.length-1?'1px solid #f9fafb':'none'}}>
                              <td style={{padding:'13px 16px'}}>
                                <div style={{fontSize:14,fontWeight:700,color:'#111'}}>{log.rec_title}</div>
                                <div style={{fontSize:13,color:'#9ca3af',textTransform:'capitalize'}}>{log.rec_type?.replace(/_/g,' ')}</div>
                              </td>
                              <td style={{padding:'13px 16px',fontSize:13,color:'#374151'}}>{log.applied_by||'Agency'}</td>
                              <td style={{padding:'13px 16px',fontSize:13,color:'#9ca3af',whiteSpace:'nowrap'}}>
                                {new Date(log.applied_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
                              </td>
                              <td style={{padding:'13px 16px'}}>
                                <span style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,
                                  background:log.status==='success'?'#f0fdf4':log.status==='failed'?'#fef2f2':'#f9fafb',
                                  color:log.status==='success'?GREEN:log.status==='failed'?RED:'#374151'}}>
                                  {log.dry_run?'Advisory':log.status}
                                </span>
                              </td>
                              <td style={{padding:'13px 16px',fontSize:13,color:'#374151',maxWidth:280}}>
                                <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.detail}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}