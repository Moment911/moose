"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, Search, BarChart2, MapPin, FileText, Sparkles,
  Globe, DollarSign, ArrowUp, ArrowDown, Minus,
  Plus, RefreshCw, Loader2, Check, Copy, Link2,
  Target, Key, Wifi, WifiOff, AlertCircle,
  ExternalLink, Activity, ChevronRight, Zap, Shield
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import AIThinkingBox from '../../components/AIThinkingBox'
import { supabase } from '../../lib/supabase'
import { callClaude } from '../../lib/ai'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLACK = '#0a0a0a'

const TABS = [
  { key:'overview', label:'Overview',     icon:BarChart2 },
  { key:'keywords', label:'Keywords',     icon:Search },
  { key:'sites',    label:'WP Sites',     icon:Globe },
  { key:'connect',  label:'Connect Data', icon:Link2 },
  { key:'reports',  label:'Reports',      icon:FileText },
]

const PROVIDERS = [
  { key:'search_console', label:'Search Console',   icon:Search,     color:'#4285F4', desc:'Rankings, clicks, impressions' },
  { key:'analytics',      label:'Google Analytics', icon:BarChart2,  color:'#F4B400', desc:'Traffic, users, conversions' },
  { key:'ads',            label:'Google Ads',       icon:DollarSign, color:'#34A853', desc:'Spend, ROAS, conversions' },
  { key:'gmb',            label:'Business Profile', icon:MapPin,     color:'#EA4335', desc:'Reviews, views, actions' },
]

function Delta({ cur, prev }) {
  if (!prev || cur === prev) return <span style={{ color:'#9ca3af', fontSize:13 }}>—</span>
  const d = prev - cur
  if (d > 0) return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:2, color:'#16a34a', fontSize:13, fontWeight:800, background:'#f0fdf4', padding:'2px 7px', borderRadius:12 }}>
      <ArrowUp size={10}/> {d}
    </span>
  )
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:2, color:RED, fontSize:13, fontWeight:800, background:'#fef2f2', padding:'2px 7px', borderRadius:12 }}>
      <ArrowDown size={10}/> {Math.abs(d)}
    </span>
  )
}

function ScoreRing({ score=0, size=80 }) {
  const r = (size-10)/2, circ = 2*Math.PI*r
  const offset = circ - (score/100)*circ
  const color = score>=70 ? '#16a34a' : score>=50 ? TEAL : RED
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={8}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition:'stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)' }}/>
    </svg>
  )
}

