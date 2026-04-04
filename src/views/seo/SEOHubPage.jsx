"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, Search, BarChart2, MapPin, FileText, Sparkles,
  Globe, Star, DollarSign, Eye, ArrowUp, ArrowDown, Minus,
  Plus, RefreshCw, Loader2, Check, X, Copy, Link2,
  Zap, Target, Settings, Key, Wifi, WifiOff, AlertCircle,
  ChevronRight, ExternalLink, Activity, Users
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { callClaude } from '../../lib/ai'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

const ACCENT = '#ea2729'
const TEAL   = '#5bc6d0'

const TABS = [
  { key: 'overview',  label: 'Overview',  icon: BarChart2 },
  { key: 'keywords',  label: 'Keywords',  icon: Search },
  { key: 'sites',     label: 'WP Sites',  icon: Globe },
  { key: 'connect',   label: 'Connect Data', icon: Link2 },
  { key: 'reports',   label: 'Reports',   icon: FileText },
]

const PROVIDERS = [
  { key: 'search_console', label: 'Search Console', color: '#4285F4', desc: 'Rankings, clicks, impressions' },
  { key: 'analytics',      label: 'Google Analytics', color: '#F4B400', desc: 'Traffic, users, conversions' },
  { key: 'ads',            label: 'Google Ads',       color: '#34A853', desc: 'Spend, ROAS, conversions' },
  { key: 'gmb',            label: 'Business Profile', color: '#EA4335', desc: 'Reviews, views, actions' },
]

function PositionDelta({ current, previous }) {
  if (!previous || current === previous) return <Minus size={13} color="#9ca3af"/>
  const delta = previous - current
  if (delta > 0) return <span style={{ display:'flex', alignItems:'center', gap:2, color:'#16a34a', fontSize:13, fontWeight:700 }}><ArrowUp size={12}/>{delta}</span>
  return <span style={{ display:'flex', alignItems:'center', gap:2, color:'#dc2626', fontSize:13, fontWeight:700 }}><ArrowDown size={12}/>{Math.abs(delta)}</span>
}

