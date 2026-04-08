"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Send, CheckCircle, Loader2, Play, Square,
  Sparkles, Copy, BookOpen, ChevronDown, User, Timer,
  AlertCircle, X, Shield, MessageSquare, Brain
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { logActivity, startTimer, stopTimer } from '../../lib/moosedesk'
import { emailReplySent, emailTicketResolved } from '../../lib/deskEmail'
import { learnFromResolvedTicket, searchKnowledge } from '../../lib/qaKnowledge'
import { callClaude } from '../../lib/ai'
import toast from 'react-hot-toast'
import { useMobile } from '../../hooks/useMobile'
import { MobilePage, MobilePageHeader, MobileCard, MobileButton } from '../../components/mobile/MobilePage'

const RED   = '#E6007E'
const TEAL  = '#00C2CB'
const BLACK = '#0a0a0a'

const STATUS_OPTS = [
  {key:'new',label:'New'},{key:'open',label:'Open'},
  {key:'in_progress',label:'In Progress'},{key:'pending',label:'Pending'},
  {key:'waiting',label:'Waiting'},{key:'resolved',label:'Resolved'},{key:'closed',label:'Closed'},
]
const PRI_OPTS = [
  {key:'low',label:'Low ↓'},{key:'normal',label:'Normal →'},
  {key:'high',label:'High ↑'},{key:'urgent',label:'Urgent ⚡'},{key:'critical',label:'Critical 🔴'},
]
const SENT_EMOJI = {positive:'😊',neutral:'😐',negative:'😞',frustrated:'😤'}

// ── PII scrubber — two-pass strip before saving to knowledge base ─────────────
function scrubPII(text) {
  if (!text) return text
  let s = text
  // Pass 1 — structured patterns
  s = s.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
  s = s.replace(/\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]')
  s = s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
  s = s.replace(/\b4[0-9]{12}(?:[0-9]{3})?\b|\b5[1-5][0-9]{14}\b|\b3[47][0-9]{13}\b/g, '[CARD]')
  s = s.replace(/https?:\/\/[^\s]+/g, '[URL]')
  s = s.replace(/\b(password|passwd|pwd|secret|token|api[_\s]?key|auth[_\s]?key)\s*[:=]\s*\S+/gi, '[CREDENTIAL]')
  s = s.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]')
  s = s.replace(/\b\d{1,5}\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/gi, '[ADDRESS]')
  // Pass 2 — business identifiers
  s = s.replace(/\b(client|company|customer|business|account)\s*[:=]?\s*["']?[A-Za-z][A-Za-z0-9\s&]{2,30}["']?/gi, '[CLIENT_NAME]')
  s = s.replace(/\b(username|user|login)\s*[:=]\s*\S+/gi, '[USERNAME]')
  s = s.replace(/\b\d{5,}\b/g, '[ID]')
  // Verification pass — flag anything that looks like it slipped through
  const flags = []
  if (/[A-Za-z0-9._%+-]+@/.test(s)) flags.push('possible email')
  if (/\b\d{10}\b/.test(s))          flags.push('possible phone')
  return { text: s, flags }
}

// ── Elapsed timer ─────────────────────────────────────────────────────────────
function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.round((Date.now()-new Date(startedAt))/1000)), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  const h = Math.floor(elapsed/3600), m = Math.floor((elapsed%3600)/60), s = elapsed%60
  return <span>{h>0?h+'h ':''}{m>0?m+'m ':''}{s}s</span>
}

