"use client"
import { useState, useEffect } from 'react'
import {
  Globe, CheckCircle, XCircle, AlertTriangle, Sparkles,
  Loader2, ChevronDown, ChevronUp, ExternalLink, Zap,
  FileText, Link2, Image, Code2, Smartphone, BarChart2,
  Target, TrendingUp, Search, Clock, Shield
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import ClientSearchSelect from '../../components/ClientSearchSelect'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClient } from '../../context/ClientContext'
import toast from 'react-hot-toast'

import { R as RED, T as TEAL, BLK, GRN as GREEN, AMB as AMBER, FH, FB } from '../../lib/theme'

const CATEGORY_META = {
  'on-page':     { label:'On-Page SEO',  icon:FileText,   color:'#8b5cf6' },
  'content':     { label:'Content',       icon:FileText,   color:TEAL },
  'technical':   { label:'Technical SEO', icon:Code2,      color:'#3b82f6' },
  'links':       { label:'Links',          icon:Link2,      color:'#f59e0b' },
  'performance': { label:'Performance',   icon:Zap,        color:GREEN },
}

const SEV_CONFIG = {
  critical: { bg:'#fef2f2', color:RED,    border:'#fecaca', label:'Critical' },
  warning:  { bg:'#fffbeb', color:AMBER,  border:'#fde68a', label:'Warning'  },
  info:     { bg:'#f0f9ff', color:'#0284c7', border:'#bae6fd', label:'Info'  },
}

function ScoreRing({ score, size=120 }) {
  const color = score >= 80 ? GREEN : score >= 60 ? AMBER : RED
  const r = (size/2) - 10, circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const fs = size > 100 ? 32 : 22
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={10}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset .7s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily:FH, fontSize:fs, fontWeight:900, color, lineHeight:1 }}>{score}</div>
        <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>/100</div>
      </div>
    </div>
  )
}