export default function SEOHubPage() {
  const navigate = useNavigate()
  const { agencyId, firstName } = useAuth()
  const { clients, selectedClient, selectClient } = useClient()

  const [tab, setTab]               = useState('overview')
  const [connections, setConnections] = useState([])
  const [keywords, setKeywords]     = useState([])
  const [reports, setReports]       = useState([])
  const [sites, setSites]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [generating, setGenerating] = useState(false)
  const [analysis, setAnalysis]     = useState(null)
  const [newSiteUrl, setNewSiteUrl] = useState('')
  const [newSiteName, setNewSiteName] = useState('')
  const [addingSite, setAddingSite] = useState(false)
  const [copiedToken, setCopiedToken] = useState(null)
  const [kwSearch, setKwSearch]     = useState('')

  useEffect(() => {
    if (selectedClient) loadClientData(selectedClient.id)
  }, [selectedClient?.id])

  async function loadClientData(cId) {
    setLoading(true)
    try {
      const [{ data: conns }, { data: kws }, { data: rpts }, { data: st }] = await Promise.all([
        supabase.from('seo_connections').select('*').eq('client_id', cId),
        supabase.from('seo_keyword_tracking').select('*').eq('client_id', cId).order('position').limit(200),
        supabase.from('seo_reports').select('*').eq('client_id', cId).order('generated_at', { ascending:false }).limit(10),
        supabase.from('wp_seo_sites').select('*').eq('client_id', cId).order('created_at', { ascending:false }),
      ])
      setConnections(conns||[]); setKeywords(kws||[])
      setReports(rpts||[]); setSites(st||[])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function addSite() {
    if (!newSiteUrl.trim() || !selectedClient) return
    setAddingSite(true)
    const { data, error } = await supabase.from('wp_seo_sites').insert({
      agency_id: agencyId, client_id: selectedClient.id,
      site_url: newSiteUrl.trim().replace(/\/$/,''),
      site_name: newSiteName.trim() || selectedClient.name,
    }).select().single()
    if (error) { toast.error(error.message); setAddingSite(false); return }
    setSites(s=>[data,...s]); setNewSiteUrl(''); setNewSiteName('')
    toast.success('Site added — copy the API token and paste it into the WordPress plugin')
    setAddingSite(false)
  }

  async function toggleSite(id, active) {
    await supabase.from('wp_seo_sites').update({ is_active:active }).eq('id',id)
    setSites(s=>s.map(x=>x.id===id?{...x,is_active:active}:x))
    toast.success(active?'Site enabled':'Site disabled')
  }

  async function deleteSite(id) {
    if (!confirm('Remove this site connection?')) return
    await supabase.from('wp_seo_sites').delete().eq('id',id)
    setSites(s=>s.filter(x=>x.id!==id))
    toast.success('Site removed')
  }

  function copyToken(token, id) {
    navigator.clipboard.writeText(token)
    setCopiedToken(id); setTimeout(()=>setCopiedToken(null), 2200)
    toast.success('Token copied — paste into WordPress plugin → Agency Connect')
  }

  async function syncSite(site) {
    toast.loading('Syncing…', { id:'sync' })
    try {
      const r = await fetch(`${site.site_url}/wp-json/hlseo/v1/stats`, {
        headers:{ 'X-Agency-Token': site.api_token }
      })
      if (r.ok) {
        await supabase.from('wp_seo_sites').update({ last_sync_at: new Date().toISOString() }).eq('id', site.id)
        setSites(s=>s.map(x=>x.id===site.id?{...x,last_sync_at:new Date().toISOString()}:x))
        toast.success('Synced!', { id:'sync' })
      } else toast.error('Sync failed — check plugin is connected', { id:'sync' })
    } catch { toast.error('Cannot reach site', { id:'sync' }) }
  }

  async function generateAnalysis() {
    if (!selectedClient) return
    setGenerating(true)
    try {
      const result = await callClaude(
        'You are a senior SEO strategist. Return ONLY valid JSON, no markdown.',
        `SEO analysis for "${selectedClient.name}" (${selectedClient.industry||'local business'}).
Keywords tracked: ${keywords.length}. Connected: ${connections.filter(c=>c.connected).length}.
Top keywords: ${keywords.slice(0,5).map(k=>`${k.keyword} #${k.position}`).join(', ')||'none'}.
Return: { overallScore:number, executiveSummary:string, opportunities:[{title,impact,effort,desc}], quickWins:[string] }`, 1500
      )
      const clean = result.replace(/```json|```/g,'').trim()
      setAnalysis(JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}')+1)))
      toast.success('Analysis ready')
    } catch { toast.error('Analysis failed') }
    setGenerating(false)
  }

  const conn    = (key) => connections.find(c=>c.provider===key&&c.connected)
  const topKws  = keywords.filter(k=>k.position<=10).length
  const avgPos  = keywords.length ? Math.round(keywords.reduce((s,k)=>s+(k.position||50),0)/keywords.length) : null
  const filtKws = keywords.filter(k=>!kwSearch||k.keyword.toLowerCase().includes(kwSearch.toLowerCase()))

  // ── Stat card ────────────────────────────────────────────────────────────
  const Stat = ({ label, value, sub, icon:I, accent, teal }) => {
    const bg    = accent ? RED   : teal ? TEAL   : '#fff'
    const color = accent ? '#fff': teal ? '#fff' : '#111'
    const subC  = accent ? 'rgba(255,255,255,.7)' : teal ? 'rgba(255,255,255,.75)' : '#374151'
    return (
      <div style={{ background:bg, borderRadius:16, padding:'22px 20px', border:`1px solid ${accent||teal?'transparent':'#e5e7eb'}`, boxShadow: accent?`0 8px 24px ${RED}30`:teal?`0 8px 24px ${TEAL}30`:'none' }}>
        <I size={20} color={accent||teal?'rgba(255,255,255,.8)':'#374151'} style={{ marginBottom:14 }}/>
        <div style={{ fontSize:34, fontWeight:900, color, letterSpacing:-1, lineHeight:1 }}>
          {value ?? <span style={{ fontSize:22 }}>—</span>}
        </div>
        <div style={{ fontSize:15, fontWeight:800, color, marginTop:8 }}>{label}</div>
        <div style={{ fontSize:13, color:subC, marginTop:3 }}>{sub}</div>
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f0f0f2' }}>
      <Sidebar/>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ── Left panel: client list ─────────────────────────────────── */}
        <div  className="reviews-client-col"style={{ width:220, flexShrink:0, background:'#fff', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'18px 16px 12px', borderBottom:'1px solid #f3f4f6' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>SEO Hub</div>
            <div style={{ fontSize:18, fontWeight:900, color:'#111' }}>Clients</div>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {clients.length === 0 ? (
              <div style={{ padding:20, fontSize:14, color:'#374151' }}>No clients yet</div>
            ) : clients.map(c => {
              const active = selectedClient?.id === c.id
              const hasSite = sites.filter(s=>s.client_id===c.id&&s.is_active).length > 0
              return (
                <button key={c.id} onClick={()=>selectClient(c)}
                  style={{ width:'100%', textAlign:'left', padding:'11px 16px', border:'none', borderLeft:`3px solid ${active?RED:'transparent'}`, background:active?'#fff5f5':'#fff', cursor:'pointer', borderBottom:'1px solid #f9fafb', transition:'all .12s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:30, height:30, borderRadius:8, background:active?RED:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:active?'#fff':'#374151', flexShrink:0 }}>
                      {(c.name||'?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:'#111', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize:13, color:'#374151', marginTop:1 }}>{c.industry||'No industry'}</div>
                    </div>
                    {hasSite && <div style={{ width:7, height:7, borderRadius:'50%', background:TEAL, flexShrink:0 }}/>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Main content ────────────────────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {!selectedClient ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
              <TrendingUp size={44} color="#e5e7eb"/>
              <div style={{ fontSize:20, fontWeight:900, color:'#111' }}>Select a client</div>
              <div style={{ fontSize:15, color:'#374151' }}>Choose from the left panel to open their SEO dashboard</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ background:BLACK, padding:'18px 28px 0', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                      <div style={{ width:38, height:38, borderRadius:11, background:RED, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#fff', flexShrink:0 }}>
                        {(selectedClient.name||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <h1 style={{ fontSize:20, fontWeight:900, color:'#fff', margin:0, letterSpacing:-0.3 }}>{selectedClient.name}</h1>
                        <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', marginTop:1 }}>{selectedClient.industry||'Local business'}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <button onClick={()=>loadClientData(selectedClient.id)}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.7)', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      <RefreshCw size={13}/> Refresh
                    </button>
                    <button onClick={generateAnalysis} disabled={generating}
                      style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:`0 4px 14px ${RED}50` }}>
                      {generating ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> : <Sparkles size={14}/>}
                      AI Analysis
                    </button>
                  </div>
                </div>

                {/* Quick stats strip */}
                <div style={{ display:'flex', gap:24, marginBottom:0, paddingBottom:0 }}>
                  {[
                    { label:'Keywords tracked', value:keywords.length||0 },
                    { label:'Top 10 rankings', value:topKws },
                    { label:'Avg. position', value:avgPos?`#${avgPos}`:'—' },
                    { label:'WP sites', value:sites.filter(s=>s.is_active).length },
                    { label:'Data sources', value:`${connections.filter(c=>c.connected).length}/4` },
                  ].map(s=>(
                    <div key={s.label} style={{ padding:'10px 0' }}>
                      <div style={{ fontSize:20, fontWeight:900, color:'#fff', lineHeight:1 }}>{s.value}</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', marginTop:3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Tab bar */}
                <div style={{ display:'flex', gap:0, marginTop:4 }}>
                  {TABS.map(t => {
                    const I = t.icon
                    const active = tab === t.key
                    return (
                      <button key={t.key} onClick={()=>setTab(t.key)}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'11px 20px', border:'none', borderBottom:`2.5px solid ${active?RED:'transparent'}`, background:'transparent', color:active?'#fff':'rgba(255,255,255,.4)', fontSize:14, fontWeight:active?800:600, cursor:'pointer', transition:'all .15s' }}>
                        <I size={14}/>{t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
                {loading ? (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:80 }}>
                    <Loader2 size={32} color={RED} style={{ animation:'spin 1s linear infinite' }}/>
                  </div>
                ) : (
                  <>
                    {/* AI Thinking Box — shown during any generation */}
                    {generating && (
                      <div style={{ marginBottom:20 }}>
                        <AIThinkingBox active={generating} task='analysis' label='Generating AI analysis'/>
                      </div>
                    )}
                    {/* ── OVERVIEW ── */}
                    {tab === 'overview' && (
                      <div className="animate-fade-up">

                        {/* AI Analysis card — shown when available */}
                        {analysis && (
                          <div style={{ background:BLACK, borderRadius:18, padding:'24px 28px', marginBottom:20, display:'flex', gap:24 }}>
                            <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                              <div style={{ position:'relative', width:80, height:80 }}>
                                <ScoreRing score={analysis.overallScore} size={80}/>
                                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:'#fff' }}>
                                  {analysis.overallScore}
                                </div>
                              </div>
                              <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', marginTop:6, textAlign:'center' }}>SEO Score</div>
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                                <Sparkles size={15} color={RED}/>
                                <span style={{ fontSize:14, fontWeight:800, color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:'.06em' }}>AI Analysis</span>
                              </div>
                              <p style={{ fontSize:15, color:'rgba(255,255,255,.85)', lineHeight:1.7, margin:'0 0 14px' }}>{analysis.executiveSummary}</p>
                              {analysis.quickWins?.length > 0 && (
                                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                  {analysis.quickWins.slice(0,4).map((w,i)=>(
                                    <span key={i} style={{ fontSize:13, fontWeight:700, padding:'4px 12px', borderRadius:20, background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.7)', border:'1px solid rgba(255,255,255,.12)' }}>
                                      {w}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {analysis.opportunities?.length > 0 && (
                              <div style={{ width:220, flexShrink:0 }}>
                                <div style={{ fontSize:13, fontWeight:800, color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Top opportunities</div>
                                {analysis.opportunities.slice(0,3).map((op,i)=>(
                                  <div key={i} style={{ padding:'8px 12px', background:'rgba(255,255,255,.06)', borderRadius:10, marginBottom:6, borderLeft:`3px solid ${RED}` }}>
                                    <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:2 }}>{op.title}</div>
                                    <div style={{ fontSize:13, color:'rgba(255,255,255,.5)' }}>{op.impact} impact · {op.effort} effort</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Stat cards */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:20 }}>
                          <Stat label="Keywords tracked"  value={keywords.length||0} sub={keywords.length?`${topKws} in top 10`:'None yet'} icon={Search}   accent/>
                          <Stat label="Avg. position"     value={avgPos?`#${avgPos}`:'—'}   sub="across all keywords"  icon={Target}/>
                          <Stat label="WP sites"          value={sites.filter(s=>s.is_active).length} sub={`${sites.length} total connected`} icon={Globe}  teal/>
                          <Stat label="Data sources"      value={`${connections.filter(c=>c.connected).length}/4`} sub="Google integrations" icon={Activity}/>
                        </div>

                        {/* Connections + Sites in 2-col */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

                          {/* Data connections */}
                          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <div style={{ fontSize:15, fontWeight:900, color:'#111' }}>Data connections</div>
                              <button onClick={()=>setTab('connect')} style={{ fontSize:13, color:RED, fontWeight:800, border:'none', background:'none', cursor:'pointer' }}>Manage →</button>
                            </div>
                            {PROVIDERS.map((p,i)=>{
                              const c = conn(p.key)
                              const I = p.icon
                              return (
                                <div key={p.key} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 20px', borderBottom:i<3?'1px solid #f9fafb':'none' }}>
                                  <div style={{ width:36, height:36, borderRadius:9, background:c?TEAL+'20':p.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                    <I size={16} color={c?TEAL:p.color}/>
                                  </div>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:14, fontWeight:800, color:'#111' }}>{p.label}</div>
                                    <div style={{ fontSize:13, color:'#374151' }}>{p.desc}</div>
                                  </div>
                                  {c ? (
                                    <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, fontWeight:800, color:'#0e7490', background:TEAL+'20', padding:'3px 10px', borderRadius:20 }}>
                                      <Wifi size={10}/> Connected
                                    </span>
                                  ) : (
                                    <button onClick={()=>setTab('connect')}
                                      style={{ fontSize:13, fontWeight:800, color:RED, background:'#fff5f5', padding:'3px 10px', borderRadius:20, border:`1px solid ${RED}30`, cursor:'pointer' }}>
                                      Connect
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* WP Sites */}
                          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <div style={{ fontSize:15, fontWeight:900, color:'#111' }}>WordPress sites</div>
                              <button onClick={()=>setTab('sites')} style={{ fontSize:13, color:RED, fontWeight:800, border:'none', background:'none', cursor:'pointer' }}>Manage →</button>
                            </div>
                            {sites.length === 0 ? (
                              <div style={{ padding:'28px 20px', textAlign:'center' }}>
                                <Globe size={28} color="#e5e7eb" style={{ margin:'0 auto 10px' }}/>
                                <div style={{ fontSize:14, fontWeight:800, color:'#111', marginBottom:4 }}>No sites connected</div>
                                <div style={{ fontSize:13, color:'#374151', marginBottom:12 }}>Link a WordPress site to sync rankings and page data</div>
                                <button onClick={()=>setTab('sites')} style={{ fontSize:13, fontWeight:700, color:'#fff', background:RED, border:'none', padding:'7px 16px', borderRadius:9, cursor:'pointer' }}>
                                  Add site
                                </button>
                              </div>
                            ) : sites.slice(0,3).map((s,i)=>(
                              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 20px', borderBottom:i<Math.min(sites.length,3)-1?'1px solid #f9fafb':'none' }}>
                                <div style={{ width:36, height:36, borderRadius:9, background:s.is_active?TEAL+'20':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                  <Globe size={16} color={s.is_active?TEAL:'#9ca3af'}/>
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:14, fontWeight:800, color:'#111', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.site_name}</div>
                                  <div style={{ fontSize:13, color:'#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.site_url}</div>
                                </div>
                                <span style={{ fontSize:13, fontWeight:800, padding:'3px 10px', borderRadius:20, background:s.is_active?TEAL+'20':'#f3f4f6', color:s.is_active?'#0e7490':'#374151', flexShrink:0 }}>
                                  {s.is_active?'Active':'Off'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── KEYWORDS ── */}
                    {tab === 'keywords' && (
                      <div className="animate-fade-up">
                        <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center' }}>
                          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:11, padding:'9px 14px' }}>
                            <Search size={14} color="#9ca3af"/>
                            <input value={kwSearch} onChange={e=>setKwSearch(e.target.value)} placeholder="Filter keywords…"
                              style={{ border:'none', outline:'none', fontSize:14, background:'transparent', flex:1, color:'#111' }}/>
                          </div>
                          <div style={{ fontSize:14, color:'#374151', fontWeight:700, flexShrink:0 }}>{filtKws.length} keywords</div>
                        </div>

                        {filtKws.length === 0 ? (
                          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                            <Search size={36} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
                            <div style={{ fontSize:17, fontWeight:900, color:'#111', marginBottom:6 }}>No keywords tracked yet</div>
                            <div style={{ fontSize:14, color:'#374151', marginBottom:18 }}>Connect Google Search Console to pull live ranking data</div>
                            <button onClick={()=>setTab('connect')} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                              Connect Search Console
                            </button>
                          </div>
                        ) : (
                          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                              <thead>
                                <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                                  {['Keyword','Position','Change','Clicks','Impressions','CTR'].map(h=>(
                                    <th key={h} style={{ padding:'12px 16px', fontSize:13, fontWeight:800, color:'#111', textAlign:'left', textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {filtKws.map((kw,i)=>(
                                  <tr key={kw.id}
                                    style={{ borderBottom:i<filtKws.length-1?'1px solid #f9fafb':'none' }}
                                    onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                                    <td style={{ padding:'13px 16px', fontSize:14, fontWeight:800, color:'#111' }}>{kw.keyword}</td>
                                    <td style={{ padding:'13px 16px' }}>
                                      <span style={{ fontSize:18, fontWeight:900, color:kw.position<=3?'#16a34a':kw.position<=10?TEAL:kw.position<=20?'#d97706':'#374151' }}>
                                        #{kw.position}
                                      </span>
                                    </td>
                                    <td style={{ padding:'13px 16px' }}><Delta cur={kw.position} prev={kw.previous_position}/></td>
                                    <td style={{ padding:'13px 16px', fontSize:14, fontWeight:700, color:'#111' }}>{kw.clicks?.toLocaleString()||'—'}</td>
                                    <td style={{ padding:'13px 16px', fontSize:14, color:'#374151' }}>{kw.impressions?.toLocaleString()||'—'}</td>
                                    <td style={{ padding:'13px 16px' }}>
                                      <span style={{ fontSize:13, fontWeight:700, color:kw.ctr>.05?'#16a34a':'#374151' }}>
                                        {kw.ctr?`${(kw.ctr*100).toFixed(1)}%`:'—'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── WP SITES ── */}
                    {tab === 'sites' && (
                      <div className="animate-fade-up">
                        {/* Add form */}
                        <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${RED}30`, padding:'20px 24px', marginBottom:16 }}>
                          <div style={{ fontSize:15, fontWeight:900, color:'#111', marginBottom:4 }}>Connect a WordPress site</div>
                          <div style={{ fontSize:13, color:'#374151', marginBottom:14 }}>Install the Hyper-Local SEO plugin, then add the site URL below to get your API token.</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'end' }}>
                            <div>
                              <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>Site URL</label>
                              <input value={newSiteUrl} onChange={e=>setNewSiteUrl(e.target.value)}
                                placeholder="https://clientsite.com" onKeyDown={e=>e.key==='Enter'&&addSite()}
                                style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                            </div>
                            <div>
                              <label style={{ fontSize:13, fontWeight:800, color:'#111', display:'block', marginBottom:5 }}>Display name (optional)</label>
                              <input value={newSiteName} onChange={e=>setNewSiteName(e.target.value)}
                                placeholder={selectedClient?.name} onKeyDown={e=>e.key==='Enter'&&addSite()}
                                style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                            </div>
                            <button onClick={addSite} disabled={addingSite||!newSiteUrl.trim()}
                              style={{ padding:'10px 20px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', opacity:!newSiteUrl.trim()?.5:1, display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
                              {addingSite?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Plus size={14}/>} Add Site
                            </button>
                          </div>
                        </div>

                        {/* How-to */}
                        <div style={{ background:'#e8f9fa', borderRadius:14, border:`1px solid ${TEAL}50`, padding:'14px 18px', marginBottom:16 }}>
                          <div style={{ fontSize:14, fontWeight:900, color:'#0e7490', marginBottom:6 }}>Setup guide</div>
                          {['Install the Hyper-Local SEO plugin on the WordPress site','Go to HLSEO → Agency Connect in WordPress admin','Paste the Agency Dashboard URL and API token from below','Save — the plugin verifies and begins syncing automatically'].map((s,i)=>(
                            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:4 }}>
                              <span style={{ width:18, height:18, borderRadius:'50%', background:TEAL, color:'#fff', fontSize:13, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{i+1}</span>
                              <span style={{ fontSize:14, color:'#0e7490' }}>{s}</span>
                            </div>
                          ))}
                        </div>

                        {/* Site cards */}
                        {sites.length === 0 ? (
                          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center' }}>
                            <Globe size={36} color="#e5e7eb" style={{ margin:'0 auto 14px' }}/>
                            <div style={{ fontSize:17, fontWeight:900, color:'#111', marginBottom:6 }}>No sites connected yet</div>
                            <div style={{ fontSize:14, color:'#374151' }}>Add a site above to get your API token</div>
                          </div>
                        ) : sites.map(site=>(
                          <div key={site.id} style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${site.is_active?TEAL+'50':'#e5e7eb'}`, padding:'18px 22px', marginBottom:10 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                              <div style={{ width:44, height:44, borderRadius:12, background:site.is_active?TEAL+'20':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                <Globe size={20} color={site.is_active?TEAL:'#9ca3af'}/>
                              </div>
                              <div style={{ flex:1 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
                                  <div style={{ fontSize:16, fontWeight:900, color:'#111' }}>{site.site_name}</div>
                                  <span style={{ fontSize:13, fontWeight:800, padding:'2px 9px', borderRadius:20, background:site.is_active?TEAL+'20':'#f3f4f6', color:site.is_active?'#0e7490':'#374151' }}>
                                    {site.is_active?'Active':'Inactive'}
                                  </span>
                                  {!site.last_sync_at && <span style={{ fontSize:13, fontWeight:700, color:'#d97706', display:'flex', alignItems:'center', gap:4 }}><AlertCircle size={11}/>Waiting for first sync</span>}
                                </div>
                                <a href={site.site_url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:RED, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                                  {site.site_url}<ExternalLink size={10}/>
                                </a>
                              </div>
                              <div style={{ display:'flex', gap:8 }}>
                                <button onClick={()=>syncSite(site)} style={{ padding:'7px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', gap:5 }}>
                                  <RefreshCw size={12}/> Sync
                                </button>
                                <button onClick={()=>toggleSite(site.id,!site.is_active)} style={{ padding:'7px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:site.is_active?'#d97706':'#16a34a' }}>
                                  {site.is_active?'Disable':'Enable'}
                                </button>
                                <button onClick={()=>deleteSite(site.id)} style={{ padding:'7px 13px', borderRadius:9, border:'1.5px solid #fecaca', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:'#dc2626' }}>
                                  Remove
                                </button>
                              </div>
                            </div>
                            {/* Token */}
                            <div style={{ background:'#f9fafb', borderRadius:10, padding:'11px 14px', border:'1px solid #f3f4f6' }}>
                              <div style={{ fontSize:13, fontWeight:800, color:'#374151', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
                                <Key size={11}/> API TOKEN — paste into WordPress → HLSEO → Agency Connect
                              </div>
                              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                <code style={{ flex:1, fontSize:13, fontFamily:'monospace', color:'#111', background:'#fff', padding:'7px 12px', borderRadius:8, border:'1px solid #e5e7eb', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {site.api_token}
                                </code>
                                <button onClick={()=>copyToken(site.api_token, site.id)}
                                  style={{ padding:'7px 14px', borderRadius:8, border:'none', background:copiedToken===site.id?TEAL:RED, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:5, flexShrink:0, transition:'background .2s' }}>
                                  {copiedToken===site.id?<><Check size={12}/>Copied!</>:<><Copy size={12}/>Copy</>}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── CONNECT DATA ── */}
                    {tab === 'connect' && (
                      <div className="animate-fade-up">
                        <div style={{ fontSize:17, fontWeight:900, color:'#111', marginBottom:4 }}>Connect data sources</div>
                        <div style={{ fontSize:14, color:'#374151', marginBottom:20 }}>Link Google accounts to pull live SEO data — rankings, traffic, ad spend, and review metrics.</div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                          {PROVIDERS.map(p=>{
                            const c = conn(p.key)
                            const I = p.icon
                            return (
                              <div key={p.key} style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${c?TEAL+'50':'#e5e7eb'}`, padding:'22px 24px' }}>
                                <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:16 }}>
                                  <div style={{ width:44, height:44, borderRadius:12, background:c?TEAL+'20':p.color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                    <I size={20} color={c?TEAL:p.color}/>
                                  </div>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:16, fontWeight:900, color:'#111', marginBottom:3 }}>{p.label}</div>
                                    <div style={{ fontSize:13, color:'#374151' }}>{p.desc}</div>
                                  </div>
                                  <span style={{ fontSize:13, fontWeight:800, padding:'3px 10px', borderRadius:20, background:c?TEAL+'20':'#f3f4f6', color:c?'#0e7490':'#374151', flexShrink:0 }}>
                                    {c?'Connected':'Not connected'}
                                  </span>
                                </div>
                                <button onClick={()=>navigate(`/seo/connect?provider=${p.key}&client=${selectedClient?.id}`)}
                                  style={{ width:'100%', padding:'10px', borderRadius:10, border:`1.5px solid ${c?TEAL+'60':'#e5e7eb'}`, background:c?'#e8f9fa':'#f9fafb', color:c?'#0e7490':RED, fontSize:14, fontWeight:800, cursor:'pointer' }}>
                                  {c?'Manage connection':'Connect →'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── REPORTS ── */}
                    {tab === 'reports' && (
                      <div className="animate-fade-up">
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                          <div style={{ fontSize:17, fontWeight:900, color:'#111' }}>SEO Reports</div>
                          <button onClick={generateAnalysis} disabled={generating}
                            style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>
                            {generating?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={13}/>} Generate Report
                          </button>
                        </div>
                        {reports.length === 0 ? (
                          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                            <FileText size={36} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
                            <div style={{ fontSize:17, fontWeight:900, color:'#111', marginBottom:6 }}>No reports yet</div>
                            <div style={{ fontSize:14, color:'#374151', marginBottom:18 }}>Generate an AI-powered SEO report to track progress and share with your client</div>
                          </div>
                        ) : reports.map(r=>(
                          <div key={r.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:10, display:'flex', alignItems:'center', gap:14 }}>
                            <div style={{ width:40, height:40, borderRadius:10, background:RED+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <FileText size={18} color={RED}/>
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:15, fontWeight:900, color:'#111' }}>{r.title}</div>
                              <div style={{ fontSize:13, color:'#374151', textTransform:'capitalize' }}>{r.report_type} · {new Date(r.generated_at).toLocaleDateString()}</div>
                            </div>
                            {r.score && (
                              <div style={{ fontSize:22, fontWeight:900, color:r.score>=70?'#16a34a':RED }}>{r.score}/100</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
