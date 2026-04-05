"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, Search, BarChart2, MapPin, FileText, Sparkles,
  Globe, DollarSign, ArrowUp, ArrowDown, Minus,
  Plus, RefreshCw, Loader2, Check, Copy, Link2,
  Target, Key, Wifi, WifiOff, User2, MousePointer, Eye, Calendar, Users, AlertCircle,
  ExternalLink, Activity, ChevronRight, Zap, Shield
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import AIThinkingBox from '../../components/AIThinkingBox'
import { supabase } from '../../lib/supabase'
import { useMobile } from '../../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileCard, MobileRow, MobileSectionHeader, MobileEmpty, MobileTabs } from '../../components/mobile/MobilePage'
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
  const [syncing,    setSyncing]    = useState(false)
  const [analyticsData,   setAnalyticsData]   = useState(null)
  const [analyticsLoading,setAnalyticsLoading]= useState(false)
  const [reportType,      setReportType]      = useState('overview')
  const [dateRange,       setDateRange]       = useState('30d')
  const [compare,         setCompare]         = useState('previous_period')
  const [customStart,     setCustomStart]     = useState('')
  const [customEnd,       setCustomEnd]       = useState('')
  const [liveData,   setLiveData]   = useState(null)
  const [analysis, setAnalysis]     = useState(null)
  const [newSiteUrl, setNewSiteUrl] = useState('')
  const [newSiteName, setNewSiteName] = useState('')
  const [addingSite, setAddingSite] = useState(false)
  const [copiedToken, setCopiedToken] = useState(null)
  const [kwSearch, setKwSearch]     = useState('')
  const [newKw,    setNewKw]        = useState('')

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
      // Step 1: pull real data from GSC + GA4
      toast('Fetching Search Console & Analytics data…', { icon: '📊' })
      let liveData = {}
      try {
        const dataRes = await fetch('/api/seo/pull-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: selectedClient.id, days: 30 }),
        })
        if (dataRes.ok) liveData = await dataRes.json()
        else console.warn('pull-data returned', dataRes.status)
      } catch(fetchErr) {
        console.warn('Could not fetch live data, using empty dataset:', fetchErr)
      }

      // Step 2: parse GSC rows into useful stats
      const gscRows   = liveData.gsc?.rows || []
      const gscPrev   = liveData.gsc_prev?.rows || []
      const totalClicks      = gscRows.reduce((s,r) => s + (r.clicks||0), 0)
      const totalImpressions = gscRows.reduce((s,r) => s + (r.impressions||0), 0)
      const avgCTR           = totalImpressions ? (totalClicks / totalImpressions * 100).toFixed(2) : 0
      const avgPosition      = gscRows.length ? (gscRows.reduce((s,r) => s + (r.position||0), 0) / gscRows.length).toFixed(1) : 'N/A'
      const prevClicks       = gscPrev.reduce((s,r) => s + (r.clicks||0), 0)
      const clicksDelta      = prevClicks ? Math.round((totalClicks - prevClicks) / prevClicks * 100) : null

      // Top performing keywords from GSC
      const topKwByClicks   = [...gscRows].sort((a,b) => (b.clicks||0)-(a.clicks||0)).slice(0,10)
      // Quick wins: position 4-20, decent impressions
      const quickWinKws     = gscRows.filter(r => r.position>=4 && r.position<=20 && r.impressions>50)
        .sort((a,b) => b.impressions-a.impressions).slice(0,8)
      // Low CTR opportunities
      const lowCTRKws       = gscRows.filter(r => r.impressions>100 && r.ctr<0.02)
        .sort((a,b) => b.impressions-a.impressions).slice(0,5)

      // Step 3: parse GA4 rows
      const ga4Rows   = liveData.ga4?.rows || []
      const ga4Prev   = liveData.ga4_prev?.rows || []
      const totalSessions    = ga4Rows.reduce((s,r) => s + parseInt(r.metricValues?.[0]?.value||0), 0)
      const totalUsers       = ga4Rows.reduce((s,r) => s + parseInt(r.metricValues?.[1]?.value||0), 0)
      const avgBounce        = ga4Rows.length ? (ga4Rows.reduce((s,r) => s + parseFloat(r.metricValues?.[2]?.value||0), 0) / ga4Rows.length * 100).toFixed(1) : 'N/A'
      const prevSessions     = ga4Prev.reduce((s,r) => s + parseInt(r.metricValues?.[0]?.value||0), 0)
      const sessionsDelta    = prevSessions ? Math.round((totalSessions - prevSessions) / prevSessions * 100) : null
      // Channel breakdown
      const channels = ga4Rows.map(r => ({
        channel:  r.dimensionValues?.[0]?.value || 'Unknown',
        sessions: parseInt(r.metricValues?.[0]?.value||0),
        users:    parseInt(r.metricValues?.[1]?.value||0),
      })).sort((a,b) => b.sessions-a.sessions)
      const organicSessions = channels.find(c => c.channel.toLowerCase().includes('organic'))?.sessions || 0

      // Step 4: build rich prompt with real data
      toast('Running AI analysis…', { icon: '🤖' })
      const prompt = `You are a senior SEO strategist analyzing real data for "${selectedClient.name}" (${selectedClient.industry||'local business'}).

LAST 30 DAYS — GOOGLE SEARCH CONSOLE:
- Total clicks: ${totalClicks.toLocaleString()} (${clicksDelta != null ? (clicksDelta>=0?'+':'')+clicksDelta+'% vs prev 30d' : 'no prev data'})
- Total impressions: ${totalImpressions.toLocaleString()}
- Average CTR: ${avgCTR}%
- Average position: ${avgPosition}
- Keywords tracked: ${gscRows.length}
- Site: ${liveData.gsc_site || 'unknown'}

TOP 10 KEYWORDS BY CLICKS:
${topKwByClicks.map(k => '  "' + (k.keys?.[0]) + '" — pos ' + (k.position?.toFixed(1)) + ', ' + (k.clicks) + ' clicks, ' + (k.impressions) + ' impr, ' + ((k.ctr*100).toFixed(1)) + '% CTR').join('\n') || '  No data yet'}

QUICK WIN OPPORTUNITIES (positions 4-20, high impressions):
${quickWinKws.map(k => '  "' + (k.keys?.[0]) + '" — pos ' + (k.position?.toFixed(1)) + ', ' + (k.impressions) + ' impressions, only ' + (k.clicks) + ' clicks').join('\n') || '  None identified'}

LOW CTR KEYWORDS (high impressions, <2% CTR):
${lowCTRKws.map(k => '  "' + (k.keys?.[0]) + '" — ' + (k.impressions) + ' impr, ' + ((k.ctr*100).toFixed(1)) + '% CTR (' + (k.clicks) + ' clicks)').join('\n') || '  None identified'}

LAST 30 DAYS — GOOGLE ANALYTICS 4:
- Total sessions: ${totalSessions.toLocaleString()} (${sessionsDelta != null ? (sessionsDelta>=0?'+':'')+sessionsDelta+'% vs prev 30d' : 'no prev data'})
- Total users: ${totalUsers.toLocaleString()}
- Average bounce rate: ${avgBounce}%
- Organic sessions: ${organicSessions.toLocaleString()} (${totalSessions ? Math.round(organicSessions/totalSessions*100) : 0}% of total)

TRAFFIC BY CHANNEL:
${channels.slice(0,6).map(c => `  ${c.channel}: ${c.sessions} sessions (${totalSessions ? Math.round(c.sessions/totalSessions*100) : 0}%)`).join('\n') || '  No data yet'}

CROSS-SOURCE INSIGHTS:
- GSC shows ${totalClicks} organic clicks but GA4 shows ${organicSessions} organic sessions — ${Math.abs(totalClicks-organicSessions)<totalClicks*0.3 ? 'these are roughly aligned' : 'there may be a tracking gap to investigate'}
- ${quickWinKws.length} keywords are ranking positions 4-20 and could move to page 1 with content optimization
- ${lowCTRKws.length} keywords have high impressions but poor click-through — title/meta description improvement opportunity

Return ONLY valid JSON (no markdown):
{
  "overallScore": <0-100 based on traffic health, ranking quality, growth trend>,
  "executiveSummary": "<3-4 sentence summary of current SEO health and biggest opportunities>",
  "gscHighlights": "<1-2 sentences on search visibility trends>",
  "ga4Highlights": "<1-2 sentences on traffic quality and channels>",
  "opportunities": [
    {"title": "<specific action>", "impact": "high|medium|low", "effort": "high|medium|low", "desc": "<why and how>", "keyword": "<specific keyword if applicable>"}
  ],
  "quickWins": ["<specific actionable item based on data>"],
  "concerns": ["<specific issue to address>"]
}`

      const result = await callClaude('You are a senior SEO strategist. Return ONLY valid JSON.', prompt, 2000)
      const clean = result.replace(/```json|```/g,'').trim()
      const data = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}')+1))
      setAnalysis(data)

      // Step 5: save report with all the real data
      await supabase.from('seo_reports').insert({
        client_id:    selectedClient.id,
        agency_id:    agencyId,
        title:        `SEO Analysis — ${selectedClient.name}`,
        report_type:  'ai_analysis',
        generated_at: new Date().toISOString(),
        score:        data.overallScore,
        summary:      data.executiveSummary,
        content: {
          opportunities:      data.opportunities || [],
          quick_wins:         data.quickWins || [],
          concerns:           data.concerns || [],
          gsc_highlights:     data.gscHighlights,
          ga4_highlights:     data.ga4Highlights,
          // Raw metrics for display
          metrics: {
            clicks:          totalClicks,
            impressions:     totalImpressions,
            avg_ctr:         parseFloat(avgCTR),
            avg_position:    parseFloat(avgPosition) || null,
            clicks_delta:    clicksDelta,
            sessions:        totalSessions,
            users:           totalUsers,
            bounce_rate:     parseFloat(avgBounce) || null,
            sessions_delta:  sessionsDelta,
            organic_sessions: organicSessions,
            channels,
            top_keywords:    topKwByClicks.slice(0,5).map(k=>({ keyword:k.keys?.[0], position:k.position, clicks:k.clicks, impressions:k.impressions, ctr:k.ctr })),
            quick_win_count: quickWinKws.length,
            low_ctr_count:   lowCTRKws.length,
          },
          gsc_site:    liveData.gsc_site,
          ga4_property: liveData.ga4_property,
          period_days: 30,
        },
      })

      const { data: reps } = await supabase.from('seo_reports').select('*')
        .eq('client_id', selectedClient.id).order('generated_at', { ascending:false }).limit(10)
      setReports(reps || [])
      toast.success('Report generated from live data!')
      setTab('reports')
    } catch(e) {
      console.error('Analysis error:', e)
      const msg = e?.message || String(e)
      if (msg.includes('API key')) toast.error('Anthropic API key not set — add NEXT_PUBLIC_ANTHROPIC_API_KEY')
      else if (msg.includes('CORS') || msg.includes('Failed to fetch')) toast.error('API call blocked — check browser console for details')
      else toast.error('Report failed: ' + msg)
    }
    setGenerating(false)
  }


  async function runAnalytics() {
    if (!selectedClient) return
    setAnalyticsLoading(true)
    try {
      const res = await fetch('/api/seo/analytics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:    selectedClient.id,
          report_type:  reportType,
          date_range:   dateRange,
          custom_start: customStart||undefined,
          custom_end:   customEnd||undefined,
          compare,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalyticsData(data)
    } catch(e) { toast.error('Analytics failed: ' + e.message) }
    setAnalyticsLoading(false)
  }

  async function syncKeywords() {
    if (!selectedClient) return
    const gscConn = connections.find(c => c.provider === 'search_console' && c.connected)
    if (!gscConn?.site_url) {
      toast.error('Connect Search Console first to sync positions')
      setTab('connect')
      return
    }
    setSyncing(true)
    toast.loading('Syncing keyword positions from Search Console…', { id: 'sync-kw' })
    try {
      const res = await fetch('/api/seo/sync-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedClient.id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success(`Synced ${data.synced} keywords · ${data.notFound} not yet ranking`, { id: 'sync-kw' })
      // Reload keywords
      const { data: kws } = await supabase.from('seo_keyword_tracking').select('*')
        .eq('client_id', selectedClient.id).order('position').limit(200)
      setKeywords(kws || [])
    } catch(e) {
      toast.error('Sync failed: ' + e.message, { id: 'sync-kw' })
    }
    setSyncing(false)
  }

  async function addKeyword(keyword) {
    if (!keyword?.trim() || !selectedClient) return
    const kw = keyword.trim().toLowerCase()
    // Check duplicate
    if (keywords.find(k => k.keyword === kw)) { toast.error('Keyword already tracked'); return }
    const { error } = await supabase.from('seo_keyword_tracking').insert({
      client_id:   selectedClient.id,
      agency_id:   agencyId,
      keyword:     kw,
      position:    null,
      clicks:      0,
      impressions: 0,
      ctr:         null,
      added_at:    new Date().toISOString(),
    })
    if (error) { toast.error(error.message); return }
    toast.success(`"${kw}" added to tracking`)
    // Reload keywords
    const { data: kws } = await supabase.from('seo_keyword_tracking').select('*')
      .eq('client_id', selectedClient.id).order('position').limit(200)
    setKeywords(kws || [])
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
        <div style={{ fontSize:13, fontWeight:600, color:subC, marginTop:6 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:subC, marginTop:2 }}>{sub}</div>}
      </div>
    )
  }

  const isMobile = useMobile()

  /* ─── MOBILE ─── */
  if (isMobile) {
    const TABS_M = [
      {key:'overview',  label:'Overview'},
      {key:'keywords',  label:'Keywords', count:keywords?.length},
      {key:'sites',     label:'WP Sites', count:sites?.length},
    ]
    return (
      <MobilePage padded={false}>
        <MobilePageHeader title="SEO Hub" subtitle="Search visibility & analytics"/>
        <MobileTabs tabs={TABS_M} active={tab} onChange={setTab}/>

        {tab==='overview' && (
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
            <MobileCard style={{padding:'14px'}}>
              <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:14,fontWeight:800,color:'#0a0a0a',marginBottom:10}}>Connections</div>
              {[
                {label:'Google Search Console',key:'gsc',color:'#4285f4'},
                {label:'Google Analytics 4',   key:'ga4',color:'#e8710a'},
                {label:'Google Business Profile',key:'gmb',color:'#34a853'},
              ].map((p,i)=>(
                <div key={p.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:i<2?'1px solid #f2f2f0':'none'}}>
                  <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:14,fontWeight:600,color:'#0a0a0a'}}>{p.label}</div>
                  {connections?.[p.key]
                    ? <span style={{fontSize:11,fontWeight:800,color:'#16a34a',background:'#f0fdf4',padding:'2px 8px',borderRadius:20,fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>✓ Connected</span>
                    : <button style={{padding:'5px 12px',borderRadius:8,border:`1px solid ${p.color}`,background:'transparent',color:p.color,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>Connect</button>
                  }
                </div>
              ))}
            </MobileCard>
          </div>
        )}

        {tab==='keywords' && (
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
            {!keywords?.length ? (
              <div style={{padding:'40px 0',textAlign:'center',color:'#9a9a96',fontSize:14}}>No keywords tracked yet</div>
            ) : (
              <MobileCard style={{margin:0}}>
                {keywords.slice(0,20).map((kw,i)=>(
                  <MobileRow key={kw.id||i}
                    borderBottom={i<keywords.length-1}
                    title={kw.keyword}
                    subtitle={`Position ${kw.position||'—'} · ${kw.clicks||0} clicks`}
                    badge={<span style={{fontSize:12,fontWeight:800,color:kw.position<=3?'#16a34a':kw.position<=10?'#f59e0b':'#9a9a96',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>{kw.position||'—'}</span>}/>
                ))}
              </MobileCard>
            )}
          </div>
        )}

        {tab==='sites' && (
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
            {!sites?.length ? (
              <div style={{padding:'40px 0',textAlign:'center',color:'#9a9a96',fontSize:14}}>No WordPress sites connected</div>
            ) : (
              <MobileCard style={{margin:0}}>
                {sites.map((s,i)=>(
                  <MobileRow key={s.id} borderBottom={i<sites.length-1}
                    title={s.name||s.url}
                    subtitle={s.url}
                    badge={<span style={{fontSize:10,fontWeight:800,color:'#16a34a',background:'#f0fdf4',padding:'2px 6px',borderRadius:20,fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>v{s.plugin_version||'?'}</span>}/>
                ))}
              </MobileCard>
            )}
          </div>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */

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

              
                        {/* Real GSC data */}
                         {liveData?.gsc && (
                           <div style={{ marginBottom:20 }}>
                             <div style={{ fontSize:13, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>Search Console — Last {liveData.period?.days} days</div>
                             <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                               {[
                                 { label:'Clicks',       value:liveData.gsc.totals.clicks.toLocaleString() },
                                 { label:'Impressions',  value:liveData.gsc.totals.impressions.toLocaleString() },
                                 { label:'Avg CTR',      value:liveData.gsc.totals.avgCTR+'%', color:parseFloat(liveData.gsc.totals.avgCTR)>3?'#16a34a':'#d97706' },
                                 { label:'Avg Position', value:'#'+liveData.gsc.totals.avgPos, color:parseFloat(liveData.gsc.totals.avgPos)<10?'#16a34a':'#d97706' },
                               ].map(s=>(
                                 <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'14px 16px' }}>
                                   <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{s.label}</div>
                                   <div style={{ fontSize:22, fontWeight:900, color:s.color||'#0a0a0a' }}>{s.value}</div>
                                 </div>
                               ))}
                             </div>
                             {liveData.gsc.quickWins?.length > 0 && (
                               <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:12 }}>
                                 <div style={{ padding:'12px 18px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                   <div style={{ fontSize:14, fontWeight:900, color:'#111' }}>🎯 Quick Win Keywords <span style={{ fontSize:12, color:'#9ca3af' }}>(pos 4–20, high impressions)</span></div>
                                   <span style={{ fontSize:12, fontWeight:700, background:'#f0fdf4', color:'#16a34a', padding:'2px 8px', borderRadius:20 }}>{liveData.gsc.quickWins.length} found</span>
                                 </div>
                                 <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                   <thead><tr style={{ background:'#f9fafb' }}>
                                     {['Keyword','Pos','Impressions','Clicks','CTR','Est. Gain'].map(h=><th key={h} style={{ padding:'9px 14px', fontSize:11, fontWeight:700, color:'#6b7280', textAlign:'left', textTransform:'uppercase' }}>{h}</th>)}
                                   </tr></thead>
                                   <tbody>
                                     {liveData.gsc.quickWins.slice(0,8).map((kw,i)=>(
                                       <tr key={i} style={{ borderTop:'1px solid #f3f4f6' }}>
                                         <td style={{ padding:'10px 14px', fontSize:14, fontWeight:700, color:'#111' }}>{kw.keyword}</td>
                                         <td style={{ padding:'10px 14px' }}><span style={{ fontSize:15, fontWeight:900, color:kw.position<=5?TEAL:'#d97706' }}>#{kw.position}</span></td>
                                         <td style={{ padding:'10px 14px', fontSize:13, color:'#374151' }}>{kw.impressions.toLocaleString()}</td>
                                         <td style={{ padding:'10px 14px', fontSize:13, color:'#374151' }}>{kw.clicks}</td>
                                         <td style={{ padding:'10px 14px', fontSize:13, color:'#374151' }}>{kw.ctr}</td>
                                         <td style={{ padding:'10px 14px' }}><span style={{ fontSize:13, fontWeight:700, color:'#16a34a' }}>+{kw.potential}</span></td>
                                       </tr>
                                     ))}
                                   </tbody>
                                 </table>
                               </div>
                             )}
                             {liveData.gsc.lowCTR?.length > 0 && (
                               <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:4 }}>
                                 <div style={{ padding:'12px 18px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                   <div style={{ fontSize:14, fontWeight:900, color:'#111' }}>📉 Low CTR Keywords <span style={{ fontSize:12, color:'#9ca3af' }}>(fix meta titles to unlock clicks)</span></div>
                                   <span style={{ fontSize:12, fontWeight:700, background:'#fef2f2', color:RED, padding:'2px 8px', borderRadius:20 }}>{liveData.gsc.lowCTR.length} found</span>
                                 </div>
                                 <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                   <thead><tr style={{ background:'#f9fafb' }}>
                                     {['Keyword','Pos','Impressions','CTR','Potential Clicks'].map(h=><th key={h} style={{ padding:'9px 14px', fontSize:11, fontWeight:700, color:'#6b7280', textAlign:'left', textTransform:'uppercase' }}>{h}</th>)}
                                   </tr></thead>
                                   <tbody>
                                     {liveData.gsc.lowCTR.slice(0,6).map((kw,i)=>(
                                       <tr key={i} style={{ borderTop:'1px solid #f3f4f6' }}>
                                         <td style={{ padding:'10px 14px', fontSize:14, fontWeight:700, color:'#111' }}>{kw.keyword}</td>
                                         <td style={{ padding:'10px 14px', fontSize:13, color:'#374151' }}>#{kw.position}</td>
                                         <td style={{ padding:'10px 14px', fontSize:13, color:'#374151' }}>{kw.impressions.toLocaleString()}</td>
                                         <td style={{ padding:'10px 14px' }}><span style={{ color:RED, fontWeight:700 }}>{kw.currentCTR}</span></td>
                                         <td style={{ padding:'10px 14px' }}><span style={{ color:'#16a34a', fontWeight:700 }}>+{kw.potentialClicks}</span></td>
                                       </tr>
                                     ))}
                                   </tbody>
                                 </table>
                               </div>
                             )}
                           </div>
                         )}
                         {liveData?.ga4 && (
                           <div style={{ marginBottom:20 }}>
                             <div style={{ fontSize:13, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>Google Analytics — Last {liveData.period?.days} days</div>
                             <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                               {[
                                 { label:'Total Sessions',    value:liveData.ga4.totalSessions.toLocaleString() },
                                 { label:'Organic Sessions',  value:liveData.ga4.organicSessions.toLocaleString(), color:liveData.ga4.organicPct>40?'#16a34a':'#d97706' },
                                 { label:'Organic % Traffic', value:liveData.ga4.organicPct+'%', color:liveData.ga4.organicPct>40?'#16a34a':liveData.ga4.organicPct>20?'#d97706':RED },
                               ].map(s=>(
                                 <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'14px 16px' }}>
                                   <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{s.label}</div>
                                   <div style={{ fontSize:22, fontWeight:900, color:s.color||'#0a0a0a' }}>{s.value}</div>
                                 </div>
                               ))}
                             </div>
                             <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                               <div style={{ padding:'12px 18px', borderBottom:'1px solid #f3f4f6', fontSize:14, fontWeight:900, color:'#111' }}>Traffic Channels</div>
                               {liveData.ga4.channels.map((ch,i)=>(
                                 <div key={ch.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 18px', borderBottom:i<liveData.ga4.channels.length-1?'1px solid #f9fafb':'none' }}>
                                   <div style={{ width:80, fontSize:13, fontWeight:700, color:'#111' }}>{ch.pct}%</div>
                                   <div style={{ flex:1, height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
                                     <div style={{ width:ch.pct+'%', height:'100%', background:ch.name==='Organic Search'?'#16a34a':ch.name.includes('Paid')?RED:TEAL, borderRadius:3 }}/>
                                   </div>
                                   <div style={{ flex:2, fontSize:14, color:'#374151' }}>{ch.name}</div>
                                   <div style={{ fontSize:13, fontWeight:700, color:'#111', minWidth:80, textAlign:'right' }}>{ch.sessions.toLocaleString()} sessions</div>
                                   <div style={{ fontSize:12, color:'#9ca3af', minWidth:70, textAlign:'right' }}>{ch.avgBounceRate} bounce</div>
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}
                         {liveData?.crossRef && (liveData.crossRef.issues.length>0||liveData.crossRef.wins.length>0) && (
                           <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:20 }}>
                             <div style={{ padding:'12px 18px', borderBottom:'1px solid #f3f4f6', fontSize:14, fontWeight:900, color:'#111' }}>Cross-Channel Insights</div>
                             <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:8 }}>
                               {liveData.crossRef.issues.map((issue,i)=>(
                                 <div key={i} style={{ display:'flex', gap:10, padding:'10px 12px', background:'#fef2f2', borderRadius:10, borderLeft:`3px solid ${RED}` }}>
                                   <span>⚠️</span><span style={{ fontSize:14, color:'#374151', lineHeight:1.55 }}>{issue}</span>
                                 </div>
                               ))}
                               {liveData.crossRef.wins.map((win,i)=>(
                                 <div key={i} style={{ display:'flex', gap:10, padding:'10px 12px', background:'#f0fdf4', borderRadius:10, borderLeft:'3px solid #16a34a' }}>
                                   <span>✅</span><span style={{ fontSize:14, color:'#374151', lineHeight:1.55 }}>{win}</span>
                                 </div>
                               ))}
                             </div>
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
                         {/* Add keyword */}
                         <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                           <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:11, padding:'9px 14px' }}>
                             <Search size={14} color="#9ca3af"/>
                             <input value={newKw} onChange={e=>setNewKw(e.target.value)}
                               placeholder="Add keyword to track (e.g. plumber miami)…"
                               onKeyDown={e=>{ if(e.key==='Enter'&&newKw.trim()){ addKeyword(newKw); setNewKw('') }}}
                               style={{ border:'none', outline:'none', fontSize:14, background:'transparent', flex:1, color:'#111' }}/>
                           </div>
                           <button onClick={()=>{ if(newKw.trim()){ addKeyword(newKw); setNewKw('') } }}
                             disabled={!newKw.trim()||!selectedClient}
                             style={{ padding:'9px 20px', borderRadius:11, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, flexShrink:0, whiteSpace:'nowrap', opacity:!newKw.trim()||!selectedClient?.5:1 }}>
                             <Plus size={14}/> Add Keyword
                           </button>
                           <button onClick={syncKeywords} disabled={syncing||!selectedClient}
                             style={{ padding:'9px 16px', borderRadius:11, border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, flexShrink:0, whiteSpace:'nowrap', opacity:!selectedClient?.5:1 }}>
                             {syncing ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <RefreshCw size={14}/>}
                             Sync Positions
                           </button>
                         </div>
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
                        {/* Download plugin banner */}
                        <div style={{ background:`linear-gradient(135deg, ${TEAL}18, ${TEAL}08)`, borderRadius:14, border:`1.5px solid ${TEAL}40`, padding:'16px 20px', marginBottom:14, display:'flex', alignItems:'center', gap:14 }}>
                          <div style={{ width:40, height:40, borderRadius:10, background:TEAL+'25', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <Globe size={20} color={TEAL}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:14, fontWeight:800, color:'#111', marginBottom:2 }}>Koto SEO Plugin for WordPress</div>
                            <div style={{ fontSize:13, color:'#374151' }}>Install on your client's WordPress site to enable full SEO sync and automation.</div>
                          </div>
                          <a href="/koto-seo.zip" download
                            style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px',
                              borderRadius:10, border:'none', background:TEAL, color:'#fff',
                              fontSize:14, fontWeight:700, cursor:'pointer', textDecoration:'none',
                              flexShrink:0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download Plugin (.zip)
                          </a>
                        </div>
                        {/* Add form */}
                        <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${RED}30`, padding:'20px 24px', marginBottom:16 }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:4 }}>
                            <div style={{ fontSize:15, fontWeight:900, color:'#111' }}>Connect a WordPress site</div>
                          </div>
                          <div style={{ fontSize:13, color:'#374151', marginBottom:14 }}>
                            Download and install the Koto SEO Plugin on your client's WordPress site, then add the site URL below to get your API token.
                          </div>
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
                          {['Install the Koto SEO Plugin on the WordPress site','Go to Koto SEO → Agency Connect in WordPress admin','Paste the Agency Dashboard URL and API token from below','Save — the plugin verifies and begins syncing automatically'].map((s,i)=>(
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
                                <Key size={11}/> API TOKEN — paste into WordPress → Koto SEO → Agency Connect
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
                                        {tab === 'reports' && (
                      <div className="animate-fade-up">

                        {/* ── Analytics Explorer Header ── */}
                        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 24px', marginBottom:14 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                            <div style={{ fontSize:17, fontWeight:900, color:'#111' }}>Analytics Explorer</div>
                            <div style={{ display:'flex', gap:8 }}>
                              <button onClick={generateAnalysis} disabled={generating}
                                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9, border:`1.5px solid ${RED}`, background:'transparent', color:RED, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                                {generating?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={12}/>} AI Report
                              </button>
                              <button onClick={runAnalytics} disabled={analyticsLoading||!selectedClient}
                                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:!selectedClient?.5:1 }}>
                                {analyticsLoading?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<RefreshCw size={12}/>} Run Report
                              </button>
                            </div>
                          </div>

                          {/* Controls row */}
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                            {/* Report type */}
                            <div>
                              <label style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Report</label>
                              <select value={reportType} onChange={e=>setReportType(e.target.value)}
                                style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, color:'#111', background:'#fff' }}>
                                <option value="overview">Overview</option>
                                <option value="keywords">Keywords</option>
                                <option value="pages">Top Pages</option>
                                <option value="channels">Traffic Channels</option>
                                <option value="devices">Devices</option>
                                <option value="countries">Countries</option>
                                <option value="daily_trend">Daily Trend</option>
                              </select>
                            </div>
                            {/* Date range */}
                            <div>
                              <label style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Date Range</label>
                              <select value={dateRange} onChange={e=>setDateRange(e.target.value)}
                                style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, color:'#111', background:'#fff' }}>
                                <option value="7d">Last 7 days</option>
                                <option value="28d">Last 28 days</option>
                                <option value="30d">Last 30 days</option>
                                <option value="90d">Last 90 days</option>
                                <option value="6m">Last 6 months</option>
                                <option value="12m">Last 12 months</option>
                                <option value="this_month">This month</option>
                                <option value="last_month">Last month</option>
                                <option value="this_year">This year</option>
                                <option value="last_year">Last year</option>
                                <option value="custom">Custom range</option>
                              </select>
                            </div>
                            {/* Compare */}
                            <div>
                              <label style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Compare To</label>
                              <select value={compare} onChange={e=>setCompare(e.target.value)}
                                style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, color:'#111', background:'#fff' }}>
                                <option value="previous_period">Previous period</option>
                                <option value="same_period_last_year">Same period last year</option>
                                <option value="none">No comparison</option>
                              </select>
                            </div>
                          </div>

                          {/* Custom date range pickers */}
                          {dateRange === 'custom' && (
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
                              <div>
                                <label style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Start Date</label>
                                <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}
                                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, color:'#111' }}/>
                              </div>
                              <div>
                                <label style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>End Date</label>
                                <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}
                                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, color:'#111' }}/>
                              </div>
                            </div>
                          )}

                          {/* Period label */}
                          {analyticsData && (
                            <div style={{ marginTop:12, padding:'8px 12px', background:'#f9fafb', borderRadius:8, fontSize:13, color:'#6b7280', display:'flex', alignItems:'center', gap:8 }}>
                              <Calendar size={13}/>
                              <span><strong style={{color:'#111'}}>{analyticsData.period?.start}</strong> → <strong style={{color:'#111'}}>{analyticsData.period?.end}</strong> ({analyticsData.period?.days} days)</span>
                              {analyticsData.compare_period && (
                                <span style={{ marginLeft:8, color:'#9ca3af' }}>vs <strong style={{color:'#6b7280'}}>{analyticsData.compare_period.start}</strong> → <strong style={{color:'#6b7280'}}>{analyticsData.compare_period.end}</strong></span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ── Results ── */}
                        {!analyticsData && !analyticsLoading && (
                          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                            <BarChart2 size={40} color="#e5e7eb" style={{ margin:'0 auto 16px' }}/>
                            <div style={{ fontSize:17, fontWeight:900, color:'#111', marginBottom:6 }}>Run your first report</div>
                            <div style={{ fontSize:14, color:'#374151', marginBottom:20 }}>Choose a report type and date range above, then click Run Report</div>
                            <button onClick={runAnalytics} disabled={!selectedClient}
                              style={{ padding:'10px 24px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', opacity:!selectedClient?.5:1 }}>
                              Run Report
                            </button>
                          </div>
                        )}

                        {analyticsLoading && (
                          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
                            <Loader2 size={32} color={RED} style={{ margin:'0 auto 16px', animation:'spin 1s linear infinite' }}/>
                            <div style={{ fontSize:15, fontWeight:700, color:'#374151' }}>Fetching data from Google…</div>
                          </div>
                        )}

                        {analyticsData && !analyticsLoading && (() => {
                          const d = analyticsData
                          const gscRows  = d.gsc?.rows  || []
                          const gscPRows = d.gsc_prev?.rows || []
                          const ga4Rows  = d.ga4?.rows  || []
                          const ga4PRows = d.ga4_prev?.rows || []

                          // Helpers
                          const sumGSC = (rows: any[], key: string) => rows.reduce((s,r)=>s+(r[key]||0),0)
                          const sumGA4 = (rows: any[], metIdx: number) => rows.reduce((s,r)=>s+parseFloat(r.metricValues?.[metIdx]?.value||0),0)
                          const delta  = (curr: number, prev: number) => prev>0 ? Math.round((curr-prev)/prev*100) : null
                          const DeltaBadge = ({curr, prev}: any) => {
                            const d = delta(curr,prev)
                            if (d===null || prev===0) return null
                            return (
                              <span style={{ fontSize:11, fontWeight:800, padding:'2px 7px', borderRadius:20,
                                background:d>=0?'#f0fdf4':'#fef2f2', color:d>=0?'#16a34a':RED,
                                marginLeft:8, display:'inline-flex', alignItems:'center', gap:2 }}>
                                {d>=0?'↑':'↓'}{Math.abs(d)}%
                              </span>
                            )
                          }

                          // Overview KPI cards
                          const gscClicks      = sumGSC(gscRows,'clicks')
                          const gscImpr        = sumGSC(gscRows,'impressions')
                          const gscAvgPos      = gscRows.length ? (sumGSC(gscRows,'position')/gscRows.length).toFixed(1) : '—'
                          const gscAvgCTR      = gscImpr ? (gscClicks/gscImpr*100).toFixed(1)+'%' : '—'
                          const gscPClicks     = sumGSC(gscPRows,'clicks')
                          const gscPImpr       = sumGSC(gscPRows,'impressions')
                          const ga4Sessions    = Math.round(sumGA4(ga4Rows,0))
                          const ga4Users       = Math.round(sumGA4(ga4Rows,1))
                          const ga4Bounce      = ga4Rows.length ? (sumGA4(ga4Rows,2)/ga4Rows.length*100).toFixed(1)+'%' : '—'
                          const ga4New         = Math.round(sumGA4(ga4Rows,3))
                          const ga4PSessionsN  = Math.round(sumGA4(ga4PRows,0))
                          const ga4PUsers      = Math.round(sumGA4(ga4PRows,1))

                          const KPI = ({label,value,prev,prevVal,unit,icon:I,color}:any) => (
                            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                                <div style={{ width:32,height:32,borderRadius:9,background:color+'15',display:'flex',alignItems:'center',justifyContent:'center' }}>
                                  <I size={15} color={color}/>
                                </div>
                                <div style={{ fontSize:12,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.06em' }}>{label}</div>
                              </div>
                              <div style={{ fontSize:26,fontWeight:900,color:'#111',letterSpacing:'-.03em',lineHeight:1 }}>
                                {unit==='pct'?value:typeof value==='number'?value.toLocaleString():value}
                                <DeltaBadge curr={value} prev={prevVal}/>
                              </div>
                              {prev!==null && prevVal>0 && (
                                <div style={{ fontSize:12,color:'#9ca3af',marginTop:4 }}>
                                  vs {unit==='pct'?prev:typeof prevVal==='number'?prevVal.toLocaleString():prev} prev period
                                </div>
                              )}
                            </div>
                          )

                          // Table helper
                          const DataTable = ({title,cols,rows,maxRows=20}:any) => (
                            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:14 }}>
                              <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', fontSize:14, fontWeight:800, color:'#111' }}>{title}</div>
                              <div style={{ overflowX:'auto' }}>
                                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                  <thead>
                                    <tr style={{ background:'#f9fafb' }}>
                                      {cols.map((col:any,i:number)=>(
                                        <th key={i} style={{ padding:'10px 16px',fontSize:12,fontWeight:700,color:'#6b7280',textAlign:i===0?'left':'right',whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'.05em' }}>{col}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.slice(0,maxRows).map((row:any,i:number)=>(
                                      <tr key={i} style={{ borderTop:'1px solid #f9fafb' }}
                                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#fafafa'}
                                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=''}>
                                        {row.map((cell:any,j:number)=>(
                                          <td key={j} style={{ padding:'11px 16px',fontSize:13,color:j===0?'#111':'#374151',textAlign:j===0?'left':'right',fontWeight:j===0?700:400,whiteSpace:j===0?'nowrap':'normal',maxWidth:j===0?300:undefined,overflow:'hidden',textOverflow:'ellipsis' }}>
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )

                          // Build report content
                          if (d.report_type === 'overview') return (
                            <div>
                              {/* GSC KPIs */}
                              {gscRows.length > 0 && (
                                <>
                                  <div style={{ fontSize:12,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8 }}>Search Console</div>
                                  <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14 }}>
                                    <KPI label="Clicks"      value={gscClicks}  prevVal={gscPClicks} icon={MousePointer} color={RED}    prev={gscPClicks}/>
                                    <KPI label="Impressions" value={gscImpr}    prevVal={gscPImpr}   icon={Eye}          color="#4285F4" prev={gscPImpr}/>
                                    <KPI label="Avg CTR"     value={gscAvgCTR}  prevVal={null}       icon={Target}       color={TEAL}   prev={null}/>
                                    <KPI label="Avg Position"value={gscAvgPos}  prevVal={null}       icon={BarChart2}    color="#f59e0b" prev={null}/>
                                  </div>
                                </>
                              )}
                              {/* GA4 KPIs */}
                              {ga4Rows.length > 0 && (
                                <>
                                  <div style={{ fontSize:12,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8 }}>Google Analytics 4</div>
                                  <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14 }}>
                                    <KPI label="Sessions"    value={ga4Sessions}  prevVal={ga4PSessionsN}  icon={Users}       color={RED}    prev={ga4PSessionsN}/>
                                    <KPI label="Users"       value={ga4Users}     prevVal={ga4PUsers}      icon={User2}       color="#4285F4" prev={ga4PUsers}/>
                                    <KPI label="New Users"   value={ga4New}       prevVal={null}           icon={Zap}         color={TEAL}   prev={null}/>
                                    <KPI label="Bounce Rate" value={ga4Bounce}    prevVal={null}           icon={AlertCircle} color="#f59e0b" prev={null}/>
                                  </div>
                                </>
                              )}
                              {/* Channel table */}
                              {ga4Rows.length > 0 && (
                                <DataTable title="Traffic by Channel"
                                  cols={['Channel','Sessions','Users','Bounce Rate']}
                                  rows={ga4Rows.map((r:any)=>[
                                    r.dimensionValues?.[0]?.value||'—',
                                    parseInt(r.metricValues?.[0]?.value||0).toLocaleString(),
                                    parseInt(r.metricValues?.[1]?.value||0).toLocaleString(),
                                    (parseFloat(r.metricValues?.[2]?.value||0)*100).toFixed(1)+'%',
                                  ])}/>
                              )}
                              {/* Top keywords */}
                              {gscRows.length > 0 && (
                                <DataTable title="Top Keywords (Search Console)"
                                  cols={['Keyword','Clicks','Impressions','CTR','Position']}
                                  rows={[...gscRows].sort((a:any,b:any)=>b.clicks-a.clicks).slice(0,15).map((r:any)=>[
                                    r.keys?.[0]||'—',
                                    r.clicks.toLocaleString(),
                                    r.impressions.toLocaleString(),
                                    (r.ctr*100).toFixed(1)+'%',
                                    r.position.toFixed(1),
                                  ])}/>
                              )}
                            </div>
                          )

                          if (d.report_type === 'keywords') {
                            const prevMap: Record<string,any> = {}
                            gscPRows.forEach((r:any)=>{ prevMap[r.keys?.[0]||'']=r })
                            return (
                              <DataTable title={`Keywords — ${gscRows.length} total`}
                                cols={['Keyword','Clicks',compare!=='none'?'vs Prev':'','Impressions','CTR','Position',compare!=='none'?'vs Prev':'']}
                                maxRows={100}
                                rows={[...gscRows].sort((a:any,b:any)=>b.clicks-a.clicks).map((r:any)=>{
                                  const p = prevMap[r.keys?.[0]||'']
                                  const dc = p ? delta(r.clicks,p.clicks) : null
                                  const dp = p ? delta(r.position,p.position) : null
                                  return [
                                    r.keys?.[0]||'—',
                                    r.clicks.toLocaleString(),
                                    dc!==null?`${dc>=0?'+':''}${dc}%`:'—',
                                    r.impressions.toLocaleString(),
                                    (r.ctr*100).toFixed(1)+'%',
                                    r.position.toFixed(1),
                                    dp!==null?`${dp<=0?'↑':'↓'}${Math.abs(dp)}%`:'—',
                                  ]
                                })}/>
                            )
                          }

                          if (d.report_type === 'pages') {
                            const ga4PageMap: Record<string,any> = {}
                            ga4Rows.forEach((r:any)=>{ ga4PageMap[r.dimensionValues?.[0]?.value||'']=r })
                            const rows = gscRows.length ? gscRows : ga4Rows
                            return (
                              <DataTable title={`Pages — ${rows.length} total`}
                                cols={gscRows.length?['Page','GSC Clicks','Impressions','CTR','Position','GA4 Views']:['Page','Views','Sessions','Bounce']}
                                maxRows={50}
                                rows={gscRows.length
                                  ? [...gscRows].sort((a:any,b:any)=>b.clicks-a.clicks).map((r:any)=>{
                                      const pg = r.keys?.[0]||''
                                      const ga = ga4PageMap[pg]
                                      return [
                                        pg.length>60?'…'+pg.slice(-57):pg,
                                        r.clicks.toLocaleString(),
                                        r.impressions.toLocaleString(),
                                        (r.ctr*100).toFixed(1)+'%',
                                        r.position.toFixed(1),
                                        ga?parseInt(ga.metricValues?.[0]?.value||0).toLocaleString():'—',
                                      ]
                                    })
                                  : ga4Rows.map((r:any)=>[
                                      (r.dimensionValues?.[0]?.value||'').length>60?'…'+(r.dimensionValues?.[0]?.value||'').slice(-57):r.dimensionValues?.[0]?.value||'—',
                                      parseInt(r.metricValues?.[0]?.value||0).toLocaleString(),
                                      parseInt(r.metricValues?.[1]?.value||0).toLocaleString(),
                                      (parseFloat(r.metricValues?.[2]?.value||0)*100).toFixed(1)+'%',
                                    ])}/>
                            )
                          }

                          if (d.report_type === 'channels') {
                            const prevMap: Record<string,any> = {}
                            ga4PRows.forEach((r:any)=>{ prevMap[r.dimensionValues?.[0]?.value||'']=r })
                            return (
                              <DataTable title="Traffic Channels"
                                cols={['Channel','Sessions',compare!=='none'?'vs Prev':'','Users','New Users','Bounce','Conversions']}
                                rows={ga4Rows.map((r:any)=>{
                                  const ch = r.dimensionValues?.[0]?.value||'—'
                                  const p  = prevMap[ch]
                                  const dc = p ? delta(parseInt(r.metricValues?.[0]?.value||0),parseInt(p.metricValues?.[0]?.value||0)) : null
                                  return [
                                    ch,
                                    parseInt(r.metricValues?.[0]?.value||0).toLocaleString(),
                                    dc!==null?`${dc>=0?'+':''}${dc}%`:'—',
                                    parseInt(r.metricValues?.[1]?.value||0).toLocaleString(),
                                    parseInt(r.metricValues?.[3]?.value||0).toLocaleString(),
                                    (parseFloat(r.metricValues?.[2]?.value||0)*100).toFixed(1)+'%',
                                    parseInt(r.metricValues?.[4]?.value||0).toLocaleString(),
                                  ]
                                })}/>
                            )
                          }

                          if (d.report_type === 'devices') {
                            const ga4DevMap: Record<string,any> = {}
                            ga4Rows.forEach((r:any)=>{ ga4DevMap[r.dimensionValues?.[0]?.value?.toLowerCase()||'']=r })
                            return (
                              <DataTable title="Device Breakdown"
                                cols={['Device','GSC Clicks','GSC Impressions','GA4 Sessions','GA4 Users','Bounce']}
                                rows={(gscRows.length?gscRows:ga4Rows).map((r:any)=>{
                                  const dev = (r.keys?.[0]||r.dimensionValues?.[0]?.value||'').toLowerCase()
                                  const ga  = ga4DevMap[dev]
                                  return gscRows.length ? [
                                    dev.charAt(0).toUpperCase()+dev.slice(1),
                                    r.clicks.toLocaleString(),
                                    r.impressions.toLocaleString(),
                                    ga?parseInt(ga.metricValues?.[0]?.value||0).toLocaleString():'—',
                                    ga?parseInt(ga.metricValues?.[1]?.value||0).toLocaleString():'—',
                                    ga?(parseFloat(ga.metricValues?.[2]?.value||0)*100).toFixed(1)+'%':'—',
                                  ] : [
                                    dev.charAt(0).toUpperCase()+dev.slice(1),
                                    '—','—',
                                    parseInt(r.metricValues?.[0]?.value||0).toLocaleString(),
                                    parseInt(r.metricValues?.[1]?.value||0).toLocaleString(),
                                    (parseFloat(r.metricValues?.[2]?.value||0)*100).toFixed(1)+'%',
                                  ]
                                })}/>
                            )
                          }

                          if (d.report_type === 'countries') return (
                            <DataTable title="Countries"
                              cols={['Country','GSC Clicks','Impressions','GA4 Sessions','GA4 Users']}
                              maxRows={50}
                              rows={gscRows.length
                                ? gscRows.map((r:any)=>{
                                    const ga4Country = ga4Rows.find((a:any)=>a.dimensionValues?.[0]?.value?.toLowerCase()===r.keys?.[0]?.toLowerCase())
                                    return [
                                      r.keys?.[0]||'—',
                                      r.clicks.toLocaleString(),
                                      r.impressions.toLocaleString(),
                                      ga4Country?parseInt(ga4Country.metricValues?.[0]?.value||0).toLocaleString():'—',
                                      ga4Country?parseInt(ga4Country.metricValues?.[1]?.value||0).toLocaleString():'—',
                                    ]
                                  })
                                : ga4Rows.map((r:any)=>[
                                    r.dimensionValues?.[0]?.value||'—','—','—',
                                    parseInt(r.metricValues?.[0]?.value||0).toLocaleString(),
                                    parseInt(r.metricValues?.[1]?.value||0).toLocaleString(),
                                  ])}/>
                          )

                          if (d.report_type === 'daily_trend') {
                            // Build day-by-day table with both GSC and GA4
                            const gscDayMap: Record<string,any> = {}
                            gscRows.forEach((r:any)=>{ gscDayMap[r.keys?.[0]||'']=r })
                            const gscPDayMap: Record<string,any> = {}
                            gscPRows.forEach((r:any)=>{ gscPDayMap[r.keys?.[0]||'']=r })
                            const ga4DayMap: Record<string,any> = {}
                            ga4Rows.forEach((r:any)=>{ ga4DayMap[r.dimensionValues?.[0]?.value||'']=r })
                            // Merge all dates
                            const allDates = [...new Set([...Object.keys(gscDayMap),...Object.keys(ga4DayMap)])].sort().reverse()
                            return (
                              <DataTable title={`Daily Trend — ${allDates.length} days`}
                                cols={['Date','Clicks','Impressions','CTR','Sessions','Users']}
                                maxRows={allDates.length}
                                rows={allDates.map(date=>{
                                  const g = gscDayMap[date]
                                  const a = ga4DayMap[date?.replace(/-/g,'')]
                                  return [
                                    new Date(date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
                                    g?g.clicks.toLocaleString():'—',
                                    g?g.impressions.toLocaleString():'—',
                                    g?(g.ctr*100).toFixed(1)+'%':'—',
                                    a?parseInt(a.metricValues?.[0]?.value||0).toLocaleString():'—',
                                    a?parseInt(a.metricValues?.[1]?.value||0).toLocaleString():'—',
                                  ]
                                })}/>
                            )
                          }

                          return <div style={{color:'#9ca3af',padding:20}}>No data available for this report.</div>
                        })()}

                        {/* ── Saved AI Reports ── */}
                        {reports.length > 0 && (
                          <div style={{ marginTop:20 }}>
                            <div style={{ fontSize:14, fontWeight:800, color:'#374151', marginBottom:10 }}>Saved AI Reports</div>
                            {reports.map(r=>(
                              <div key={r.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', marginBottom:10, overflow:'hidden' }}>
                                <div style={{ padding:'12px 18px', borderBottom:r.content?.opportunities?.length?'1px solid #f3f4f6':'none', display:'flex', alignItems:'center', gap:12 }}>
                                  <div style={{ width:34,height:34,borderRadius:9,background:RED+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                                    <FileText size={15} color={RED}/>
                                  </div>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:14,fontWeight:700,color:'#111' }}>{r.report_type==='ai_analysis'?'AI SEO Analysis':'SEO Report'}</div>
                                    <div style={{ fontSize:12,color:'#9ca3af' }}>{new Date(r.generated_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}{r.content?.gsc_site?` · ${r.content.gsc_site.replace('sc-domain:','').replace('https://','').slice(0,30)}`:''}</div>
                                  </div>
                                  {r.score!=null&&<div style={{ width:44,height:44,borderRadius:11,background:r.score>=70?'#f0fdf4':r.score>=40?'#fffbeb':'#fef2f2',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                                    <div style={{ fontSize:18,fontWeight:900,color:r.score>=70?'#16a34a':r.score>=40?'#d97706':RED,lineHeight:1 }}>{r.score}</div>
                                    <div style={{ fontSize:9,fontWeight:700,color:r.score>=70?'#16a34a':r.score>=40?'#d97706':RED }}>/100</div>
                                  </div>}
                                </div>
                                {r.summary&&<div style={{ padding:'10px 18px',fontSize:13,color:'#374151',lineHeight:1.65 }}>{r.summary}</div>}
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    )}


