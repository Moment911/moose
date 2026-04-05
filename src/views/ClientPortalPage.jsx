"use client"
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Loader2, CheckCircle, AlertCircle, FileText, MessageSquare,
  Star, Clock, ChevronRight, Send, BarChart2, TrendingUp,
  Target, Brain, Sparkles, X, Phone, Mail, Globe,
  Calendar, Shield, Award, ArrowRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast, { Toaster } from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

function StarRow({ rating, size=13 }) {
  return (
    <div style={{ display:'flex', gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} color={i<=rating?AMBER:'#e5e7eb'} fill={i<=rating?AMBER:'none'} strokeWidth={1.5}/>
      ))}
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    active:      { bg:'#f0fdf4', color:GREEN   },
    completed:   { bg:'#eff6ff', color:'#3b82f6'},
    pending:     { bg:'#fffbeb', color:AMBER    },
    open:        { bg:'#fef2f2', color:RED      },
    resolved:    { bg:'#f0fdf4', color:GREEN    },
    new:         { bg:`${RED}10`, color:RED     },
    in_progress: { bg:'#eff6ff', color:'#3b82f6'},
  }[status] || { bg:'#f3f4f6', color:'#6b7280' }
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, background:cfg.bg, color:cfg.color, fontFamily:FH, textTransform:'capitalize' }}>
      {status?.replace(/_/g,' ')}
    </span>
  )
}