export default function SEOHubPage() {
  const navigate  = useNavigate()
  const { agencyId, firstName } = useAuth()
  const { clients, selectedClient, selectClient } = useClient()

  const [tab, setTab]           = useState('overview')
  const [connections, setConnections] = useState([])
  const [keywords, setKeywords] = useState([])
  const [reports, setReports]   = useState([])
  const [sites, setSites]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [addingSite, setAddingSite] = useState(false)
  const [newSiteUrl, setNewSiteUrl]   = useState('')
  const [newSiteName, setNewSiteName] = useState('')
  const [copiedToken, setCopiedToken] = useState(null)

  useEffect(() => {
    if (selectedClient) loadClientData(selectedClient.id)
  }, [selectedClient?.id])

  async function loadClientData(cId) {
    setLoading(true)
    try {
      const [{ data: conns }, { data: kws }, { data: rpts }, { data: st }] = await Promise.all([
        supabase.from('seo_connections').select('*').eq('client_id', cId),
        supabase.from('seo_keyword_tracking').select('*').eq('client_id', cId).order('tracked_at', { ascending: false }).limit(100),
        supabase.from('seo_reports').select('*').eq('client_id', cId).order('generated_at', { ascending: false }).limit(10),
        supabase.from('wp_seo_sites').select('*').eq('client_id', cId).order('created_at', { ascending: false }),
      ])
      setConnections(conns || [])
      setKeywords(kws || [])
      setReports(rpts || [])
      setSites(st || [])
    } catch (e) {
      console.error('SEO load error:', e)
    }
    setLoading(false)
  }

  async function addSite() {
    if (!newSiteUrl.trim() || !selectedClient) return
    setAddingSite(true)
    const { data, error } = await supabase.from('wp_seo_sites').insert({
      agency_id: agencyId,
      client_id: selectedClient.id,
      site_url:  newSiteUrl.trim().replace(/\/$/, ''),
      site_name: newSiteName.trim() || selectedClient.name,
    }).select().single()
    if (error) { toast.error(error.message); setAddingSite(false); return }
    setSites(s => [data, ...s])
    setNewSiteUrl(''); setNewSiteName('')
    toast.success('Site added — copy the API token and paste it into the WordPress plugin')
    setAddingSite(false)
  }

  async function toggleSite(id, active) {
    await supabase.from('wp_seo_sites').update({ is_active: active }).eq('id', id)
    setSites(s => s.map(x => x.id === id ? { ...x, is_active: active } : x))
    toast.success(active ? 'Site enabled' : 'Site disabled')
  }

  async function deleteSite(id) {
    if (!confirm('Remove this site connection?')) return
    await supabase.from('wp_seo_sites').delete().eq('id', id)
    setSites(s => s.filter(x => x.id !== id))
    toast.success('Site removed')
  }

  function copyToken(token, id) {
    navigator.clipboard.writeText(token)
    setCopiedToken(id)
    setTimeout(() => setCopiedToken(null), 2000)
    toast.success('API token copied — paste into WordPress plugin → Agency Connect')
  }

  async function syncSite(site) {
    toast.loading('Syncing…', { id: 'sync' })
    try {
      const r = await fetch(`${site.site_url}/wp-json/hlseo/v1/stats`, {
        headers: { 'X-Agency-Token': site.api_token }
      })
      if (r.ok) {
        await supabase.from('wp_seo_sites').update({ last_sync_at: new Date().toISOString() }).eq('id', site.id)
        setSites(s => s.map(x => x.id === site.id ? { ...x, last_sync_at: new Date().toISOString() } : x))
        toast.success('Synced', { id: 'sync' })
      } else {
        toast.error('Sync failed — check site URL and plugin connection', { id: 'sync' })
      }
    } catch {
      toast.error('Cannot reach site — check URL is public', { id: 'sync' })
    }
  }

  async function generateAnalysis() {
    if (!selectedClient) return
    setGenerating(true)
    try {
      const result = await callClaude(
        'You are a senior SEO strategist. Analyze this client and return ONLY valid JSON.',
        `SEO analysis for "${selectedClient.name}" (${selectedClient.industry || 'local business'}).
Keywords tracked: ${keywords.length}. Connected sources: ${connections.filter(c=>c.connected).length}.
Top keywords: ${keywords.slice(0,5).map(k=>`${k.keyword} (pos ${k.position})`).join(', ') || 'none yet'}.
Return JSON: { overallScore: number, executiveSummary: string, opportunities: [{title,impact,effort,desc}], quickWins: [string], monthlyPlan: {week1:[],week2:[],week3:[],week4:[]} }`,
        2000
      )
      const clean = result.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}')+1))
      setAnalysis(parsed)
      toast.success('Analysis ready')
    } catch(e) {
      toast.error('Analysis failed — check AI API key')
    }
    setGenerating(false)
  }

  const connected = (key) => connections.find(c => c.provider === key && c.connected)
  const topKws = keywords.filter(k => k.position <= 10).length
  const avgPos = keywords.length ? Math.round(keywords.reduce((s,k)=>s+(k.position||50),0)/keywords.length) : null

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f4f4f5' }}>
      <Sidebar/>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:'#000', padding:'16px 24px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:900, color:'#fff', margin:0, letterSpacing:-0.3 }}>
                SEO Hub {selectedClient ? `— ${selectedClient.name}` : ''}
              </h1>
              <p style={{ fontSize:14, color:'rgba(255,255,255,.45)', margin:'3px 0 0' }}>
                {sites.length} connected sites · {keywords.length} tracked keywords · {connections.filter(c=>c.connected).length} data sources
              </p>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {selectedClient && (
                <button onClick={generateAnalysis} disabled={generating}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'none', background: ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  {generating ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> : <Sparkles size={14}/>}
                  AI Analysis
                </button>
              )}
            </div>
          </div>

          {/* Client selector */}
          <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:2 }}>
            {clients.map(c => (
              <button key={c.id} onClick={() => selectClient(c)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, border:`1.5px solid ${selectedClient?.id===c.id?ACCENT:'rgba(255,255,255,.15)'}`, background: selectedClient?.id===c.id?ACCENT:'transparent', color: selectedClient?.id===c.id?'#fff':'rgba(255,255,255,.6)', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, transition:'all .15s' }}>
                {c.name}
                {/* site indicator */}
                {sites.filter(s=>s.client_id===c.id&&s.is_active).length > 0 && (
                  <span style={{ width:6, height:6, borderRadius:'50%', background:TEAL, flexShrink:0 }}/>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', display:'flex', padding:'0 24px', flexShrink:0 }}>
          {TABS.map(t => {
            const I = t.icon
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'13px 16px', border:'none', borderBottom:`2.5px solid ${tab===t.key?ACCENT:'transparent'}`, background:'none', color: tab===t.key?ACCENT:'#374151', fontSize:14, fontWeight: tab===t.key?800:600, cursor:'pointer', transition:'all .15s', marginBottom:-1 }}>
                <I size={15}/> {t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>

          {!selectedClient ? (
            <div style={{ textAlign:'center', padding:'60px 24px' }}>
              <TrendingUp size={40} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
              <div style={{ fontSize:18, fontWeight:800, color:'#111', marginBottom:6 }}>Select a client to view SEO data</div>
              <div style={{ fontSize:15, color:'#374151' }}>Click any client in the bar above to load their SEO dashboard</div>
            </div>
          ) : loading ? (
            <div style={{ textAlign:'center', padding:60 }}><Loader2 size={28} color={ACCENT} style={{ animation:'spin 1s linear infinite', margin:'0 auto' }}/></div>
          ) : (

            <>
              {/* ── OVERVIEW ── */}
              {tab === 'overview' && (
                <div>
                  {/* Stats */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
                    {[
                      { label:'Tracked keywords', value: keywords.length || '—', sub: keywords.length?`${topKws} in top 10`:'No keywords yet', icon:Search },
                      { label:'Avg. position', value: avgPos||'—', sub:'across all keywords', icon:Target },
                      { label:'WP sites connected', value:sites.filter(s=>s.is_active).length, sub:`${sites.length} total`, icon:Globe },
                      { label:'Data sources', value: connections.filter(c=>c.connected).length, sub:`of ${PROVIDERS.length} available`, icon:Activity },
                    ].map(s=>{
                      const I = s.icon
                      return (
                        <div key={s.label} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                          <I size={18} color={ACCENT} style={{ marginBottom:10 }}/>
                          <div style={{ fontSize:28, fontWeight:900, color:'#111', letterSpacing:-0.5 }}>{s.value}</div>
                          <div style={{ fontSize:14, fontWeight:700, color:'#111', marginTop:4 }}>{s.label}</div>
                          <div style={{ fontSize:13, color:'#374151', marginTop:2 }}>{s.sub}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* AI Analysis */}
                  {analysis && (
                    <div style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${ACCENT}30`, padding:'20px 24px', marginBottom:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                        <Sparkles size={18} color={ACCENT}/>
                        <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>AI SEO Analysis</div>
                        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ fontSize:13, color:'#374151' }}>Overall score</div>
                          <div style={{ fontSize:22, fontWeight:900, color: analysis.overallScore>=70?'#16a34a':analysis.overallScore>=50?TEAL:ACCENT }}>{analysis.overallScore}/100</div>
                        </div>
                      </div>
                      <p style={{ fontSize:15, color:'#374151', lineHeight:1.7, marginBottom:16 }}>{analysis.executiveSummary}</p>
                      {analysis.opportunities?.length > 0 && (
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          {analysis.opportunities.slice(0,4).map((op,i)=>(
                            <div key={i} style={{ background:'#f9fafb', borderRadius:10, padding:'12px 14px' }}>
                              <div style={{ fontSize:14, fontWeight:800, color:'#111', marginBottom:4 }}>{op.title}</div>
                              <div style={{ fontSize:13, color:'#374151' }}>{op.desc}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Connection status */}
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px', marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                      <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>Data connections</div>
                      <button onClick={() => setTab('connect')} style={{ fontSize:13, color:ACCENT, fontWeight:700, border:'none', background:'none', cursor:'pointer' }}>Manage →</button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                      {PROVIDERS.map(p => {
                        const conn = connected(p.key)
                        return (
                          <div key={p.key} style={{ borderRadius:10, border:`1.5px solid ${conn?TEAL+'60':'#e5e7eb'}`, padding:'12px 14px', background: conn?'#e8f9fa':'#f9fafb' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                              {conn ? <Wifi size={14} color={TEAL}/> : <WifiOff size={14} color="#9ca3af"/>}
                              <span style={{ fontSize:13, fontWeight:700, color: conn?'#0e7490':'#374151' }}>{conn?'Connected':'Not connected'}</span>
                            </div>
                            <div style={{ fontSize:14, fontWeight:800, color:'#111' }}>{p.label}</div>
                            <div style={{ fontSize:12, color:'#374151', marginTop:2 }}>{p.desc}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* WP Sites quick view */}
                  {sites.length > 0 && (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #f3f4f6' }}>
                        <div style={{ fontSize:16, fontWeight:800, color:'#111' }}>WordPress sites</div>
                        <button onClick={() => setTab('sites')} style={{ fontSize:13, color:ACCENT, fontWeight:700, border:'none', background:'none', cursor:'pointer' }}>View all →</button>
                      </div>
                      {sites.slice(0,3).map((s,i)=>(
                        <div key={s.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 20px', borderBottom: i<Math.min(sites.length,3)-1?'1px solid #f9fafb':'none' }}>
                          <div style={{ width:36, height:36, borderRadius:9, background:s.is_active?TEAL+'20':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Globe size={16} color={s.is_active?TEAL:'#9ca3af'}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:14, fontWeight:800, color:'#111' }}>{s.site_name}</div>
                            <div style={{ fontSize:13, color:'#374151' }}>{s.site_url}</div>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background:s.is_active?TEAL+'20':'#f9fafb', color:s.is_active?'#0e7490':'#374151' }}>
                            {s.is_active?'Active':'Inactive'}
                          </span>
                          {s.last_sync_at && <div style={{ fontSize:12, color:'#374151' }}>Synced {new Date(s.last_sync_at).toLocaleDateString()}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── KEYWORDS ── */}
              {tab === 'keywords' && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                    <div style={{ fontSize:18, fontWeight:900, color:'#111' }}>Keyword Rankings</div>
                    <button onClick={() => loadClientData(selectedClient.id)}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151' }}>
                      <RefreshCw size={13}/> Refresh
                    </button>
                  </div>
                  {keywords.length === 0 ? (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center' }}>
                      <Search size={32} color="#e5e7eb" style={{ margin:'0 auto 14px' }}/>
                      <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:6 }}>No keywords tracked yet</div>
                      <div style={{ fontSize:14, color:'#374151', marginBottom:16 }}>Connect Google Search Console to pull live keyword data, or add keywords manually.</div>
                      <button onClick={()=>setTab('connect')} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                        Connect Search Console
                      </button>
                    </div>
                  ) : (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                            {['Keyword','Position','Change','Clicks','Impressions','CTR','URL'].map(h=>(
                              <th key={h} style={{ padding:'11px 14px', fontSize:13, fontWeight:800, color:'#111', textAlign:'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {keywords.map((kw,i)=>(
                            <tr key={kw.id} style={{ borderBottom: i<keywords.length-1?'1px solid #f9fafb':'none' }}>
                              <td style={{ padding:'12px 14px', fontSize:14, fontWeight:700, color:'#111' }}>{kw.keyword}</td>
                              <td style={{ padding:'12px 14px' }}>
                                <span style={{ fontSize:16, fontWeight:900, color: kw.position<=3?'#16a34a':kw.position<=10?TEAL:kw.position<=20?'#d97706':'#374151' }}>
                                  #{kw.position}
                                </span>
                              </td>
                              <td style={{ padding:'12px 14px' }}><PositionDelta current={kw.position} previous={kw.previous_position}/></td>
                              <td style={{ padding:'12px 14px', fontSize:14, fontWeight:700, color:'#111' }}>{kw.clicks?.toLocaleString()}</td>
                              <td style={{ padding:'12px 14px', fontSize:14, color:'#374151' }}>{kw.impressions?.toLocaleString()}</td>
                              <td style={{ padding:'12px 14px', fontSize:14, color:'#374151' }}>{kw.ctr ? `${(kw.ctr*100).toFixed(1)}%` : '—'}</td>
                              <td style={{ padding:'12px 14px', fontSize:12, color:ACCENT, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {kw.url || '—'}
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
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:900, color:'#111' }}>WordPress Plugin Connections</div>
                      <div style={{ fontSize:14, color:'#374151', marginTop:2 }}>Install the Hyper-Local SEO plugin on the client's WordPress site, then connect it here</div>
                    </div>
                    <button onClick={() => setTab('sites_add')}
                      style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                      <Plus size={14}/> Add Site
                    </button>
                  </div>

                  {/* Add site form */}
                  <div style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${ACCENT}30`, padding:'18px 20px', marginBottom:16 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:'#111', marginBottom:12 }}>Connect a WordPress site</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'end' }}>
                      <div>
                        <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Site URL</label>
                        <input value={newSiteUrl} onChange={e=>setNewSiteUrl(e.target.value)}
                          placeholder="https://clientsite.com"
                          style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                      </div>
                      <div>
                        <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Display name (optional)</label>
                        <input value={newSiteName} onChange={e=>setNewSiteName(e.target.value)}
                          placeholder={selectedClient?.name}
                          style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:'#111', boxSizing:'border-box' }}/>
                      </div>
                      <button onClick={addSite} disabled={addingSite || !newSiteUrl.trim()}
                        style={{ padding:'9px 18px', borderRadius:9, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', opacity: !newSiteUrl.trim()?.5:1, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
                        {addingSite?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<Plus size={13}/>} Add Site
                      </button>
                    </div>
                  </div>

                  {/* How to connect */}
                  <div style={{ background:'#f0fbfc', borderRadius:14, border:`1px solid ${TEAL}40`, padding:'16px 20px', marginBottom:16 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:'#0e7490', marginBottom:8 }}>How to connect a WordPress site</div>
                    {[
                      '1. Install the Hyper-Local SEO plugin on the WordPress site',
                      '2. Go to HLSEO → Agency Connect in the WordPress admin',
                      '3. Paste the Agency Dashboard URL and the API token from this page',
                      '4. Click Save — the plugin will verify the connection automatically',
                      '5. Data syncs daily; click Sync Now to force an immediate update',
                    ].map((step,i)=>(
                      <div key={i} style={{ fontSize:14, color:'#0e7490', marginBottom:4 }}>{step}</div>
                    ))}
                  </div>

                  {/* Site list */}
                  {sites.length === 0 ? (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'40px 24px', textAlign:'center' }}>
                      <Globe size={32} color="#e5e7eb" style={{ margin:'0 auto 12px' }}/>
                      <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:6 }}>No sites connected yet</div>
                      <div style={{ fontSize:14, color:'#374151' }}>Add a site above to get started</div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {sites.map(site=>(
                        <div key={site.id} style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${site.is_active?TEAL+'40':'#e5e7eb'}`, padding:'18px 20px' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                            <div style={{ width:42, height:42, borderRadius:11, background:site.is_active?TEAL+'20':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <Globe size={20} color={site.is_active?TEAL:'#9ca3af'}/>
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                                <div style={{ fontSize:16, fontWeight:900, color:'#111' }}>{site.site_name}</div>
                                <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background:site.is_active?TEAL+'20':'#f9fafb', color:site.is_active?'#0e7490':'#374151' }}>
                                  {site.is_active?'Active':'Inactive'}
                                </span>
                              </div>
                              <a href={site.site_url} target="_blank" rel="noreferrer" style={{ fontSize:14, color:ACCENT, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                                {site.site_url} <ExternalLink size={11}/>
                              </a>
                              {site.last_sync_at && <div style={{ fontSize:13, color:'#374151', marginTop:4 }}>Last synced: {new Date(site.last_sync_at).toLocaleString()}</div>}
                              {!site.last_sync_at && <div style={{ fontSize:13, color:'#d97706', marginTop:4, display:'flex', alignItems:'center', gap:5 }}><AlertCircle size={12}/>Waiting for first sync — configure the plugin</div>}
                            </div>
                            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                              <button onClick={() => syncSite(site)}
                                style={{ padding:'7px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', gap:5 }}>
                                <RefreshCw size={12}/> Sync
                              </button>
                              <button onClick={() => toggleSite(site.id, !site.is_active)}
                                style={{ padding:'7px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:site.is_active?'#d97706':'#16a34a' }}>
                                {site.is_active?'Disable':'Enable'}
                              </button>
                              <button onClick={() => deleteSite(site.id)}
                                style={{ padding:'7px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:'#dc2626' }}>
                                Remove
                              </button>
                            </div>
                          </div>

                          {/* API Token */}
                          <div style={{ marginTop:14, padding:'12px 14px', background:'#f9fafb', borderRadius:10, border:'1px solid #f3f4f6' }}>
                            <div style={{ fontSize:12, fontWeight:800, color:'#374151', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                              <Key size={12}/> API TOKEN — paste this into WordPress → HLSEO → Agency Connect
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <code style={{ flex:1, fontSize:12, fontFamily:'monospace', color:'#111', background:'#fff', padding:'7px 12px', borderRadius:8, border:'1px solid #e5e7eb', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {site.api_token}
                              </code>
                              <button onClick={() => copyToken(site.api_token, site.id)}
                                style={{ padding:'7px 12px', borderRadius:8, border:'none', background: copiedToken===site.id?TEAL:ACCENT, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5, flexShrink:0, transition:'background .2s' }}>
                                {copiedToken===site.id?<><Check size={12}/> Copied!</>:<><Copy size={12}/> Copy</>}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── CONNECT DATA ── */}
              {tab === 'connect' && (
                <div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:6 }}>Connect Data Sources</div>
                  <div style={{ fontSize:14, color:'#374151', marginBottom:20 }}>Link Google accounts to pull live SEO data into the dashboard</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    {PROVIDERS.map(p => {
                      const conn = connected(p.key)
                      return (
                        <div key={p.key} style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${conn?TEAL+'60':'#e5e7eb'}`, padding:'20px 22px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                            <div style={{ width:40, height:40, borderRadius:10, background:p.color+'20', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {conn ? <Wifi size={18} color={TEAL}/> : <WifiOff size={18} color={p.color}/>}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{p.label}</div>
                              <div style={{ fontSize:13, color:'#374151' }}>{p.desc}</div>
                            </div>
                            <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background:conn?TEAL+'20':'#f9fafb', color:conn?'#0e7490':'#374151' }}>
                              {conn?'Connected':'Not connected'}
                            </span>
                          </div>
                          <button onClick={() => navigate(`/seo/connect?provider=${p.key}&client=${selectedClient?.id}`)}
                            style={{ width:'100%', padding:'9px', borderRadius:9, border:`1.5px solid ${conn?TEAL:'#e5e7eb'}`, background: conn?'#e8f9fa':'#fff', color: conn?'#0e7490':ACCENT, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                            {conn?'Manage connection':'Connect →'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── REPORTS ── */}
              {tab === 'reports' && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                    <div style={{ fontSize:18, fontWeight:900, color:'#111' }}>SEO Reports</div>
                    <button onClick={generateAnalysis} disabled={generating}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:10, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                      {generating?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={13}/>} Generate Report
                    </button>
                  </div>
                  {reports.length === 0 ? (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center' }}>
                      <FileText size={32} color="#e5e7eb" style={{ margin:'0 auto 14px' }}/>
                      <div style={{ fontSize:16, fontWeight:800, color:'#111', marginBottom:6 }}>No reports yet</div>
                      <div style={{ fontSize:14, color:'#374151', marginBottom:16 }}>Generate an AI-powered SEO report to track progress over time</div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {reports.map(r=>(
                        <div key={r.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                          <FileText size={20} color={ACCENT} style={{ flexShrink:0 }}/>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>{r.title}</div>
                            <div style={{ fontSize:13, color:'#374151' }}>{r.report_type} · {new Date(r.generated_at).toLocaleDateString()}</div>
                          </div>
                          {r.score && <div style={{ fontSize:18, fontWeight:900, color:r.score>=70?'#16a34a':ACCENT }}>{r.score}/100</div>}
                        </div>
                      ))}
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
