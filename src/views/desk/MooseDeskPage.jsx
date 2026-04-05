"use client";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Inbox, BarChart2, Plus, Search, Settings,
  Loader2, Sparkles, Timer, User, Send, RefreshCw
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { triageTicket, applyRoutingRules, logActivity, CATEGORIES } from '../../lib/moosedesk'
import { emailTicketCreated } from '../../lib/deskEmail'
import toast from 'react-hot-toast'

const RED = '#ea2729'
const TEAL = '#5bc6d0'
const BLACK = '#0a0a0a'

const STATUS_CFG = {
  new:         { label:'New',          color:'#8b5cf6', bg:'#f5f3ff' },
  open:        { label:'Open',         color:'#3b82f6', bg:'#eff6ff' },
  in_progress: { label:'In Progress',  color:'#f59e0b', bg:'#fffbeb' },
  pending:     { label:'Pending',      color:TEAL,      bg:'#e8f9fa' },
  waiting:     { label:'Waiting',      color:'#6b7280', bg:'#f9fafb' },
  resolved:    { label:'Resolved',     color:'#16a34a', bg:'#f0fdf4' },
  closed:      { label:'Closed',       color:'#374151', bg:'#f3f4f6' },
}
const PRI_CFG = {
  low:      { label:'Low',      color:'#6b7280', icon:'↓' },
  normal:   { label:'Normal',   color:'#3b82f6', icon:'→' },
  high:     { label:'High',     color:'#f59e0b', icon:'↑' },
  urgent:   { label:'Urgent',   color:RED,       icon:'⚡' },
  critical: { label:'Critical', color:'#7f1d1d', icon:'🔴' },
}
const SENT_EMOJI = { positive:'😊', neutral:'😐', negative:'😞', frustrated:'😤' }

function TicketCard({ ticket, onClick, agents }) {
  const st  = STATUS_CFG[ticket.status]    || STATUS_CFG.new
  const pr  = PRI_CFG[ticket.priority]     || PRI_CFG.normal
  const agent = agents.find(a => a.id === ticket.assigned_agent_id)
  const age   = Math.round((Date.now() - new Date(ticket.created_at)) / 3600000)
  const ageStr = age < 1 ? 'Just now' : age < 24 ? age + 'h ago' : Math.round(age/24) + 'd ago'
  return (
    <div onClick={() => onClick(ticket)} style={{
      background:'#fff', borderRadius:14, border:'1px solid #ececea',
      padding:'16px 18px', cursor:'pointer', transition:'all .15s',
      borderLeft:'3px solid ' + pr.color,
    }}
    onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)';e.currentTarget.style.transform='translateY(-1px)'}}
    onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
        <div style={{flexShrink:0,minWidth:60}}>
          <div style={{fontSize:18}}>{pr.icon}</div>
          <div style={{fontSize:13,color:'#9ca3af',fontWeight:700,marginTop:2}}>{ticket.ticket_number}</div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:4,
            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ticket.subject}</div>
          {ticket.ai_summary && (
            <div style={{fontSize:13,color:'#374151',marginBottom:8,lineHeight:1.5}}>{ticket.ai_summary}</div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:13,fontWeight:700,padding:'2px 8px',borderRadius:20,background:st.bg,color:st.color}}>{st.label}</span>
            <span style={{fontSize:13,color:'#374151'}}>{ticket.submitter_name}</span>
            {ticket.ai_category && (
              <span style={{fontSize:13,fontWeight:600,padding:'2px 8px',borderRadius:20,background:'#f2f2f0',color:'#374151',textTransform:'capitalize'}}>
                {ticket.ai_category.replace(/_/g,' ')}
              </span>
            )}
            {ticket.ai_sentiment && <span style={{fontSize:13}}>{SENT_EMOJI[ticket.ai_sentiment]||''}</span>}
            <span style={{fontSize:13,color:'#9ca3af',marginLeft:'auto'}}>{ageStr}</span>
          </div>
        </div>
        <div style={{flexShrink:0}}>
          {agent ? (
            <div style={{width:32,height:32,borderRadius:'50%',background:agent.avatar_color||RED,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:13,fontWeight:900,color:'#fff'}} title={agent.name}>
              {agent.name[0].toUpperCase()}
            </div>
          ) : (
            <div style={{width:32,height:32,borderRadius:'50%',background:'#f2f2f0',
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <User size={14} color="#9ca3af"/>
            </div>
          )}
        </div>
      </div>
      {ticket.total_time_minutes > 0 && (
        <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #f3f4f6',
          display:'flex',alignItems:'center',gap:12}}>
          <Timer size={12} color={TEAL}/>
          <span style={{fontSize:13,color:'#374151'}}>{ticket.total_time_minutes}m logged</span>
          {ticket.total_cost > 0 && (
            <span style={{fontSize:13,fontWeight:700,color:'#16a34a'}}>${ticket.total_cost.toFixed(2)}</span>
          )}
        </div>
      )}
    </div>
  )
}