export default function ClientPortalPage() {
  const { token, clientId: previewClientId } = useParams()
  const { isPreviewingClient, clientPreview } = useAuth()
  const isPreviewMode = token === 'preview' || !!previewClientId

  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [client,     setClient]     = useState(null)
  const [agency,     setAgency]     = useState(null)
  const [tab,        setTab]        = useState('overview')
  const [projects,   setProjects]   = useState([])
  const [reviews,    setReviews]    = useState([])
  const [tickets,    setTickets]    = useState([])
  const [insights,   setInsights]   = useState([])
  const [lastReport, setLastReport] = useState(null)
  const [showTicket, setShowTicket] = useState(false)
  const [ticketForm, setTicketForm] = useState({ subject:'', message:'', email:'' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isPreviewMode && (clientPreview?.id || previewClientId)) {
      loadDirectClient(clientPreview?.id || previewClientId)
    } else {
      validateToken()
    }
  }, [token, isPreviewMode])

  async function loadDirectClient(cid) {
    const { data: cl } = await supabase.from('clients').select('*').eq('id', cid).single()
    if (!cl) { setError('Client not found'); setLoading(false); return }
    setClient(cl)
    if (cl.agency_id) {
      const { data: ag } = await supabase.from('agencies').select('*').eq('id', cl.agency_id).single()
      setAgency(ag)
    }
    await loadClientData(cid)
  }

  async function validateToken() {
    const res  = await fetch('/api/client-portal', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'validate', token }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { setError(data.error || 'Invalid or expired link'); setLoading(false); return }
    setClient(data.client)
    if (data.client?.agency_id) {
      const { data: ag } = await supabase.from('agencies').select('*').eq('id', data.client.agency_id).single()
      setAgency(ag)
    }
    await loadClientData(data.client.id)
  }

  async function loadClientData(clientId) {
    const [
      { data: proj },
      { data: revs },
      { data: tick },
      { data: ins  },
      { data: rpts },
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('reviews').select('rating,review_text,reviewer_name,review_date,is_responded,platform').eq('client_id', clientId).order('review_date', { ascending: false }).limit(10),
      supabase.from('desk_tickets').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
      supabase.from('agent_insights').select('*').eq('client_id', clientId).eq('dismissed', false).order('created_at', { ascending: false }).limit(10),
      supabase.from('seo_monthly_reports').select('*').eq('client_id', clientId).order('month', { ascending: false }).limit(1),
    ])
    setProjects(proj || [])
    setReviews(revs || [])
    setTickets(tick || [])
    setInsights(ins || [])
    setLastReport(rpts?.[0] || null)
    setLoading(false)
  }

  async function submitTicket() {
    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) { toast.error('Subject and message required'); return }
    setSubmitting(true)
    try {
      await supabase.from('desk_tickets').insert({
        client_id:       client.id,
        agency_id:       client.agency_id,
        subject:         ticketForm.subject,
        description:     ticketForm.message,
        submitter_name:  client.name,
        submitter_email: ticketForm.email || client.email || '',
        status:          'new',
        priority:        'normal',
        source:          'client_portal',
      })
      toast.success('Request submitted ✓')
      setShowTicket(false)
      setTicketForm({ subject:'', message:'', email:'' })
      // Reload tickets
      const { data } = await supabase.from('desk_tickets').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(20)
      setTickets(data || [])
    } catch { toast.error('Failed to submit') }
    setSubmitting(false)
  }

  // Derived stats
  const avgRating    = reviews.filter(r=>r.rating).length ? (reviews.filter(r=>r.rating).reduce((s,r)=>s+r.rating,0)/reviews.filter(r=>r.rating).length).toFixed(1) : null
  const openTickets  = tickets.filter(t=>!['resolved','closed'].includes(t.status)).length
  const doneProjects = projects.filter(p=>p.status==='completed').length
  const activeProj   = projects.filter(p=>p.status==='active').length

  // Branding
  const brandColor = agency?.brand_color || RED
  const brandName  = agency?.brand_name  || agency?.name || 'Your Agency'
  const brandLogo  = agency?.brand_logo_url

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f9fafb' }}>
      <Loader2 size={28} color={brandColor} style={{ animation:'spin 1s linear infinite' }}/>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f9fafb', padding:24 }}>
      <AlertCircle size={40} color={RED} style={{ marginBottom:16 }}/>
      <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, marginBottom:8 }}>Link Unavailable</div>
      <div style={{ fontSize:15, color:'#6b7280', fontFamily:FB }}>{error}</div>
    </div>
  )

  const TABS = [
    { key:'overview',  label:'Overview',  icon:BarChart2    },
    { key:'projects',  label:'Projects',  icon:Target,       badge:activeProj||null },
    { key:'reviews',   label:'Reviews',   icon:Star,         badge:null },
    { key:'support',   label:'Support',   icon:MessageSquare,badge:openTickets||null },
    { key:'report',    label:'Report',    icon:FileText,     badge:null },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:FH }}>
      <Toaster position="top-center"/>

      {/* Header — white-labeled */}
      <div style={{ background:BLK, position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 0 rgba(255,255,255,.05)' }}>
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
          {brandLogo
            ? <img src={brandLogo} alt={brandName} style={{ height:28, maxWidth:160, objectFit:'contain' }}/>
            : <div style={{ fontFamily:FH, fontSize:18, fontWeight:900, color:'#fff', letterSpacing:'-.03em' }}>{brandName}</div>
          }
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', fontFamily:FB }}>{client?.name}</div>
            <button onClick={()=>setShowTicket(true)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:brandColor, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
              <MessageSquare size={12}/> Get Help
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px', display:'flex', gap:2, borderTop:'1px solid rgba(255,255,255,.06)' }}>
          {TABS.map(tab_item => {
            const Icon = tab_item.icon
            const active = tab === tab_item.key
            return (
              <button key={tab_item.key} onClick={()=>setTab(tab_item.key)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'10px 14px', border:'none', background:'transparent', color:active?'#fff':'rgba(255,255,255,.4)', fontSize:12, fontWeight:active?700:500, cursor:'pointer', borderBottom:`2px solid ${active?brandColor:'transparent'}`, position:'relative' }}>
                <Icon size={12}/> {tab_item.label}
                {tab_item.badge > 0 && (
                  <span style={{ background:brandColor, color:'#fff', fontSize:9, fontWeight:800, borderRadius:10, padding:'1px 5px', position:'absolute', top:6, right:4 }}>{tab_item.badge}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth:960, margin:'0 auto', padding:'28px 24px' }}>

        {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div>
            <div style={{ marginBottom:24 }}>
              <h1 style={{ fontFamily:FH, fontSize:24, fontWeight:900, color:BLK, margin:'0 0 4px', letterSpacing:'-.03em' }}>
                Welcome back{client?.name ? `, ${client.name.split(' ')[0]}` : ''}
              </h1>
              <p style={{ fontSize:14, color:'#6b7280', fontFamily:FB, margin:0 }}>
                Here's a summary of your marketing performance
              </p>
            </div>

            {/* Stats row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
              {[
                { label:'Avg Rating',    value:avgRating?`${avgRating}★`:'—',  color:AMBER,  icon:Star       },
                { label:'Reviews',       value:reviews.length,                  color:TEAL,   icon:Star       },
                { label:'Active Projects',value:activeProj,                    color:brandColor,icon:Target   },
                { label:'Open Tickets',  value:openTickets,                     color:openTickets>0?RED:GREEN,icon:MessageSquare },
              ].map(s => (
                <div key={s.label} style={{ background:'#fff', borderRadius:14, border:'1px solid #f3f4f6', padding:'16px', textAlign:'center' }}>
                  <s.icon size={18} color={s.color} style={{ margin:'0 auto 8px', display:'block' }}/>
                  <div style={{ fontFamily:FH, fontSize:26, fontWeight:900, color:s.color, letterSpacing:'-.03em', lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginTop:4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* CMO Insights */}
            {insights.length > 0 && (
              <div style={{ marginBottom:24 }}>
                <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:12, display:'flex', alignItems:'center', gap:7 }}>
                  <Sparkles size={15} color={TEAL}/> Latest Insights from Your Marketing Team
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
                  {insights.slice(0,4).map(ins => {
                    const typeColor = ins.type==='win'?GREEN:ins.type==='alert'?RED:ins.type==='opportunity'?TEAL:AMBER
                    const typeIcon  = ins.type==='win'?'🏆':ins.type==='alert'?'🚨':ins.type==='opportunity'?'🎯':'💡'
                    return (
                      <div key={ins.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #f3f4f6', padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                          <span style={{ fontSize:16 }}>{typeIcon}</span>
                          <span style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:typeColor }}>{ins.title}</span>
                        </div>
                        <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.65 }}>{ins.body?.slice(0,120)}{ins.body?.length>120?'…':''}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent activity */}
            {(projects.length > 0 || tickets.length > 0) && (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f3f4f6', overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #f3f4f6', fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>Recent Activity</div>
                {[...projects.slice(0,3).map(p=>({type:'project',label:p.name,status:p.status,date:p.created_at})),
                  ...tickets.slice(0,3).map(t=>({type:'ticket',label:t.subject,status:t.status,date:t.created_at}))
                ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5).map((item,i) => (
                  <div key={i} style={{ padding:'12px 18px', borderBottom:'1px solid #f9fafb', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:item.type==='project'?brandColor+'15':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {item.type==='project'?<Target size={14} color={brandColor}/>:<MessageSquare size={14} color="#9ca3af"/>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:FH, fontSize:13, fontWeight:600, color:BLK }}>{item.label}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{item.type} · {new Date(item.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                    </div>
                    <StatusBadge status={item.status}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PROJECTS TAB ──────────────────────────────────────────── */}
        {tab === 'projects' && (
          <div>
            <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 16px' }}>Your Projects</h2>
            {projects.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f3f4f6', padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
                No projects yet
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {projects.map(proj => (
                  <div key={proj.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #f3f4f6', padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:40, height:40, borderRadius:11, background:brandColor+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Target size={18} color={brandColor}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK, marginBottom:3 }}>{proj.name}</div>
                      {proj.description && <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{proj.description}</div>}
                      <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginTop:3 }}>
                        Started {new Date(proj.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
                      </div>
                    </div>
                    <StatusBadge status={proj.status}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS TAB ───────────────────────────────────────────── */}
        {tab === 'reviews' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:0 }}>Your Reviews</h2>
              {avgRating && (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <StarRow rating={Math.round(parseFloat(avgRating))} size={16}/>
                  <span style={{ fontFamily:FH, fontSize:20, fontWeight:900, color:AMBER }}>{avgRating}</span>
                  <span style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>({reviews.length} reviews)</span>
                </div>
              )}
            </div>
            {reviews.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f3f4f6', padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
                No reviews synced yet
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {reviews.map((rev,i) => (
                  <div key={i} style={{ background:'#fff', borderRadius:12, border:'1px solid #f3f4f6', padding:'16px 18px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:brandColor+'20', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:13, fontWeight:800, color:brandColor }}>
                          {rev.reviewer_name?.[0]?.toUpperCase()||'?'}
                        </div>
                        <div>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{rev.reviewer_name}</div>
                          <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{rev.review_date?new Date(rev.review_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <StarRow rating={rev.rating}/>
                        {rev.is_responded && <CheckCircle size={13} color={GREEN}/>}
                      </div>
                    </div>
                    {rev.review_text && <div style={{ fontSize:14, color:'#374151', fontFamily:FB, lineHeight:1.7 }}>{rev.review_text}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SUPPORT TAB ───────────────────────────────────────────── */}
        {tab === 'support' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:0 }}>Support Requests</h2>
              <button onClick={()=>setShowTicket(true)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9, border:'none', background:brandColor, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                <MessageSquare size={12}/> New Request
              </button>
            </div>
            {tickets.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f3f4f6', padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>No requests yet</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {tickets.map(tick => (
                  <div key={tick.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #f3f4f6', padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{tick.subject}</div>
                      <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginTop:2 }}>
                        {new Date(tick.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                      </div>
                    </div>
                    <StatusBadge status={tick.status}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORT TAB ────────────────────────────────────────────── */}
        {tab === 'report' && (
          <div>
            <h2 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 16px' }}>Monthly Report</h2>
            {!lastReport ? (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f3f4f6', padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
                No reports generated yet — check back soon
              </div>
            ) : (
              <div>
                <div style={{ background:`linear-gradient(135deg,${BLK},#1a1a2e)`, borderRadius:16, padding:'22px 26px', marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:TEAL, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8, fontFamily:FH }}>
                    {new Date(lastReport.month+'-02').toLocaleDateString('en-US',{month:'long',year:'numeric'})} Performance Report
                  </div>
                  <div style={{ fontSize:15, color:'rgba(255,255,255,.85)', fontFamily:FB, lineHeight:1.8 }}>
                    {lastReport.ai_narrative?.executive_summary || lastReport.ai_narrative?.summary || 'Report generated'}
                  </div>
                </div>

                {lastReport.ai_narrative?.wins?.length > 0 && (
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f3f4f6', padding:'16px 18px', marginBottom:12 }}>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:12 }}>🏆 Wins This Month</div>
                    {lastReport.ai_narrative.wins.map((w,i) => (
                      <div key={i} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:i<lastReport.ai_narrative.wins.length-1?'1px solid #f9fafb':'none' }}>
                        <CheckCircle size={14} color={GREEN} style={{ flexShrink:0, marginTop:2 }}/>
                        <div>
                          <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{w.title}</div>
                          <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{w.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {lastReport.ai_narrative?.next_month_focus?.length > 0 && (
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f3f4f6', padding:'16px 18px' }}>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:12 }}>📅 Next Month Focus</div>
                    {lastReport.ai_narrative.next_month_focus.map((f,i) => (
                      <div key={i} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
                        <div style={{ width:22, height:22, borderRadius:6, background:brandColor+'15', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:11, fontWeight:900, color:brandColor, flexShrink:0 }}>{i+1}</div>
                        <div style={{ fontSize:13, color:'#374151', fontFamily:FB }}>{f}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* New request modal */}
      {showTicket && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'24px 28px', width:'100%', maxWidth:500 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK }}>New Support Request</div>
              <button onClick={()=>setShowTicket(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={16}/></button>
            </div>
            {[
              { key:'subject', label:'Subject', placeholder:'What do you need help with?', rows:null },
              { key:'email',   label:'Your Email (for updates)', placeholder:'email@example.com', rows:null },
              { key:'message', label:'Details', placeholder:'Describe your request in detail…', rows:4 },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:5 }}>{f.label}</label>
                {f.rows
                  ? <textarea value={ticketForm[f.key]} onChange={e=>setTicketForm(p=>({...p,[f.key]:e.target.value}))} rows={f.rows} placeholder={f.placeholder} style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
                  : <input value={ticketForm[f.key]} onChange={e=>setTicketForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
                }
              </div>
            ))}
            <button onClick={submitTicket} disabled={submitting}
              style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:brandColor, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
              {submitting?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Send size={14}/>}
              {submitting?'Submitting…':'Submit Request'}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