function SpeedBar({ label, value, max=100, color=TEAL }) {
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontSize:12, color:'#6b7280', fontFamily:FH }}>{label}</span>
        <span style={{ fontSize:12, fontWeight:700, color, fontFamily:FH }}>{value}/100</span>
      </div>
      <div style={{ height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${value}%`, background:color, borderRadius:3, transition:'width .5s ease' }}/>
      </div>
    </div>
  )
}

function CheckItem({ item, pass }) {
  const [open, setOpen] = useState(false)
  const sev = SEV_CONFIG[item.severity] || SEV_CONFIG.info
  return (
    <div style={{ borderBottom:'1px solid #f3f4f6' }}>
      <div onClick={()=>setOpen(!open)}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', cursor:'pointer', background:open?'#fafafa':'transparent', transition:'background .1s' }}
        onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
        onMouseLeave={e=>e.currentTarget.style.background=open?'#fafafa':'transparent'}>
        <div style={{ flexShrink:0 }}>
          {pass
            ? <CheckCircle size={16} color={GREEN}/>
            : item.severity === 'critical'
              ? <XCircle size={16} color={RED}/>
              : <AlertTriangle size={16} color={AMBER}/>
          }
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color:BLK, fontFamily:FH }}>{item.label}</div>
          <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.detail}</div>
        </div>
        {!pass && (
          <span style={{ fontSize:12, fontWeight:700, padding:'2px 7px', borderRadius:20, background:sev.bg, color:sev.color, border:`1px solid ${sev.border}`, flexShrink:0, fontFamily:FH }}>
            {sev.label}
          </span>
        )}
        {open ? <ChevronUp size={14} color="#9ca3af"/> : <ChevronDown size={14} color="#9ca3af"/>}
      </div>
      {open && (
        <div style={{ padding:'0 16px 12px 42px' }}>
          <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.6, marginBottom: !pass ? 8 : 0 }}>{item.detail}</div>
          {!pass && item.fix && (
            <div style={{ padding:'8px 12px', background:'#f0fdf4', borderRadius:8, border:'1px solid #bbf7d0' }}>
              <span style={{ fontSize:12, fontWeight:700, color:GREEN, fontFamily:FH }}>Fix: </span>
              <span style={{ fontSize:13, color:'#15803d', fontFamily:FB }}>{item.fix}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function OnPageAuditPage() {
  const { agencyId } = useAuth()
  const { selectedClient } = useClient()
  const [clients,    setClients]    = useState([])
  const [clientId,   setClientId]   = useState('')
  const [url,        setUrl]        = useState('')
  const [location,   setLocation]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [step,       setStep]       = useState('')
  const [result,     setResult]     = useState(null)
  const [history,    setHistory]    = useState([])
  const [activeTab,  setActiveTab]  = useState('all')

  useEffect(() => { loadClients() }, [agencyId])
  useEffect(() => {
    if (selectedClient) {
      setClientId(selectedClient.id)
      if (selectedClient.website) setUrl(selectedClient.website)
      if (selectedClient.city)    setLocation(selectedClient.city + (selectedClient.state ? ', ' + selectedClient.state : ''))
    }
  }, [selectedClient])
  useEffect(() => { if (clientId) loadHistory() }, [clientId])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,website,city,state,sic_code,industry').eq('agency_id', agencyId).is('deleted_at', null).order('name')
    setClients(data || [])
  }

  async function loadHistory() {
    const { data } = await supabase.from('seo_page_audits').select('id,url,score,audited_at').eq('client_id', clientId).order('audited_at',{ascending:false}).limit(5)
    setHistory(data || [])
  }

  async function runAudit() {
    if (!url.trim()) { toast.error('Enter a URL to audit'); return }
    setLoading(true); setResult(null)
    const steps = ['Fetching page content…','Running PageSpeed analysis…','Running AI audit…','Building report…']
    let si = 0
    const interval = setInterval(() => { si++; if(si<steps.length) setStep(steps[si]) }, 4000)
    setStep(steps[0])
    try {
      const client = clients.find(c => c.id === clientId)
      const res = await fetch('/api/seo/onpage-audit', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          url: url.trim(),
          client_id: clientId || null,
          agency_id: agencyId,
          business_name: client?.name || '',
          location: location || (client?.city ? client.city + (client.state?', '+client.state:'') : ''),
          sic_code: client?.sic_code || '',
        }),
      })
      const data = await res.json()
      clearInterval(interval)
      if (data.error) throw new Error(data.error)
      setResult(data)
      toast.success(`Audit complete — Score: ${data.score}/100`)
      if (clientId) loadHistory()
    } catch(e) { clearInterval(interval); toast.error('Audit failed: ' + e.message) }
    setLoading(false); setStep('')
  }

  const categories = result ? [...new Set(result.fails.map(f=>f.category))] : []
  const allFails = result?.fails || []
  const filtered = activeTab === 'all' ? allFails : allFails.filter(f => f.category === activeTab)
  const critical = allFails.filter(f => f.severity === 'critical')
  const scoreColor = result ? (result.score>=80?GREEN:result.score>=60?AMBER:RED) : RED

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#F9F9F9' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'20px 32px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:14 }}>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:20, fontWeight:800, color: '#111', margin: 0, letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:10 }}>
                <Globe size={20} color={TEAL}/> On-Page SEO Checker
              </h1>
              <p style={{ fontSize:14, color:'#6b7280', margin:'3px 0 0', fontFamily:FB }}>
                20+ technical checks · PageSpeed · AI recommendations
              </p>
            </div>
            <ClientSearchSelect
              value={clientId}
              onChange={(id, cl) => {
                setClientId(id)
                setUrl(cl.website)
              }}
            />
          </div>
          {history.length > 0 && (
            <div style={{ display:'flex', gap:8, paddingBottom:12, overflowX:'auto' }}>
              {history.map(h=>(
                <button key={h.id} onClick={()=>setUrl(h.url)}
                  style={{ padding:'4px 12px', borderRadius:20, background:'#f3f4f6', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:6, flexShrink:0, cursor:'pointer' }}>
                  <span style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:h.score>=80?'#4ade80':h.score>=60?'#fbbf24':'#f87171' }}>{h.score}</span>
                  <span style={{ fontSize:12, color:'#6b7280', fontFamily:FB, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.url.replace(/https?:\/\//,'')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>

          {/* Input bar */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:20 }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <div style={{ flex:2 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>URL to Audit</label>
                <input value={url} onChange={e=>setUrl(e.target.value)}
                  placeholder="https://example.com or https://example.com/services"
                  onKeyDown={e=>e.key==='Enter'&&runAudit()}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:BLK, boxSizing:'border-box' }}
                  onFocus={e=>e.target.style.borderColor=TEAL} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:5 }}>Location (optional)</label>
                <input value={location} onChange={e=>setLocation(e.target.value)}
                  placeholder="e.g. Boca Raton, FL"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', color:BLK, boxSizing:'border-box' }}
                  onFocus={e=>e.target.style.borderColor=TEAL} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>
              <button onClick={runAudit} disabled={loading||!url.trim()}
                style={{ padding:'9px 24px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap', boxShadow:`0 3px 12px ${RED}40` }}>
                {loading ? <Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/> : <Search size={15}/>}
                {loading ? step || 'Auditing…' : 'Run Audit'}
              </button>
            </div>
          </div>

          {result && (
            <div>
              {/* Score row */}
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:16, marginBottom:16 }}>

                {/* Score + meta */}
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 24px', display:'flex', alignItems:'center', gap:20 }}>
                  <ScoreRing score={result.score}/>
                  <div>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:2 }}>SEO Score</div>
                    <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, marginBottom:10 }}>
                      {result.passes?.length}/{result.total_checks} checks passing
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      {[
                        { label:'Critical', count: result.fails.filter(f=>f.severity==='critical').length, color:RED },
                        { label:'Warnings', count: result.fails.filter(f=>f.severity==='warning').length,  color:AMBER },
                        { label:'Info',     count: result.fails.filter(f=>f.severity==='info').length,     color:'#0284c7' },
                      ].map((s,i)=>(
                        <div key={i} style={{ textAlign:'center' }}>
                          <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:s.color }}>{s.count}</div>
                          <div style={{ fontSize:12, color:'#6b7280', fontFamily:FH }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI summary */}
                {result.ai && (
                  <div style={{ background:`linear-gradient(135deg, ${BLK} 0%, #1a1a2e 100%)`, borderRadius:16, padding:'18px 22px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                      <Sparkles size={14} color={TEAL}/>
                      <span style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.07em' }}>AI Assessment</span>
                    </div>
                    <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB, lineHeight:1.7, marginBottom:10 }}>{result.ai.executive_summary}</div>
                    {result.ai.biggest_issue && (
                      <div style={{ background:'rgba(234,39,41,.15)', borderRadius:9, padding:'8px 12px', border:`1px solid ${RED}30` }}>
                        <span style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:RED }}>Top Priority: </span>
                        <span style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{result.ai.biggest_issue}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* PageSpeed scores */}
                {result.speed && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'18px 20px', minWidth:200 }}>
                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK, marginBottom:12 }}>PageSpeed (Mobile)</div>
                    <SpeedBar label="Performance" value={result.speed.performance} color={result.speed.performance>=80?GREEN:result.speed.performance>=50?AMBER:RED}/>
                    <SpeedBar label="SEO"         value={result.speed.seo}         color={result.speed.seo>=90?GREEN:AMBER}/>
                    <SpeedBar label="Accessibility" value={result.speed.accessibility} color={TEAL}/>
                    <SpeedBar label="Best Practices" value={result.speed.bestPractices} color='#8b5cf6'/>
                    {result.speed.lcp && (
                      <div style={{ marginTop:10, fontSize:12, color:'#6b7280', fontFamily:FB }}>
                        LCP: {result.speed.lcp} · CLS: {result.speed.cls}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Page meta summary */}
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'14px 20px', marginBottom:16, display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12 }}>
                {[
                  { label:'Title', value: result.page_data.title ? `${result.page_data.title_len} chars` : 'Missing', good: result.page_data.title_len >= 30 && result.page_data.title_len <= 60 },
                  { label:'Meta Desc', value: result.page_data.meta_desc ? `${result.page_data.meta_desc_len} chars` : 'Missing', good: result.page_data.meta_desc_len >= 120 && result.page_data.meta_desc_len <= 158 },
                  { label:'H1 Tags', value: `${result.page_data.h1s?.length || 0}`, good: result.page_data.h1s?.length === 1 },
                  { label:'Word Count', value: result.page_data.word_count?.toLocaleString(), good: result.page_data.word_count >= 300 },
                  { label:'Images', value: `${result.page_data.imgs_no_alt} missing alt`, good: result.page_data.imgs_no_alt === 0 },
                  { label:'Schema', value: result.page_data.has_schema ? 'Present' : 'Missing', good: result.page_data.has_schema },
                ].map((m,i)=>(
                  <div key={i} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:12, color:'#6b7280', fontFamily:FH, marginBottom:3 }}>{m.label}</div>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color: m.good?GREEN:RED }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:16 }}>

                {/* Checks panel */}
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  {/* Category tabs */}
                  <div style={{ display:'flex', borderBottom:'1px solid #f3f4f6', overflowX:'auto' }}>
                    {[{key:'all',label:`All Issues (${allFails.length})`,color:'#374151'},
                      ...Object.entries(CATEGORY_META).map(([k,v])=>({key:k,label:`${v.label} (${allFails.filter(f=>f.category===k).length})`,color:v.color}))
                    ].map(tab=>(
                      <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
                        style={{ padding:'11px 16px', border:'none', background:activeTab===tab.key?'#fff':'transparent',
                          borderBottom:activeTab===tab.key?`2px solid ${tab.color}`:'2px solid transparent',
                          color:activeTab===tab.key?tab.color:'#6b7280', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, whiteSpace:'nowrap' }}>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Failing checks */}
                  {filtered.length > 0 ? (
                    <div>
                      {filtered.map((item,i) => <CheckItem key={i} item={item} pass={false}/>)}
                    </div>
                  ) : (
                    <div style={{ padding:'32px', textAlign:'center', color:'#6b7280', fontSize:14, fontFamily:FB }}>
                      ✅ No issues in this category
                    </div>
                  )}

                  {/* Passing checks */}
                  {activeTab === 'all' && result.passes?.length > 0 && (
                    <div style={{ borderTop:'2px solid #f0fdf4' }}>
                      <div style={{ padding:'10px 16px', fontSize:12, fontWeight:700, color:GREEN, fontFamily:FH, textTransform:'uppercase', letterSpacing:'.07em' }}>
                        ✓ Passing ({result.passes.length})
                      </div>
                      {result.passes.map((item,i) => <CheckItem key={i} item={item} pass={true}/>)}
                    </div>
                  )}
                </div>

                {/* Right column: AI tips */}
                {result.ai && (
                  <div style={{ width:280, display:'flex', flexDirection:'column', gap:12 }}>
                    {result.ai.keyword_gaps?.length > 0 && (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
                          <Search size={14} color={RED}/>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK }}>Keyword Gaps</div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {result.ai.keyword_gaps.map((kw,i)=>(
                            <div key={i} style={{ fontSize:13, padding:'6px 10px', background:'#f9fafb', borderRadius:8, color:'#374151', fontFamily:FB }}>{kw}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.ai.local_seo_tips?.length > 0 && (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
                          <Target size={14} color={TEAL}/>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK }}>Local SEO Tips</div>
                        </div>
                        {result.ai.local_seo_tips.map((tip,i)=>(
                          <div key={i} style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.6, marginBottom:8, display:'flex', gap:8 }}>
                            <span style={{ color:TEAL, fontWeight:700, flexShrink:0 }}>→</span> {tip}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.ai.title_suggestion && result.ai.title_suggestion !== result.page_data.title && (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
                        <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Suggested Title</div>
                        <div style={{ fontSize:13, color:BLK, fontFamily:FB, fontStyle:'italic', lineHeight:1.5 }}>"{result.ai.title_suggestion}"</div>
                      </div>
                    )}
                    {result.ai.meta_suggestion && (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
                        <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Suggested Meta</div>
                        <div style={{ fontSize:13, color:BLK, fontFamily:FB, fontStyle:'italic', lineHeight:1.5 }}>"{result.ai.meta_suggestion}"</div>
                      </div>
                    )}
                    {result.ai.estimated_traffic_impact && (
                      <div style={{ background:`${TEAL}12`, borderRadius:14, border:`1px solid ${TEAL}30`, padding:'16px 18px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                          <TrendingUp size={14} color={TEAL}/>
                          <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:TEAL }}>Traffic Impact</div>
                        </div>
                        <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.6 }}>{result.ai.estimated_traffic_impact}</div>
                      </div>
                    )}
                    {result.ai.schema_recommendation && (
                      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                          <Code2 size={14} color={"#8b5cf6"}/>
                          <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#8b5cf6' }}>Schema Markup</div>
                        </div>
                        <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.6 }}>{result.ai.schema_recommendation}</div>
                      </div>
                    )}
                    <a href={result.url} target="_blank" rel="noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:13, fontWeight:700, fontFamily:FH, textDecoration:'none', justifyContent:'center' }}>
                      <ExternalLink size={13}/> View Page
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {!result && !loading && (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'64px 24px', textAlign:'center' }}>
              <Globe size={44} color="#e5e7eb" style={{ margin:'0 auto 16px', display:'block' }}/>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, marginBottom:8 }}>On-Page SEO Checker</div>
              <div style={{ fontSize:15, color:'#6b7280', fontFamily:FB, maxWidth:500, margin:'0 auto 28px', lineHeight:1.7 }}>
                Enter any URL to get a full technical SEO audit: 20+ checks, live PageSpeed scores, and AI recommendations tailored for local businesses.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, maxWidth:700, margin:'0 auto' }}>
                {Object.entries(CATEGORY_META).map(([k,v])=>(
                  <div key={k} style={{ padding:'16px 12px', background:'#f9fafb', borderRadius:12, border:'1px solid #f3f4f6' }}>
                    <v.icon size={20} color={v.color} style={{ margin:'0 auto 6px', display:'block' }}/>
                    <div style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK }}>{v.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