function NewTicketModal({ onClose, onCreated, agencyId, clients }) {
  const { user, firstName } = useAuth()
  const [form, setForm] = useState({
    subject:'', description:'', category:'general', priority:'normal', client_id:'',
    submitter_name: firstName || user?.email?.split('@')[0] || '',
    submitter_email: user?.email || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [triaging, setTriaging]     = useState(false)
  const INP = { width:'100%', padding:'10px 13px', borderRadius:10, border:'1px solid #ececea',
    fontSize:14, outline:'none', color:'#111', boxSizing:'border-box', fontFamily:'inherit' }

  async function submit() {
    if (!form.subject.trim() || !form.description.trim()) { toast.error('Subject and description required'); return }
    setSubmitting(true)
    try {
      const { data: ticket, error } = await supabase.from('desk_tickets').insert({
        agency_id: agencyId, client_id: form.client_id || null,
        submitter_name: form.submitter_name, submitter_email: form.submitter_email,
        submitter_user_id: user?.id || null, subject: form.subject,
        description: form.description, category: form.category, priority: form.priority, status: 'new',
      }).select().single()
      if (error) throw error
      await logActivity(ticket.id, {name:form.submitter_name,type:'client'}, 'created', 'Ticket submitted')
      setSubmitting(false); setTriaging(true)
      try {
        const { data: kb } = await supabase.from('desk_knowledge').select('*').eq('agency_id', agencyId).limit(10)
        const ai = await triageTicket(ticket, kb || [])
        const rule = await applyRoutingRules({...ticket, ai_category:ai.category, ai_priority:ai.priority}, agencyId)
        await supabase.from('desk_tickets').update({
          ai_category: ai.category, ai_priority: ai.priority, ai_summary: ai.summary,
          ai_suggested_response: ai.suggestedResponse, ai_tags: ai.tags,
          ai_sentiment: ai.sentiment, ai_processed_at: new Date().toISOString(),
          ...(rule?.assign_agent_id ? {assigned_agent_id: rule.assign_agent_id} : {}),
          ...(rule?.set_priority    ? {priority: rule.set_priority} : {}),
          status: 'open', updated_at: new Date().toISOString(),
        }).eq('id', ticket.id)
        if (rule) await logActivity(ticket.id, {name:'MooseDesk AI',type:'ai'}, 'routed', 'Auto-routed by rule: ' + rule.name)
        await logActivity(ticket.id, {name:'MooseDesk AI',type:'ai'}, 'triaged', 'AI classified: ' + ai.category + ' / ' + ai.priority)
      } catch(e) { console.warn('AI triage failed:', e.message) }
      // Send email notifications (fire and forget)
      const finalTicket = (await supabase.from('desk_tickets').select('*').eq('id', ticket.id).single()).data || ticket
      emailTicketCreated(finalTicket).catch(console.warn)
      toast.success("Ticket submitted! We'll get back to you shortly.")
      onCreated()
    } catch(e) { toast.error(e.message); setSubmitting(false) }
    setTriaging(false)
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.6)',backdropFilter:'blur(8px)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:560,
        maxHeight:'90vh',overflow:'auto',boxShadow:'0 32px 80px rgba(0,0,0,.25)'}}>
        <div style={{background:'#0a0a0a',borderRadius:'20px 20px 0 0',padding:'22px 28px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:RED,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Inbox size={18} color="#fff"/>
              </div>
              <div>
                <div style={{fontSize:17,fontWeight:900,color:'#fff'}}>Submit a Request</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,.45)'}}>AI will triage and route your ticket automatically</div>
              </div>
            </div>
            <button onClick={onClose} style={{border:'none',background:'rgba(255,255,255,.1)',color:'#fff',borderRadius:8,padding:'5px 10px',cursor:'pointer'}}>✕</button>
          </div>
        </div>
        <div style={{padding:'24px 28px',display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Subject *</label>
            <input value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} placeholder="Brief description of your request…" style={INP}/>
          </div>
          <div>
            <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Description *</label>
            <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
              rows={5} placeholder="Describe your request in detail…" style={{...INP,resize:'vertical',lineHeight:1.65}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Category</label>
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{...INP,background:'#fff'}}>
                {CATEGORIES.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1).replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Priority</label>
              <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{...INP,background:'#fff'}}>
                {Object.entries(PRI_CFG).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
          </div>
          {clients.length > 0 && (
            <div>
              <label style={{fontSize:13,fontWeight:800,color:'#111',display:'block',marginBottom:5}}>Client</label>
              <select value={form.client_id} onChange={e=>setForm(f=>({...f,client_id:e.target.value}))} style={{...INP,background:'#fff'}}>
                <option value="">— Select client —</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <button onClick={submit} disabled={submitting||triaging}
            style={{padding:'13px',borderRadius:12,border:'none',background:RED,color:'#fff',
              fontSize:15,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',
              justifyContent:'center',gap:8,opacity:submitting||triaging?.8:1}}>
            {submitting ? <><Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> Submitting…</>
             : triaging  ? <><Sparkles size={16} style={{animation:'spin 2s linear infinite'}}/> AI Triaging…</>
             : <><Send size={15}/> Submit Request</>}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function MooseDeskPage() {
  const navigate = useNavigate()
  const { agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const [tickets, setTickets] = useState([])
  const [agents,  setAgents]  = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('all')
  const [filterQ, setFilterQ] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [stats,   setStats]   = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [{ data: tt }, { data: aa }, { data: cc }] = await Promise.all([
        supabase.from('desk_tickets').select('*').eq('agency_id', aid).order('created_at', {ascending:false}).limit(200),
        supabase.from('desk_agents').select('*').eq('agency_id', aid).eq('is_active', true),
        supabase.from('clients').select('id,name').eq('agency_id', aid).order('name'),
      ])
      const t = tt || []
      setTickets(t); setAgents(aa||[]); setClients(cc||[])
      setStats({
        total: t.length, new: t.filter(x=>x.status==='new').length,
        open: t.filter(x=>['open','in_progress','pending','waiting'].includes(x.status)).length,
        resolved: t.filter(x=>['resolved','closed'].includes(x.status)).length,
        urgent: t.filter(x=>['urgent','critical'].includes(x.priority)).length,
        unassigned: t.filter(x=>!x.assigned_agent_id).length,
        totalTime: t.reduce((s,x)=>s+(x.total_time_minutes||0),0),
        totalCost: t.reduce((s,x)=>s+(x.total_cost||0),0),
      })
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const filtered = tickets.filter(t => {
    const matchTab = tab==='all' ? true : tab==='new' ? t.status==='new'
      : tab==='open' ? ['open','in_progress','pending','waiting'].includes(t.status)
      : tab==='resolved' ? ['resolved','closed'].includes(t.status)
      : tab==='urgent' ? ['urgent','critical'].includes(t.priority)
      : tab==='unassigned' ? !t.assigned_agent_id : true
    const matchQ = !filterQ || [t.subject,t.submitter_name,t.ticket_number,t.ai_summary]
      .some(f=>f?.toLowerCase().includes(filterQ.toLowerCase()))
    return matchTab && matchQ
  })

  const TABS = [
    {key:'all',        label:'All',        count:stats.total},
    {key:'new',        label:'New',        count:stats.new},
    {key:'open',       label:'Open',       count:stats.open},
    {key:'urgent',     label:'Urgent',     count:stats.urgent},
    {key:'unassigned', label:'Unassigned', count:stats.unassigned},
    {key:'resolved',   label:'Resolved',   count:stats.resolved},
  ]

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f2f2f0',fontFamily:"var(--font-body)"}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:'#0a0a0a',padding:'18px 28px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                <div style={{width:34,height:34,borderRadius:10,background:RED,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Inbox size={17} color="#fff"/>
                </div>
                <h1 style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:800,color:'#fff',letterSpacing:'-.02em',margin:0,letterSpacing:-0.3}}>MooseDesk</h1>
                <span style={{fontSize:13,fontWeight:800,color:TEAL,background:TEAL+'20',padding:'2px 8px',borderRadius:20,border:'1px solid '+TEAL+'40'}}>AI-Powered</span>
              </div>
              <p style={{fontSize:14,color:'rgba(255,255,255,.4)',margin:0}}>
                {stats.total||0} tickets · {stats.open||0} open · {stats.unassigned||0} unassigned
              </p>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>navigate('/desk/settings')}
                style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:10,
                  border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',
                  color:'rgba(255,255,255,.7)',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                <Settings size={13}/> Setup
              </button>
              <button onClick={()=>navigate('/desk/reports')}
                style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:10,
                  border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',
                  color:'rgba(255,255,255,.7)',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                <BarChart2 size={13}/> Analytics
              </button>
              <button onClick={()=>setShowNew(true)}
                style={{display:'flex',alignItems:'center',gap:7,padding:'8px 18px',borderRadius:10,
                  border:'none',background:RED,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}}>
                <Plus size={14}/> New Ticket
              </button>
            </div>
          </div>
          <div style={{display:'flex',gap:28,marginBottom:0}}>
            {[
              {label:'Total',value:stats.total||0},
              {label:'Open',value:stats.open||0},
              {label:'Urgent',value:stats.urgent||0,alert:stats.urgent>0},
              {label:'Unassigned',value:stats.unassigned||0,alert:stats.unassigned>0},
              {label:'Time logged',value:stats.totalTime?Math.round(stats.totalTime/60)+'h '+stats.totalTime%60+'m':'0m'},
              {label:'Total cost',value:stats.totalCost?'$'+stats.totalCost.toFixed(2):'$0.00'},
            ].map(s=>(
              <div key={s.label} style={{padding:'10px 0'}}>
                <div style={{fontSize:20,fontWeight:900,color:s.alert?RED:'#fff',lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,.4)',marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:0,marginTop:4}}>
            {TABS.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{display:'flex',alignItems:'center',gap:6,padding:'11px 18px',border:'none',
                  borderBottom:'2.5px solid '+(tab===t.key?RED:'transparent'),background:'transparent',
                  color:tab===t.key?'#fff':'rgba(255,255,255,.4)',
                  fontSize:14,fontWeight:tab===t.key?800:600,cursor:'pointer',transition:'all .15s'}}>
                {t.label}
                {(t.count||0) > 0 && (
                  <span style={{fontSize:13,fontWeight:800,padding:'1px 6px',borderRadius:20,
                    background:tab===t.key?RED+'40':'rgba(255,255,255,.1)',
                    color:tab===t.key?'#fff':'rgba(255,255,255,.5)'}}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'12px 28px',
          flexShrink:0,display:'flex',gap:10,alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'#f2f2f0',
            borderRadius:10,padding:'8px 14px',flex:1,maxWidth:400}}>
            <Search size={14} color="#9ca3af"/>
            <input value={filterQ} onChange={e=>setFilterQ(e.target.value)}
              placeholder="Search tickets…"
              style={{border:'none',outline:'none',fontSize:14,background:'transparent',flex:1,color:'#111'}}/>
          </div>
          <button onClick={load}
            style={{display:'flex',alignItems:'center',gap:5,padding:'8px 14px',
              borderRadius:10,border:'1px solid #ececea',background:'#fff',
              fontSize:13,fontWeight:700,cursor:'pointer',color:'#374151'}}>
            <RefreshCw size={13}/> Refresh
          </button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px 28px'}}>
          {loading ? (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80}}>
              <Loader2 size={28} color={RED} style={{animation:'spin 1s linear infinite'}}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'60px 24px'}}>
              <Inbox size={40} color="#e5e7eb" style={{margin:'0 auto 16px'}}/>
              <div style={{fontSize:17,fontWeight:800,color:'#111',marginBottom:6}}>
                {tab==='all'?'No tickets yet':'No '+tab+' tickets'}
              </div>
              <div style={{fontSize:14,color:'#374151',marginBottom:20}}>
                {tab==='all'?'Client requests will appear here and be triaged by AI automatically':'All clear'}
              </div>
              {tab==='all' && (
                <button onClick={()=>setShowNew(true)}
                  style={{padding:'10px 24px',borderRadius:10,border:'none',background:RED,
                    color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  Create First Ticket
                </button>
              )}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {filtered.map(t=>(
                <TicketCard key={t.id} ticket={t} agents={agents}
                  onClick={t=>navigate('/desk/ticket/'+t.id)}/>
              ))}
            </div>
          )}
        </div>
      </div>
      {showNew && (
        <NewTicketModal
          onClose={()=>setShowNew(false)}
          onCreated={()=>{setShowNew(false);load()}}
          agencyId={aid} clients={clients}/>
      )}
    </div>
  )
}