"use client"
import { useState, useEffect } from 'react'
import { Search, TrendingUp, Target, Sparkles, Loader2, ChevronDown, ChevronUp, Calendar, BookOpen, MapPin, Zap, BarChart2, ArrowRight, ExternalLink, RefreshCw } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const PRIORITY_CFG = {
  high:   { bg:'#fef2f2', color:RED,    border:'#fecaca', dot:RED },
  medium: { bg:'#fffbeb', color:AMBER,  border:'#fde68a', dot:AMBER },
  low:    { bg:'#f0f9ff', color:'#0284c7', border:'#bae6fd', dot:'#0284c7' },
}

const DIFFICULTY_CFG = {
  easy:   { color:GREEN,  label:'Easy' },
  medium: { color:AMBER,  label:'Medium' },
  hard:   { color:RED,    label:'Hard' },
}

const INTENT_CFG = {
  transactional:  { color:RED,    label:'Transactional',  icon:'💳' },
  commercial:     { color:AMBER,  label:'Commercial',     icon:'🛒' },
  informational:  { color:TEAL,   label:'Informational',  icon:'📖' },
  navigational:   { color:'#8b5cf6', label:'Navigational', icon:'🧭' },
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.low
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, fontFamily:FH }}>
      {priority?.charAt(0).toUpperCase() + priority?.slice(1)}
    </span>
  )
}

