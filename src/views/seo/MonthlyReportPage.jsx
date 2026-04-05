"use client"
import { useState, useEffect } from 'react'
import { FileText, Sparkles, Download, Mail, RefreshCw, Loader2, Star, TrendingUp, Target, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Calendar, BarChart2, Send } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import ClientSearchSelect from '../../components/ClientSearchSelect'
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

function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        {Icon && <Icon size={14} color={color || '#9ca3af'}/>}
        <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:FH }}>{label}</div>
      </div>
      <div style={{ fontFamily:FH, fontSize:28, fontWeight:900, color:color||BLK, letterSpacing:'-.03em', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function WinCard({ win, idx }) {
  return (
    <div style={{ display:'flex', gap:12, padding:'12px 0', borderBottom:'1px solid #f3f4f6' }}>
      <div style={{ width:24, height:24, borderRadius:6, background:GREEN+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
        <CheckCircle size={13} color={GREEN}/>
      </div>
      <div>
        <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK, marginBottom:2 }}>{win.title}</div>
        <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, lineHeight:1.6 }}>{win.detail}</div>
      </div>
    </div>
  )
}

function ImprovementCard({ item }) {
  return (
    <div style={{ display:'flex', gap:12, padding:'12px 0', borderBottom:'1px solid #f3f4f6' }}>
      <div style={{ width:24, height:24, borderRadius:6, background:AMBER+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
        <AlertCircle size={13} color={AMBER}/>
      </div>
      <div>
        <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK, marginBottom:2 }}>{item.title}</div>
        <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, lineHeight:1.6 }}>{item.detail}</div>
      </div>
    </div>
  )
}