// ── KB Match panel ────────────────────────────────────────────────────────────
function KBSuggestions({ ticket, onUse }) {
  const [matches, setMatches]  = useState([])
  const [loading, setLoading]  = useState(false)
  const [expanded, setExpanded]= useState(null)
  const aid = ticket?.agency_id

  useEffect(() => {
    if (!ticket?.subject) return
    setLoading(true)
    const query = ticket.subject + ' ' + (ticket.ai_category||'')
    searchKnowledge(query, aid, 5).then(r => {
      setMatches(r.filter(m => m.answer || m.resolution))
      setLoading(false)
    })
  }, [ticket?.id])

  if (loading) return (
    <div style={{padding:'12px 16px',background:'#f9fafb',borderRadius:12,
      border:'1px solid #e5e7eb',display:'flex',alignItems:'center',gap:8}}>
      <Loader2 size={13} color={TEAL} style={{animation:'spin 1s linear infinite'}}/>
      <span style={{fontSize:13,color:'#374151'}}>Searching knowledge base…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (matches.length === 0) return (
    <div style={{padding:'10px 14px',background:'#f9fafb',borderRadius:12,
      border:'1px solid #e5e7eb',fontSize:13,color:'#9ca3af'}}>
      No KB matches found for this ticket.
    </div>
  )

  return (
    <div>
      <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',
        letterSpacing:'.07em',marginBottom:8}}>
        {matches.length} knowledge base match{matches.length!==1?'es':''}
      </div>
      {matches.map((m,i) => (
        <div key={m.id} style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',
          marginBottom:8,overflow:'hidden'}}>
          <div style={{padding:'10px 14px',display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}
            onClick={()=>setExpanded(expanded===i?null:i)}>
            <BookOpen size={14} color={TEAL} style={{flexShrink:0,marginTop:2}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:800,color:'#111',marginBottom:2}}>
                {m.question || m.subject_pattern}
              </div>
              <div style={{fontSize:13,color:'#374151',overflow:'hidden',
                display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                {m.answer_short || (m.answer||m.resolution||'').slice(0,120)}
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              {m.is_verified && <CheckCircle size={13} color="#16a34a"/>}
              <button onClick={e=>{e.stopPropagation();onUse(m.answer||m.resolution||'')}}
                style={{padding:'4px 10px',borderRadius:8,border:'none',
                  background:RED,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Use
              </button>
            </div>
          </div>
          {expanded===i && (
            <div style={{padding:'0 14px 14px',borderTop:'1px solid #f3f4f6',paddingTop:12}}>
              <div style={{fontSize:13,color:'#374151',lineHeight:1.7,whiteSpace:'pre-wrap'}}>
                {m.answer||m.resolution}
              </div>
              <button onClick={()=>onUse(m.answer||m.resolution||'')}
                style={{marginTop:10,padding:'6px 14px',borderRadius:9,border:'none',
                  background:RED,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',
                  display:'flex',alignItems:'center',gap:5}}>
                <Copy size={11}/> Use this response
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── AI reply generator ────────────────────────────────────────────────────────
async function generateAIReply(ticket, replies, agentName) {
  const thread = replies.slice(-4).map(r =>
    (r.author_type==='client'?'Client':'Agent') + ': ' + r.body
  ).join('\n')
  const prompt =
    'You are a helpful marketing agency support agent named ' + agentName + '.\n\n' +
    'Ticket: ' + ticket.subject + '\n' +
    'Client message: ' + ticket.description + '\n' +
    (thread ? 'Recent thread:\n' + thread + '\n' : '') +
    'Category: ' + (ticket.ai_category||ticket.category||'general') + '\n' +
    'Sentiment: ' + (ticket.ai_sentiment||'neutral') + '\n\n' +
    'Write a professional, helpful, specific reply to this client. ' +
    '2-4 sentences. Warm but concise. Address their specific issue. ' +
    'Do NOT use placeholders like [X] or generic filler text. ' +
    'Sign off naturally. Return only the reply text, no subject line or metadata.'
  return callClaude('You are a support agent. Write only the reply text.', prompt, 500)
}

// ── Reply box ─────────────────────────────────────────────────────────────────
function ReplyBox({ ticket, replies, agents, agentMe, onSent }) {
  const { user, firstName } = useAuth()
  const [mode,       setMode]        = useState('reply')   // reply | internal
  const [body,       setBody]        = useState('')
  const [sending,    setSending]     = useState(false)
  const [generating, setGenerating]  = useState(false)
  const [showKB,     setShowKB]      = useState(false)
  const [actingAs,   setActingAs]    = useState(agentMe?.id || '')
  const [showActAs,  setShowActAs]   = useState(false)

  // Sync actingAs when agentMe loads
  useEffect(() => { if (agentMe?.id && !actingAs) setActingAs(agentMe.id) }, [agentMe])

  const selectedAgent = agents.find(a => a.id === actingAs) || agentMe || { name: firstName||'Agent', email: user?.email }

  async function send() {
    if (!body.trim()) return
    setSending(true)
    try {
      const isInternal = mode === 'internal'
      await supabase.from('desk_replies').insert({
        ticket_id:    ticket.id,
        author_id:    user?.id,
        author_name:  selectedAgent.name,
        author_email: selectedAgent.email || user?.email,
        author_type:  'agent',
        body:         body,
        is_internal:  isInternal,
      })
      await supabase.from('desk_tickets').update({
        reply_count: (ticket.reply_count||0)+1,
        ...(!ticket.first_response_at ? {first_response_at:new Date().toISOString()} : {}),
        ...(['new','open'].includes(ticket.status) ? {status:'in_progress'} : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', ticket.id)
      await logActivity(ticket.id,
        {name:selectedAgent.name, type:'agent'},
        'replied',
        isInternal
          ? 'Internal note by ' + selectedAgent.name
          : 'Reply sent on behalf of ' + selectedAgent.name
      )
      if (!isInternal) {
        const replyObj = {author_name:selectedAgent.name,author_type:'agent',body,is_internal:false}
        emailReplySent(ticket, replyObj).catch(console.warn)
      }
      setBody('')
      onSent()
      toast.success(isInternal ? 'Note added' : 'Reply sent!')
    } catch(e) { toast.error(e.message) }
    setSending(false)
  }

  async function generateReply() {
    setGenerating(true)
    try {
      const text = await generateAIReply(ticket, replies, selectedAgent.name)
      setBody(text.trim())
      toast.success('AI reply generated — review before sending')
    } catch(e) { toast.error('AI generation failed: ' + e.message) }
    setGenerating(false)
  }

  const INP_STYLE = {
    width:'100%',padding:'11px 14px',borderRadius:10,fontFamily:'inherit',
    fontSize:14,lineHeight:1.7,outline:'none',resize:'vertical',color:'#111',
    boxSizing:'border-box',border:'1.5px solid #e5e7eb',
    background: mode==='internal' ? '#fffbeb' : '#fff'
  }

  return (
    <div style={{background:'#fff',borderRadius:16,border:'1px solid #e5e7eb',
      marginTop:14,overflow:'hidden'}}>

      {/* Mode tabs + acting-as selector */}
      <div style={{padding:'12px 16px',borderBottom:'1px solid #f3f4f6',
        display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:6}}>
          {[{key:'reply',label:'Reply to Client',bg:RED},
            {key:'internal',label:'Internal Note',bg:'#d97706'}].map(m=>(
            <button key={m.key} onClick={()=>setMode(m.key)}
              style={{padding:'5px 14px',borderRadius:20,border:'none',cursor:'pointer',
                background:mode===m.key?m.bg:'#f3f4f6',
                color:mode===m.key?'#fff':'#374151',fontSize:13,fontWeight:700}}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Acting-as dropdown */}
        <div style={{marginLeft:'auto',position:'relative'}}>
          <button onClick={()=>setShowActAs(s=>!s)}
            style={{display:'flex',alignItems:'center',gap:7,padding:'5px 12px',
              borderRadius:9,border:'1.5px solid #e5e7eb',background:'#f9fafb',
              fontSize:13,fontWeight:700,cursor:'pointer',color:'#374151'}}>
            <Shield size={12} color={TEAL}/>
            Sending as: <strong>{selectedAgent.name}</strong>
            <ChevronDown size={12}/>
          </button>
          {showActAs && (
            <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,zIndex:50,
              background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',
              boxShadow:'0 8px 24px rgba(0,0,0,.12)',minWidth:200,overflow:'hidden'}}>
              {agents.map(a=>(
                <button key={a.id} onClick={()=>{setActingAs(a.id);setShowActAs(false)}}
                  style={{width:'100%',padding:'10px 16px',border:'none',
                    background:actingAs===a.id?'#fef2f2':'#fff',textAlign:'left',
                    cursor:'pointer',display:'flex',alignItems:'center',gap:8,
                    fontSize:14,color:'#111',fontWeight:actingAs===a.id?800:400}}>
                  <div style={{width:28,height:28,borderRadius:'50%',
                    background:a.avatar_color||RED,flexShrink:0,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:13,fontWeight:900,color:'#fff'}}>
                    {a.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div>{a.name}</div>
                    <div style={{fontSize:13,color:'#9ca3af'}}>{a.role}</div>
                  </div>
                  {actingAs===a.id && <CheckCircle size={13} color={RED} style={{marginLeft:'auto'}}/>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KB suggestions panel */}
      {showKB && (
        <div style={{padding:'14px 16px',background:'#f9fafb',borderBottom:'1px solid #f3f4f6'}}>
          <KBSuggestions ticket={ticket} onUse={text=>{setBody(text);setShowKB(false)}}/>
        </div>
      )}

      {/* Textarea */}
      <div style={{padding:'14px 16px'}}>
        <textarea
          value={body}
          onChange={e=>setBody(e.target.value)}
          rows={5}
          placeholder={mode==='internal'
            ? 'Internal note — visible to team only…'
            : 'Reply to ' + ticket.submitter_name + '…'}
          style={INP_STYLE}/>

        {/* Toolbar */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
          {/* KB suggestions toggle */}
          <button onClick={()=>setShowKB(s=>!s)}
            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',
              borderRadius:9,border:`1.5px solid ${showKB?TEAL:'#e5e7eb'}`,
              background:showKB?TEAL+'15':'#f9fafb',
              color:showKB?'#0e7490':'#374151',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            <BookOpen size={13}/> KB Suggestions
          </button>

          {/* AI generate */}
          <button onClick={generateReply} disabled={generating}
            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',
              borderRadius:9,border:'1.5px solid #e9d5ff',background:'#f5f3ff',
              color:'#7c3aed',fontSize:13,fontWeight:700,cursor:'pointer',
              opacity:generating?.7:1}}>
            {generating
              ? <><Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> Generating…</>
              : <><Sparkles size={13}/> AI Generate</>}
          </button>

          {body.trim() && (
            <span style={{fontSize:13,color:'#9ca3af'}}>{body.length} chars</span>
          )}

          {/* Send */}
          <button onClick={send} disabled={sending||!body.trim()}
            style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:7,
              padding:'8px 20px',borderRadius:10,border:'none',
              background:mode==='internal'?'#d97706':RED,
              color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',
              opacity:!body.trim()?.5:1}}>
            {sending
              ? <><Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> Sending…</>
              : <><Send size={13}/> {mode==='internal'?'Add Note':'Send Reply'}</>}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function DeskTicketPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, firstName, agencyId } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [ticket,   setTicket]   = useState(null)
  const [replies,  setReplies]  = useState([])
  const [timeLogs, setTimeLogs] = useState([])
  const [activity, setActivity] = useState([])
  const [agents,   setAgents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('thread')
  const [activeLog,setActiveLog]= useState(null)
  const [agentMe,  setAgentMe]  = useState(null)
  const [savingField,setSavingField]=useState(null)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [
      {data:t},{data:rr},{data:tl},{data:ac},{data:aa}
    ] = await Promise.all([
      supabase.from('desk_tickets').select('*').eq('id',id).single(),
      supabase.from('desk_replies').select('*').eq('ticket_id',id).order('created_at'),
      supabase.from('desk_time_logs').select('*').eq('ticket_id',id).order('started_at'),
      supabase.from('desk_activity').select('*').eq('ticket_id',id)
        .order('created_at',{ascending:false}).limit(50),
      supabase.from('desk_agents').select('*').eq('agency_id',aid).eq('is_active',true),
    ])
    setTicket(t); setReplies(rr||[]); setTimeLogs(tl||[])
    setActivity(ac||[]); setAgents(aa||[])
    if (t) supabase.from('desk_tickets').update({views:(t.views||0)+1}).eq('id',id)
    const running = (tl||[]).find(l=>l.is_running)
    setActiveLog(running||null)
    const me = (aa||[]).find(a=>a.email===user?.email)
    setAgentMe(me||null)
    setLoading(false)
  }

  async function updateField(field, value) {
    setSavingField(field)
    const old = ticket[field]
    setTicket(t=>({...t,[field]:value}))
    await supabase.from('desk_tickets').update({[field]:value,updated_at:new Date().toISOString()}).eq('id',id)
    await logActivity(id,{name:firstName||'Agent',type:'agent'},
      field+'_changed', field.replace(/_/g,' ')+' → '+value)
    setSavingField(null)
  }

  async function handleTimer() {
    if (activeLog) {
      await stopTimer(activeLog.id, '')
      await logActivity(id,{name:agentMe?.name||firstName||'Agent',type:'agent'},'time_stopped','Timer stopped')
      setActiveLog(null); load(); toast.success('Timer stopped')
    } else {
      if (!agentMe) { toast.error('Add yourself as a desk agent in Settings first'); return }
      const {data, error} = await startTimer(id, agentMe)
      if (error) { toast.error(error.message); return }
      setActiveLog(data)
      await logActivity(id,{name:agentMe.name,type:'agent'},'time_started','Timer started')
      toast.success('Timer started')
    }
  }

  async function resolveTicket() {
    await updateField('status','resolved')
    await supabase.from('desk_tickets').update({resolved_at:new Date().toISOString()}).eq('id',id)
    // Auto-learn: scrub PII before saving to knowledge base
    try {
      const allReplies = (await supabase.from('desk_replies').select('*').eq('ticket_id',id).order('created_at')).data || []
      // Scrub replies before passing to KB
      const scrubbedReplies = allReplies.map(r => ({
        ...r, body: scrubPII(r.body).text
      }))
      const scrubbedTicket = {
        ...ticket,
        subject:     scrubPII(ticket.subject).text,
        description: scrubPII(ticket.description).text,
      }
      learnFromResolvedTicket(scrubbedTicket, scrubbedReplies, aid).catch(console.warn)
    } catch(e) { console.warn('Auto-learn:', e.message) }
    emailTicketResolved(ticket).catch(console.warn)
    toast.success('Ticket resolved ✓')
  }

  const totalMins = timeLogs.reduce((s,l)=>s+(l.minutes||0),0)
  const totalCost = timeLogs.reduce((s,l)=>s+(l.cost||0),0)

  if (loading) return (
    <div className="page-shell" style={{display:'flex',height:'100vh'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <Loader2 size={28} color={RED} style={{animation:'spin 1s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
  if (!ticket) return (
    <div style={{display:'flex',height:'100vh'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
        flexDirection:'column',gap:16}}>
        <AlertCircle size={40} color={RED}/>
        <div style={{fontSize:18,fontWeight:800,color:'#111'}}>Ticket not found</div>
        <button onClick={()=>navigate('/desk')}
          style={{padding:'10px 24px',borderRadius:10,border:'none',
            background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
          Back to Desk
        </button>
      </div>
    </div>
  )

  const isMobile = useMobile()

  /* ─── MOBILE ─── */
  if (isMobile) {
    const PRI = {urgent:{color:'#E6007E'},high:{color:'#f59e0b'},normal:{color:'#9a9a96'},low:{color:'#d0d0cc'}}
    const priColor = PRI[ticket?.priority]?.color||'#9a9a96'
    return (
      <MobilePage padded={false}>
        <MobilePageHeader
          title={ticket ? `#${ticket.ticket_number||'Ticket'}` : 'Ticket'}
          subtitle={ticket?.subject||'Loading…'}/>

        {loading ? (
          <div style={{padding:40,textAlign:'center',color:'#9a9a96'}}>Loading…</div>
        ) : !ticket ? (
          <div style={{padding:40,textAlign:'center',color:'#9a9a96'}}>Ticket not found</div>
        ) : (
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
            {/* Status/priority pills */}
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <span style={{fontSize:12,fontWeight:700,padding:'4px 10px',borderRadius:20,background:'#F9F9F9',color:'#5a5a58',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",textTransform:'capitalize'}}>{ticket.status?.replace('_',' ')}</span>
              <span style={{fontSize:12,fontWeight:700,padding:'4px 10px',borderRadius:20,background:priColor+'15',color:priColor,fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",textTransform:'capitalize'}}>{ticket.priority||'normal'}</span>
              {ticket.ai_category && <span style={{fontSize:12,fontWeight:700,padding:'4px 10px',borderRadius:20,background:'#f0fbfc',color:'#0e7490',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>{ticket.ai_category}</span>}
            </div>

            {/* Description */}
            <MobileCard style={{padding:'14px'}}>
              <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:13,fontWeight:700,color:'#9a9a96',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>Description</div>
              <p style={{fontSize:15,color:'#0a0a0a',lineHeight:1.65,margin:0,fontFamily:"'Raleway',sans-serif"}}>{ticket.description||'No description'}</p>
            </MobileCard>

            {/* AI Summary */}
            {ticket.ai_summary && (
              <MobileCard style={{padding:'14px',borderLeft:'3px solid #00C2CB'}}>
                <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:12,fontWeight:700,color:'#00C2CB',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>AI Summary</div>
                <p style={{fontSize:14,color:'#5a5a58',lineHeight:1.6,margin:0,fontFamily:"'Raleway',sans-serif"}}>{ticket.ai_summary}</p>
              </MobileCard>
            )}

            {/* Replies */}
            {replies?.length>0 && (
              <MobileCard style={{padding:'14px'}}>
                <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:13,fontWeight:700,color:'#9a9a96',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>Replies ({replies.length})</div>
                {replies.map((r,i)=>(
                  <div key={r.id} style={{paddingBottom:i<replies.length-1?12:0,marginBottom:i<replies.length-1?12:0,borderBottom:i<replies.length-1?'1px solid #f2f2f0':'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <div style={{width:28,height:28,borderRadius:'50%',background:r.author_type==='agent'?'#E6007E':'#F9F9F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:r.author_type==='agent'?'#fff':'#5a5a58',fontFamily:"'Proxima Nova','Nunito Sans',sans-serif"}}>
                        {(r.author_name||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <span style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:13,fontWeight:700,color:'#0a0a0a'}}>{r.author_name||'Agent'}</span>
                        <span style={{fontSize:11,color:'#9a9a96',marginLeft:8}}>{new Date(r.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>
                      </div>
                    </div>
                    <p style={{fontSize:14,color:'#5a5a58',lineHeight:1.6,margin:0,fontFamily:"'Raleway',sans-serif",paddingLeft:36}}>{r.body}</p>
                  </div>
                ))}
              </MobileCard>
            )}

            {/* Reply box */}
            <MobileCard style={{padding:'14px'}}>
              <div style={{fontFamily:"'Proxima Nova','Nunito Sans',sans-serif",fontSize:13,fontWeight:700,color:'#9a9a96',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Reply</div>
              <textarea value={mReplyText} onChange={e=>setMReplyText(e.target.value)}
                placeholder="Type your reply…" rows={3}
                style={{width:'100%',border:'1px solid #ececea',borderRadius:10,padding:'10px 12px',fontSize:16,outline:'none',resize:'none',boxSizing:'border-box',fontFamily:"'Raleway',sans-serif",color:'#0a0a0a'}}
                onFocus={e=>e.target.style.borderColor='#E6007E'} onBlur={e=>e.target.style.borderColor='#ececea'}/>
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <MobileButton label={mReplySending?'Sending…':'Send Reply'} disabled={!mReplyText.trim()||mReplySending}
                  onPress={async()=>{
                    if(!mReplyText.trim()||!ticket) return
                    setMReplySending(true)
                    try {
                      await supabase.from('desk_replies').insert({
                        ticket_id: ticket.id,
                        body: mReplyText.trim(),
                        author_type: 'agent',
                        author_name: agentMe?.name || 'Agent',
                        is_internal: false,
                        created_at: new Date().toISOString(),
                      })
                      if (ticket.status === 'new') {
                        await supabase.from('desk_tickets').update({status:'in_progress'}).eq('id',ticket.id)
                      }
                      setMReplyText('')
                      const {data:r} = await supabase.from('desk_replies').select('*').eq('ticket_id',ticket.id).order('created_at')
                      setReplies(r||[])
                      toast.success('Reply sent')
                    } catch(e) { toast.error(e.message) }
                    setMReplySending(false)
                  }}/>
                <MobileButton label="Resolve" secondary
                  onPress={async()=>{
                    if(!ticket) return
                    await supabase.from('desk_tickets').update({status:'resolved', resolved_at: new Date().toISOString()}).eq('id',ticket.id)
                    toast.success('Ticket resolved')
                    navigate('/desk')
                  }}/>
              </div>
            </MobileCard>
          </div>
        )}
      </MobilePage>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#F9F9F9'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Top bar */}
        <div style={{background:BLACK,padding:'14px 24px',flexShrink:0,
          display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>navigate('/desk')}
            style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:9,
              border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',
              color:'#999999',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            <ChevronLeft size={14}/> All Tickets
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,fontWeight:800,color:TEAL,flexShrink:0}}>{ticket.ticket_number}</span>
              <h2 style={{fontSize:17,fontWeight:900,color:'#fff',margin:0,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ticket.subject}</h2>
            </div>
            <div style={{fontSize:13,color:'#999999',marginTop:2}}>
              From {ticket.submitter_name} · {new Date(ticket.created_at).toLocaleString()}
              {ticket.ai_sentiment && <span style={{marginLeft:8}}>{SENT_EMOJI[ticket.ai_sentiment]||''}</span>}
            </div>
          </div>
          <button onClick={handleTimer}
            style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',
              borderRadius:10,border:'none',background:activeLog?'#16a34a':TEAL,
              color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',flexShrink:0}}>
            {activeLog
              ? <><Square size={13}/> Stop · <ElapsedTimer startedAt={activeLog.started_at}/></>
              : <><Play size={13}/> Start Timer</>}
          </button>
          {!['resolved','closed'].includes(ticket.status) && (
            <button onClick={resolveTicket}
              style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',
                borderRadius:10,border:'none',background:'#16a34a',
                color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',flexShrink:0}}>
              <CheckCircle size={13}/> Resolve
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 320px',overflow:'hidden'}}>

          {/* Main thread */}
          <div style={{display:'flex',flexDirection:'column',overflow:'hidden',
            borderRight:'1px solid #e5e7eb'}}>

            {/* Tab bar */}
            <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',
              padding:'0 24px',flexShrink:0,display:'flex'}}>
              {[{key:'thread',label:'Thread'},
                {key:'activity',label:'Activity'},
                {key:'time',label:'Time Logs'}].map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  style={{padding:'12px 18px',border:'none',
                    borderBottom:'2.5px solid '+(tab===t.key?RED:'transparent'),
                    background:'transparent',color:tab===t.key?RED:'#374151',
                    fontSize:14,fontWeight:tab===t.key?800:600,cursor:'pointer'}}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>

              {/* ── THREAD ── */}
              {tab==='thread' && (
                <>
                  {/* Original message */}
                  <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
                    padding:'18px 20px',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                      <div style={{width:34,height:34,borderRadius:'50%',background:RED,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:14,fontWeight:900,color:'#fff'}}>
                        {ticket.submitter_name[0].toUpperCase()}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:800,color:'#111'}}>{ticket.submitter_name}</div>
                        <div style={{fontSize:13,color:'#9ca3af'}}>{ticket.submitter_email}</div>
                      </div>
                      <span style={{fontSize:13,color:'#9ca3af'}}>{new Date(ticket.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{fontSize:15,color:'#374151',lineHeight:1.75,margin:0,whiteSpace:'pre-wrap'}}>
                      {ticket.description}
                    </p>
                  </div>

                  {/* AI analysis */}
                  {ticket.ai_summary && (
                    <div style={{background:BLACK,borderRadius:14,padding:'16px 18px',marginBottom:12}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <Sparkles size={14} color={TEAL}/>
                        <span style={{fontSize:13,fontWeight:800,color:TEAL}}>AI Triage</span>
                        {ticket.ai_sentiment && <span style={{fontSize:18,marginLeft:'auto'}}>{SENT_EMOJI[ticket.ai_sentiment]||''}</span>}
                      </div>
                      <p style={{fontSize:14,color:'#999999',lineHeight:1.7,margin:'0 0 10px'}}>
                        {ticket.ai_summary}
                      </p>
                      {ticket.ai_suggested_response && (
                        <div style={{background:'rgba(255,255,255,.07)',borderRadius:10,padding:'12px 14px',
                          border:'1px solid rgba(255,255,255,.1)'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                            <span style={{fontSize:13,fontWeight:800,color:'#999999',
                              textTransform:'uppercase',letterSpacing:'.06em'}}>Suggested response</span>
                            <button onClick={()=>{
                              // This will be picked up by ReplyBox via a custom event trick
                              const e = new CustomEvent('use-reply',{detail:ticket.ai_suggested_response})
                              window.dispatchEvent(e)
                              toast.success('Copied to reply box')
                            }} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',
                              borderRadius:8,border:'none',background:TEAL,color:'#fff',
                              fontSize:13,fontWeight:700,cursor:'pointer'}}>
                              <Copy size={10}/> Use this
                            </button>
                          </div>
                          <p style={{fontSize:13,color:'#999999',lineHeight:1.7,margin:0}}>
                            {ticket.ai_suggested_response}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Replies */}
                  {replies.map(r=>(
                    <div key={r.id} style={{
                      background:r.is_internal?'#fffbeb':r.author_type==='ai'?BLACK:'#fff',
                      borderRadius:14,border:'1px solid '+(r.is_internal?'#fde68a':'#e5e7eb'),
                      padding:'14px 18px',marginBottom:10}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                        <div style={{width:30,height:30,borderRadius:'50%',
                          background:r.author_type==='client'?'#6b7280':r.author_type==='ai'?TEAL:RED,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:13,fontWeight:900,color:'#fff',flexShrink:0}}>
                          {r.author_name[0].toUpperCase()}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:800,
                            color:r.author_type==='ai'?'#fff':'#111'}}>{r.author_name}</div>
                        </div>
                        {r.is_internal && (
                          <span style={{fontSize:13,fontWeight:700,color:'#d97706',
                            background:'#fef3c7',padding:'2px 8px',borderRadius:20}}>Internal</span>
                        )}
                        <span style={{fontSize:13,color:r.author_type==='ai'?'rgba(255,255,255,.4)':'#9ca3af'}}>
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p style={{fontSize:14,color:r.author_type==='ai'?'rgba(255,255,255,.75)':'#374151',
                        lineHeight:1.75,margin:0,whiteSpace:'pre-wrap'}}>{r.body}</p>
                    </div>
                  ))}

                  {/* Reply box */}
                  <ReplyBox
                    ticket={ticket}
                    replies={replies}
                    agents={agents}
                    agentMe={agentMe}
                    onSent={load}
                  />
                </>
              )}

              {/* ── ACTIVITY ── */}
              {tab==='activity' && activity.map((a,i)=>(
                <div key={a.id} style={{display:'flex',gap:12,marginBottom:14,alignItems:'flex-start'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
                    background:a.actor_type==='ai'?TEAL:a.actor_type==='system'?'#6b7280':RED,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:13,color:'#fff',fontWeight:800}}>
                    {a.actor_type==='ai'?'AI':a.actor_type==='system'?'⚙':a.actor_name[0].toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,color:'#111'}}>
                      <strong>{a.actor_name}</strong>{' '}
                      <span style={{color:'#374151'}}>{a.action.replace(/_/g,' ')}</span>
                      {a.detail&&<span style={{color:'#9ca3af'}}> — {a.detail}</span>}
                    </div>
                    <div style={{fontSize:13,color:'#9ca3af',marginTop:2}}>
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}

              {/* ── TIME LOGS ── */}
              {tab==='time' && (
                <div>
                  <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
                    padding:'18px 20px',marginBottom:16,
                    display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                    <div>
                      <div style={{fontSize:24,fontWeight:900,color:'#111'}}>{totalMins}m</div>
                      <div style={{fontSize:13,color:'#374151'}}>Total time</div>
                    </div>
                    <div>
                      <div style={{fontSize:24,fontWeight:900,color:'#16a34a'}}>${totalCost.toFixed(2)}</div>
                      <div style={{fontSize:13,color:'#374151'}}>Total cost</div>
                    </div>
                    <div>
                      <div style={{fontSize:24,fontWeight:900,color:TEAL}}>
                        {[...new Set(timeLogs.map(l=>l.agent_id))].filter(Boolean).length}
                      </div>
                      <div style={{fontSize:13,color:'#374151'}}>Agents</div>
                    </div>
                  </div>
                  {timeLogs.map(log=>(
                    <div key={log.id} style={{background:'#fff',borderRadius:12,
                      border:'1px solid #e5e7eb',padding:'14px 18px',marginBottom:8,
                      display:'flex',alignItems:'center',gap:14}}>
                      <div style={{width:34,height:34,borderRadius:'50%',background:RED,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:14,fontWeight:900,color:'#fff',flexShrink:0}}>
                        {log.agent_name[0].toUpperCase()}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:800,color:'#111'}}>{log.agent_name}</div>
                        <div style={{fontSize:13,color:'#9ca3af'}}>
                          {new Date(log.started_at).toLocaleString()}
                          {log.stopped_at&&' → '+new Date(log.stopped_at).toLocaleTimeString()}
                          {log.is_running&&<span style={{color:TEAL,fontWeight:700}}> · Running</span>}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:16,fontWeight:800,color:'#111'}}>
                          {log.is_running?<ElapsedTimer startedAt={log.started_at}/>:(log.minutes||0)+'m'}
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:'#16a34a'}}>
                          {log.hourly_rate>0?'$'+(log.cost||0).toFixed(2):'No rate'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{overflowY:'auto',padding:'20px',background:'#fff',borderLeft:'1px solid #e5e7eb'}}>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Status</div>
              <select value={ticket.status} onChange={e=>updateField('status',e.target.value)}
                style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px solid #e5e7eb',
                  fontSize:14,outline:'none',background:'#fff',color:'#111',fontFamily:'inherit'}}>
                {STATUS_OPTS.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Priority</div>
              <select value={ticket.priority} onChange={e=>updateField('priority',e.target.value)}
                style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px solid #e5e7eb',
                  fontSize:14,outline:'none',background:'#fff',color:'#111',fontFamily:'inherit'}}>
                {PRI_OPTS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Assigned Agent</div>
              <select value={ticket.assigned_agent_id||''}
                onChange={e=>updateField('assigned_agent_id',e.target.value||null)}
                style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px solid #e5e7eb',
                  fontSize:14,outline:'none',background:'#fff',color:'#111',fontFamily:'inherit'}}>
                <option value="">— Unassigned —</option>
                {agents.map(a=><option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
            </div>
            {ticket.ai_category && (
              <div style={{marginBottom:20,padding:'14px',background:'#f5f3ff',borderRadius:12,border:'1px solid #e9d5ff'}}>
                <div style={{fontSize:13,fontWeight:800,color:'#7c3aed',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>AI Classification</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  <span style={{fontSize:13,fontWeight:700,padding:'3px 10px',borderRadius:20,
                    background:'#7c3aed',color:'#fff',textTransform:'capitalize'}}>
                    {ticket.ai_category.replace(/_/g,' ')}
                  </span>
                  <span style={{fontSize:13,fontWeight:700,padding:'3px 10px',borderRadius:20,
                    background:'#f5f3ff',color:'#7c3aed',border:'1px solid #e9d5ff',textTransform:'capitalize'}}>
                    {ticket.ai_priority}
                  </span>
                </div>
              </div>
            )}
            <div style={{padding:'14px',background:'#f9fafb',borderRadius:12,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:13,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>Time & Cost</div>
              {[
                {label:'Time logged',value:totalMins+'m'},
                {label:'Cost',value:'$'+totalCost.toFixed(2)},
                {label:'Views',value:ticket.views||0},
                {label:'Replies',value:ticket.reply_count||0},
              ].map(row=>(
                <div key={row.label} style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:13,color:'#374151'}}>{row.label}</span>
                  <span style={{fontSize:13,fontWeight:800,color:'#111'}}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}