function KeywordCard({ kw, index }) {
  const [open, setOpen] = useState(false)
  const diff = DIFFICULTY_CFG[kw.difficulty] || DIFFICULTY_CFG.medium
  const intent = INTENT_CFG[kw.intent] || INTENT_CFG.informational
  const pri  = PRIORITY_CFG[kw.priority] || PRIORITY_CFG.low

  return (
    <div style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${open ? pri.color : '#e5e7eb'}`, overflow:'hidden', transition:'border-color .15s' }}>
      <div onClick={()=>setOpen(!open)}
        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer' }}
        onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <div style={{ width:28, height:28, borderRadius:8, background:pri.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:FH, fontSize:13, fontWeight:900, color:pri.color }}>
          {index + 1}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK, marginBottom:2 }}>{kw.keyword}</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:intent.color, fontFamily:FH }}>
              {intent.icon} {intent.label}
            </span>
            <span style={{ fontSize:11, color:'#9ca3af' }}>·</span>
            <span style={{ fontSize:11, color:diff.color, fontWeight:700, fontFamily:FH }}>{diff.label}</span>
            {kw.monthly_volume_estimate && (
              <>
                <span style={{ fontSize:11, color:'#9ca3af' }}>·</span>
                <span style={{ fontSize:11, color:'#6b7280', fontFamily:FB }}>~{kw.monthly_volume_estimate} searches/mo</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <PriorityBadge priority={kw.priority}/>
          <span style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, maxWidth:100, textAlign:'right' }}>{kw.content_type}</span>
          {open ? <ChevronUp size={14} color="#9ca3af"/> : <ChevronDown size={14} color="#9ca3af"/>}
        </div>
      </div>
      {open && (
        <div style={{ borderTop:'1px solid #f3f4f6', padding:'14px 16px', background:'#fafafa' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:4 }}>Current Rank</div>
              <div style={{ fontSize:14, fontWeight:700, color: kw.current_rank === 'Not ranking' ? RED : GREEN, fontFamily:FH }}>{kw.current_rank || 'Not ranking'}</div>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH, marginBottom:4 }}>Content Type</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#374151', fontFamily:FH }}>{kw.content_type}</div>
            </div>
          </div>
          <div style={{ padding:'10px 14px', background:'#f0fdf4', borderRadius:9, border:'1px solid #bbf7d0' }}>
            <div style={{ fontSize:11, fontWeight:700, color:GREEN, fontFamily:FH, marginBottom:4 }}>Action to Rank:</div>
            <div style={{ fontSize:13, color:'#15803d', fontFamily:FB, lineHeight:1.6 }}>{kw.action}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function KeywordGapPage() {
  const { agencyId } = useAuth()
  const { selectedClient } = useClient()
  const [clients,    setClients]    = useState([])
  const [clientId,   setClientId]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [step,       setStep]       = useState('')
  const [result,     setResult]     = useState(null)
  const [activeTab,  setActiveTab]  = useState('gaps')
  const [filterPri,  setFilterPri]  = useState('all')
  const [history,    setHistory]    = useState([])

  useEffect(()=>{ loadClients() }, [agencyId])
  useEffect(()=>{ if(selectedClient) setClientId(selectedClient.id) }, [selectedClient])
  useEffect(()=>{ if(clientId) loadHistory() }, [clientId])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,industry,city,state,website').order('name')
    setClients(data || [])
  }

  async function loadHistory() {
    const { data } = await supabase.from('seo_tracked_keywords')
      .select('keyword,opportunity').eq('client_id', clientId).limit(10)
    setHistory(data || [])
  }

  async function runAnalysis() {
    if (!clientId) { toast.error('Select a client first'); return }
    setLoading(true); setResult(null)
    const steps = ['Pulling GSC keyword data…','Analyzing keyword gaps…','Generating opportunities…','Building content calendar…']
    let si = 0
    const iv = setInterval(()=>{ si++; if(si<steps.length) setStep(steps[si]) }, 5000)
    setStep(steps[0])
    try {
      const res = await fetch('/api/seo/keyword-gap', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ client_id: clientId, agency_id: agencyId }),
      })
      const data = await res.json()
      clearInterval(iv)
      if (data.error) {
        const msg = data.error + (data.hint ? '\n\nHint: ' + data.hint : '') + (data.debug ? '\n\nKey status: ' + JSON.stringify(data.debug) : '')
        throw new Error(msg)
      }
      setResult(data)
      toast.success(`Found ${data.analysis?.gap_opportunities?.length || 0} keyword opportunities`)
    } catch(e) { clearInterval(iv); toast.error('Analysis failed: ' + e.message) }
    setLoading(false); setStep('')
  }

  const client = clients.find(c => c.id === clientId)
  const gaps = result?.analysis?.gap_opportunities || []
  const filtered = filterPri === 'all' ? gaps : gaps.filter(k => k.priority === filterPri)

  const TABS = [
    { key:'gaps',       label:`Opportunities (${gaps.length})`,                              icon:Target },
    { key:'quickwins',  label:`Quick Wins (${result?.analysis?.quick_wins?.length || 0})`,   icon:Zap },
    { key:'local',      label:`Local (${result?.analysis?.location_keywords?.length || 0})`, icon:MapPin },
    { key:'longtail',   label:`Long-Tail (${result?.analysis?.long_tail_opportunities?.length || 0})`, icon:Search },
    { key:'calendar',   label:'Content Calendar',                                             icon:Calendar },
    { key:'gsc',        label:`Your GSC Data (${result?.gsc_keyword_count || 0})`,           icon:BarChart2 },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'20px 32px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:14 }}>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:22, fontWeight:800, color:'#fff', margin:0, letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:10 }}>
                <Search size={20} color={TEAL}/> Keyword Gap Tool
              </h1>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'3px 0 0', fontFamily:FB }}>
                AI-powered keyword opportunities from your GSC data
              </p>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <select value={clientId} onChange={e=>setClientId(e.target.value)}
                style={{ padding:'9px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:14, fontFamily:FH, minWidth:200 }}>
                <option value="">Select client</option>
                {clients.map(c=><option key={c.id} value={c.id} style={{color:BLK,background:'#fff'}}>{c.name}</option>)}
              </select>
              <button onClick={runAnalysis} disabled={loading||!clientId}
                style={{ padding:'9px 20px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:7, boxShadow:`0 3px 12px ${RED}40` }}>
                {loading ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Sparkles size={14}/>}
                {loading ? step || 'Analyzing…' : result ? 'Re-analyze' : 'Analyze'}
              </button>
            </div>
          </div>
          {result && (
            <div style={{ display:'flex', gap:8, paddingBottom:0, overflowX:'auto' }}>
              {TABS.map(t=>(
                <button key={t.key} onClick={()=>setActiveTab(t.key)}
                  style={{ padding:'10px 16px', border:'none', background:'transparent',
                    borderBottom:activeTab===t.key?`2.5px solid ${RED}`:'2.5px solid transparent',
                    color:activeTab===t.key?'#fff':'rgba(255,255,255,.4)',
                    fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                  <t.icon size={12}/> {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>

          {!result && !loading && (
            <div>
              {history.length > 0 && (
                <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:16 }}>
                  <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, marginBottom:10 }}>Previously tracked keywords</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {history.map((k,i)=>(
                      <span key={i} style={{ fontSize:12, padding:'4px 10px', borderRadius:20, background:'#f3f4f6', color:'#374151', fontFamily:FB, border:'1px solid #e5e7eb' }}>
                        {k.keyword}
                        {k.opportunity && <span style={{ marginLeft:5, fontSize:10, color: k.opportunity==='high'?RED:k.opportunity==='medium'?AMBER:'#9ca3af', fontWeight:700 }}>●</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'64px 24px', textAlign:'center' }}>
                <Search size={44} color="#e5e7eb" style={{ margin:'0 auto 16px', display:'block' }}/>
                <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, marginBottom:8 }}>Keyword Gap Analysis</div>
                <div style={{ fontSize:15, color:'#6b7280', fontFamily:FB, maxWidth:520, margin:'0 auto 24px', lineHeight:1.7 }}>
                  Select a client and click Analyze. Koto pulls their real Google Search Console keyword data, then Claude identifies gaps, quick wins, local opportunities, and builds a content calendar.
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, maxWidth:600, margin:'0 auto' }}>
                  {[
                    { icon:'📊', label:'GSC Data',           desc:'Real rankings from Search Console' },
                    { icon:'🎯', label:'Gap Opportunities',   desc:'Keywords you should be ranking for' },
                    { icon:'📅', label:'Content Calendar',    desc:'3-month plan to close the gaps' },
                  ].map((item,i)=>(
                    <div key={i} style={{ padding:'16px', background:'#f9fafb', borderRadius:12, border:'1px solid #f3f4f6' }}>
                      <div style={{ fontSize:24, marginBottom:8 }}>{item.icon}</div>
                      <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, marginBottom:3 }}>{item.label}</div>
                      <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
                {!client && (
                  <div style={{ marginTop:20, fontSize:13, color:'#9ca3af', fontFamily:FB }}>
                    Select a client above to get started
                  </div>
                )}
                {client && (
                  <div style={{ marginTop:20, fontSize:13, color:TEAL, fontFamily:FB }}>
                    Ready to analyze <strong>{client.name}</strong>
                    {client.website && ` · ${client.website}`}
                  </div>
                )}
              </div>
            </div>
          )}

          {result && (
            <div>
              {/* Summary banner */}
              {result.analysis?.summary && (
                <div style={{ background:`linear-gradient(135deg, ${BLK} 0%, #1a1a2e 100%)`, borderRadius:16, padding:'18px 22px', marginBottom:16, display:'flex', gap:14, alignItems:'flex-start' }}>
                  <Sparkles size={18} color={TEAL} style={{ flexShrink:0, marginTop:2 }}/>
                  <div>
                    <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>AI Summary</div>
                    <div style={{ fontSize:14, color:'rgba(255,255,255,.85)', fontFamily:FB, lineHeight:1.7 }}>{result.analysis.summary}</div>
                  </div>
                </div>
              )}

              {/* GAPS TAB */}
              {activeTab === 'gaps' && (
                <div>
                  <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#374151' }}>Filter:</div>
                    {['all','high','medium','low'].map(p=>(
                      <button key={p} onClick={()=>setFilterPri(p)}
                        style={{ padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', fontFamily:FH, fontSize:12, fontWeight:700,
                          background: filterPri===p ? (p==='high'?RED:p==='medium'?AMBER:p==='low'?'#0284c7':'#111') : '#fff',
                          color: filterPri===p ? '#fff' : '#374151',
                          boxShadow: filterPri===p ? 'none' : '0 0 0 1px #e5e7eb' }}>
                        {p.charAt(0).toUpperCase()+p.slice(1)} {p!=='all'&&`(${gaps.filter(k=>k.priority===p).length})`}
                      </button>
                    ))}
                    <div style={{ marginLeft:'auto', fontSize:13, color:'#9ca3af', fontFamily:FB }}>{filtered.length} opportunities</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {filtered.map((kw,i) => <KeywordCard key={i} kw={kw} index={i}/>)}
                  </div>
                </div>
              )}

              {/* QUICK WINS TAB */}
              {activeTab === 'quickwins' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {(result.analysis?.quick_wins || []).map((qw, i) => (
                    <div key={i} style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${GREEN}40`, padding:'16px 18px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                        <div style={{ width:32, height:32, borderRadius:9, background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:FH, fontSize:14, fontWeight:900, color:GREEN }}>{i+1}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:BLK, marginBottom:4 }}>{qw.keyword}</div>
                          <div style={{ fontSize:13, color:'#374151', fontFamily:FB, marginBottom:8, lineHeight:1.6 }}>{qw.why}</div>
                          <div style={{ padding:'8px 12px', background:'#f0fdf4', borderRadius:8, border:'1px solid #bbf7d0' }}>
                            <span style={{ fontSize:12, fontWeight:700, color:GREEN, fontFamily:FH }}>Action: </span>
                            <span style={{ fontSize:13, color:'#15803d', fontFamily:FB }}>{qw.action}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* LOCAL TAB */}
              {activeTab === 'local' && (
                <div>
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px', marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                      <MapPin size={16} color={RED}/>
                      <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK }}>Location-Based Keywords</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {(result.analysis?.location_keywords || []).map((kw, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#f9fafb', borderRadius:10, border:'1px solid #e5e7eb' }}>
                          <MapPin size={14} color={RED} style={{ flexShrink:0 }}/>
                          <div style={{ fontFamily:FH, fontSize:14, fontWeight:600, color:BLK, flex:1 }}>{kw}</div>
                          <ArrowRight size={14} color="#9ca3af"/>
                        </div>
                      ))}
                    </div>
                  </div>
                  {result.analysis?.competitor_keywords?.length > 0 && (
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px' }}>
                      <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:14 }}>Competitor Keyword Targets</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {result.analysis.competitor_keywords.map((ck, i) => (
                          <div key={i} style={{ padding:'12px 14px', background:'#fef2f2', borderRadius:10, border:'1px solid #fecaca' }}>
                            <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:RED, marginBottom:3 }}>{ck.keyword}</div>
                            <div style={{ fontSize:13, color:'#374151', fontFamily:FB }}>{ck.why_important}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* LONG-TAIL TAB */}
              {activeTab === 'longtail' && (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px' }}>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:6 }}>Long-Tail Keyword Opportunities</div>
                  <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB, marginBottom:16 }}>Lower competition, higher buyer intent — easiest to rank for fast</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {(result.analysis?.long_tail_opportunities || []).map((kw, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', background:'#f0fbfc', borderRadius:10, border:`1px solid ${TEAL}30` }}>
                        <span style={{ fontSize:12, fontWeight:900, color:TEAL, fontFamily:FH, flexShrink:0 }}>#{i+1}</span>
                        <span style={{ fontFamily:FH, fontSize:13, fontWeight:600, color:BLK }}>{kw}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CALENDAR TAB */}
              {activeTab === 'calendar' && (
                <div>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:14 }}>3-Month Content Calendar</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {(result.analysis?.content_calendar || []).map((item, i) => (
                      <div key={i} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                        <div style={{ width:44, height:44, borderRadius:11, background: item.priority==='high'?RED+'15':TEAL+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:FH, fontSize:11, fontWeight:700, color:item.priority==='high'?RED:TEAL, textAlign:'center', lineHeight:1.3 }}>
                          Mo {item.month}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK, marginBottom:2 }}>{item.topic}</div>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <span style={{ fontSize:12, padding:'2px 8px', borderRadius:20, background:'#f3f4f6', color:'#6b7280', fontFamily:FH }}>{item.type}</span>
                            <span style={{ fontSize:12, color:TEAL, fontFamily:FH, fontWeight:600 }}>→ {item.keyword}</span>
                          </div>
                        </div>
                        <PriorityBadge priority={item.priority}/>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GSC DATA TAB */}
              {activeTab === 'gsc' && (
                <div>
                  {result.gsc_keyword_count === 0 ? (
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center' }}>
                      <BarChart2 size={36} color="#e5e7eb" style={{ margin:'0 auto 14px', display:'block' }}/>
                      <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK, marginBottom:8 }}>No GSC data connected</div>
                      <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB, marginBottom:16 }}>
                        Connect Google Search Console in the SEO Hub to see real keyword data. Analysis was done using AI knowledge of the industry.
                      </div>
                      <a href="/seo/connect" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10, border:'none', background:TEAL, color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none', fontFamily:FH }}>
                        Connect GSC → 
                      </a>
                    </div>
                  ) : (
                    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                      <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>
                          {result.gsc_keyword_count} keywords from GSC (last 90 days)
                        </div>
                        <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>Showing top 100</div>
                      </div>
                      <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                          <thead>
                            <tr style={{ background:'#f9fafb' }}>
                              {['Keyword','Position','Clicks','Impressions','CTR'].map((h,i)=>(
                                <th key={h} style={{ padding:'9px 14px', fontSize:11, fontWeight:700, color:'#6b7280', textAlign:i===0?'left':'right', textTransform:'uppercase', letterSpacing:'.05em', fontFamily:FH }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(result.gsc_keywords || []).map((kw, i) => (
                              <tr key={i} style={{ borderTop:'1px solid #f9fafb' }}>
                                <td style={{ padding:'9px 14px', fontSize:13, color:BLK, fontFamily:FH, fontWeight:600 }}>{kw.keyword}</td>
                                <td style={{ padding:'9px 14px', fontSize:13, textAlign:'right', fontFamily:FH, fontWeight:700,
                                  color: kw.position <= 3 ? GREEN : kw.position <= 10 ? AMBER : '#9ca3af' }}>
                                  #{kw.position}
                                </td>
                                <td style={{ padding:'9px 14px', fontSize:13, color:'#374151', textAlign:'right', fontFamily:FH }}>{kw.clicks?.toLocaleString()}</td>
                                <td style={{ padding:'9px 14px', fontSize:13, color:'#374151', textAlign:'right', fontFamily:FH }}>{kw.impressions?.toLocaleString()}</td>
                                <td style={{ padding:'9px 14px', fontSize:13, color:'#374151', textAlign:'right', fontFamily:FH }}>{((kw.ctr||0)*100).toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