export default function MonthlyReportPage() {
  const { agencyId, agencyName } = useAuth()
  const { selectedClient } = useClient()
  const [clients,   setClients]   = useState([])
  const [clientId,  setClientId]  = useState('')
  const [month,     setMonth]     = useState(() => new Date().toISOString().slice(0, 7))
  const [loading,   setLoading]   = useState(false)
  const [step,      setStep]      = useState('')
  const [report,    setReport]    = useState(null)
  const [history,   setHistory]   = useState([])
  const [showRaw,   setShowRaw]   = useState(false)
  const [emailing,  setEmailing]  = useState(false)

  useEffect(() => { loadClients() }, [agencyId])
  useEffect(() => { if (selectedClient) setClientId(selectedClient.id) }, [selectedClient])
  useEffect(() => { if (clientId) loadHistory() }, [clientId])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,email,industry').order('name')
    setClients(data || [])
  }

  async function loadHistory() {
    const res = await fetch(`/api/seo/monthly-report?client_id=${clientId}`)
    const data = await res.json()
    setHistory(data.reports || [])
  }

  async function generateReport() {
    if (!clientId) { toast.error('Select a client first'); return }
    setLoading(true); setReport(null)
    const steps = ['Gathering review data…','Pulling SEO metrics…','Analyzing GBP performance…','Writing AI narrative…','Building report…']
    let si = 0
    const iv = setInterval(() => { si++; if (si < steps.length) setStep(steps[si]) }, 4000)
    setStep(steps[0])
    try {
      const res = await fetch('/api/seo/monthly-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, agency_id: agencyId, month, agency_name: agencyName || 'Koto' }),
      })
      const data = await res.json()
      clearInterval(iv)
      if (data.error) throw new Error(data.error)
      setReport(data)
      toast.success('Report generated')
      loadHistory()
    } catch (e) { clearInterval(iv); toast.error('Failed: ' + e.message) }
    setLoading(false); setStep('')
  }

  async function loadExisting(reportData) {
    setReport({ report_data: reportData.report_data, ai_narrative: reportData.ai_narrative, month: reportData.month })
  }

  async function copyReport() {
    if (!report?.ai_narrative) return
    const n = report.ai_narrative
    const nl = String.fromCharCode(10)
    const wins = (n.wins || []).map(w => '✓ ' + w.title + ': ' + w.detail).join(nl)
    const improvements = (n.areas_to_improve || []).map(a => '→ ' + a.title + ': ' + a.detail).join(nl)
    const focus = (n.next_month_focus || []).map((f, i) => (i+1) + '. ' + f).join(nl)
    const text = [n.subject_line, '', n.executive_summary, '', 'WINS THIS MONTH', wins, '', 'AREAS TO IMPROVE', improvements, '', 'NEXT MONTH FOCUS', focus, '', n.closing_line].join(nl)
    await navigator.clipboard.writeText(text)
    toast.success('Report copied to clipboard')
  }

  const client = clients.find(c => c.id === clientId)
  const n = report?.ai_narrative
  const d = report?.report_data
  const monthLabel = month ? new Date(month + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'20px 32px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <h1 style={{ fontFamily:FH, fontSize:22, fontWeight:800, color:'#fff', margin:0, letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:10 }}>
                <FileText size={20} color={RED}/> AI Monthly Report
              </h1>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'3px 0 0', fontFamily:FB }}>
                Generate a client-ready performance report in seconds
              </p>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <ClientSearchSelect
              value={clientId}
              onChange={(id, cl) => {
                setClientId(id)
              }}
            />
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                style={{ padding:'9px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:14, fontFamily:FH }}/>
              <button onClick={generateReport} disabled={loading || !clientId}
                style={{ padding:'9px 22px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:7, boxShadow:`0 3px 12px ${RED}40` }}>
                {loading ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Sparkles size={14}/>}
                {loading ? step || 'Generating…' : 'Generate Report'}
              </button>
            </div>
          </div>

          {/* History strip */}
          {history.length > 0 && (
            <div style={{ display:'flex', gap:8, overflowX:'auto' }}>
              {history.map(h => (
                <button key={h.id} onClick={() => loadExisting(h)}
                  style={{ padding:'5px 14px', borderRadius:20, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.07)', color:'rgba(255,255,255,.6)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, whiteSpace:'nowrap', flexShrink:0 }}>
                  {new Date(h.month + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>

          {report && n && (
            <div>
              {/* Subject line / title */}
              <div style={{ background:`linear-gradient(135deg, ${BLK} 0%, #1a1a2e 100%)`, borderRadius:16, padding:'24px 28px', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <Sparkles size={14} color={TEAL}/>
                      <span style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.07em' }}>AI Generated · {monthLabel}</span>
                    </div>
                    <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:'#fff', marginBottom:10, lineHeight:1.4 }}>{n.subject_line}</div>
                    <div style={{ fontSize:15, color:'rgba(255,255,255,.75)', fontFamily:FB, lineHeight:1.8 }}>{n.executive_summary}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
                    <button onClick={copyReport}
                      style={{ padding:'8px 16px', borderRadius:9, border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.08)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                      <Download size={12}/> Copy Report
                    </button>
                    <button onClick={generateReport} disabled={loading}
                      style={{ padding:'8px 16px', borderRadius:9, border:'none', background:RED+'60', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                      <RefreshCw size={12}/> Regenerate
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              {d && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:16 }}>
                  <StatCard label="New Reviews"    value={d.reviews.this_month} sub={`${d.reviews.last_month > 0 ? (d.reviews.this_month - d.reviews.last_month > 0 ? '+' : '') + (d.reviews.this_month - d.reviews.last_month) + ' vs last month' : 'first month'}`} color={d.reviews.this_month >= d.reviews.last_month ? GREEN : RED} icon={Star}/>
                  <StatCard label="Avg Rating"     value={d.reviews.avg_rating ? `★${d.reviews.avg_rating}` : '—'} sub={d.reviews.prev_avg_rating ? `was ★${d.reviews.prev_avg_rating}` : 'no prior data'} color={AMBER} icon={Star}/>
                  <StatCard label="GBP Score"       value={d.gbp ? `${d.gbp.score}/100` : '—'} sub="Google Business Profile" color={d.gbp?.score >= 80 ? GREEN : d.gbp?.score >= 60 ? AMBER : RED} icon={BarChart2}/>
                  <StatCard label="SEO Score"       value={d.seo ? `${d.seo.score}/100` : '—'} sub="On-page audit" color={d.seo?.score >= 80 ? GREEN : d.seo?.score >= 60 ? AMBER : RED} icon={TrendingUp}/>
                  <StatCard label="Keyword Opps"    value={d.keywords.high_prio || d.keywords.total} sub={`${d.keywords.high_prio} high priority`} color={RED} icon={Target}/>
                </div>
              )}

              {/* Main content: wins + improvements + narrative */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

                {/* Wins */}
                {n.wins?.length > 0 && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 22px' }}>
                    <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                      <CheckCircle size={16} color={GREEN}/> Wins This Month
                    </div>
                    {n.wins.map((w, i) => <WinCard key={i} win={w} idx={i}/>)}
                  </div>
                )}

                {/* Improvements */}
                {n.areas_to_improve?.length > 0 && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 22px' }}>
                    <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                      <AlertCircle size={16} color={AMBER}/> Areas to Improve
                    </div>
                    {n.areas_to_improve.map((a, i) => <ImprovementCard key={i} item={a}/>)}
                  </div>
                )}
              </div>

              {/* Review + SEO narrative */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                {n.review_narrative && (
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK, marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>
                      <Star size={14} color={AMBER}/> Reviews Analysis
                    </div>
                    <div style={{ fontSize:14, color:'#374151', fontFamily:FB, lineHeight:1.7 }}>{n.review_narrative}</div>
                  </div>
                )}
                {n.seo_narrative && (
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'18px 20px' }}>
                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK, marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>
                      <TrendingUp size={14} color={TEAL}/> SEO & GBP Analysis
                    </div>
                    <div style={{ fontSize:14, color:'#374151', fontFamily:FB, lineHeight:1.7 }}>{n.seo_narrative}</div>
                  </div>
                )}
              </div>

              {/* Next month focus */}
              {n.next_month_focus?.length > 0 && (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'20px 22px', marginBottom:16 }}>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                    <Calendar size={16} color={RED}/> Next Month Focus
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {n.next_month_focus.map((f, i) => (
                      <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                        <div style={{ width:24, height:24, borderRadius:6, background:RED+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:FH, fontSize:12, fontWeight:900, color:RED }}>{i+1}</div>
                        <div style={{ fontSize:14, color:'#374151', fontFamily:FB, lineHeight:1.6, paddingTop:2 }}>{f}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Closing + email action */}
              {n.closing_line && (
                <div style={{ background:`${TEAL}12`, borderRadius:14, border:`1px solid ${TEAL}30`, padding:'18px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
                  <div style={{ fontSize:15, color:'#374151', fontFamily:FB, lineHeight:1.6, fontStyle:'italic' }}>"{n.closing_line}"</div>
                  {client?.email && (
                    <button onClick={copyReport}
                      style={{ padding:'9px 20px', borderRadius:10, border:'none', background:TEAL, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      <Send size={13}/> Copy & Send
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!report && !loading && (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'64px 24px', textAlign:'center' }}>
              <FileText size={48} color="#e5e7eb" style={{ margin:'0 auto 16px', display:'block' }}/>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, marginBottom:8 }}>AI Monthly Performance Report</div>
              <div style={{ fontSize:15, color:'#6b7280', fontFamily:FB, maxWidth:520, margin:'0 auto 28px', lineHeight:1.7 }}>
                Select a client and month, then click Generate. Koto pulls all their data — reviews, GBP score, SEO score, keyword opportunities — and Claude writes a professional client-ready report in seconds.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, maxWidth:680, margin:'0 auto' }}>
                {[
                  { icon:'⭐', label:'Reviews',    desc:'Rating trends + response rate' },
                  { icon:'📍', label:'GBP Health', desc:'Profile score + top issues' },
                  { icon:'🔍', label:'SEO Score',  desc:'On-page audit results' },
                  { icon:'🎯', label:'Keywords',   desc:'Opportunities + quick wins' },
                ].map((item,i)=>(
                  <div key={i} style={{ padding:'16px 12px', background:'#f9fafb', borderRadius:12, border:'1px solid #f3f4f6' }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{item.icon}</div>
                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, marginBottom:3 }}>{item.label}</div>
                    <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{item.desc}</div>
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
