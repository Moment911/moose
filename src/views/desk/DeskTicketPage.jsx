"use client";
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Send, Clock, User, Tag, Sparkles,
  Play, Square, DollarSign, MessageSquare, AlertCircle,
  CheckCircle, Loader2, Edit2, Save, X, Lock, Users,
  Activity, Timer, Copy, ExternalLink
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { logActivity, startTimer, stopTimer, learnFromTicket } from '../../lib/moosedesk'
import { emailReplySent, emailTicketResolved } from '../../lib/deskEmail'
import toast from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLACK = '#0a0a0a'

const STATUS_OPTS = [
  {key:'new',label:'New'},{key:'open',label:'Open'},
  {key:'in_progress',label:'In Progress'},{key:'pending',label:'Pending'},
  {key:'waiting',label:'Waiting'},{key:'resolved',label:'Resolved'},
  {key:'closed',label:'Closed'},
]
const PRI_OPTS = [
  {key:'low',label:'Low ↓'},{key:'normal',label:'Normal →'},
  {key:'high',label:'High ↑'},{key:'urgent',label:'Urgent ⚡'},
  {key:'critical',label:'Critical 🔴'},
]
const SENT_EMOJI = {positive:'😊',neutral:'😐',negative:'😞',frustrated:'😤'}

function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.round((Date.now()-new Date(startedAt))/1000)), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  const h = Math.floor(elapsed/3600), m = Math.floor((elapsed%3600)/60), s = elapsed%60
  return <span>{h>0?h+'h ':''}{m>0?m+'m ':''}{s}s</span>
}

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
  const [reply,    setReply]    = useState('')
  const [internal, setInternal] = useState(false)
  const [sending,  setSending]  = useState(false)
  const [tab,      setTab]      = useState('thread')
  const [activeLog, setActiveLog] = useState(null)
  const [agentMe,  setAgentMe]  = useState(null)
  const [savingField, setSavingField] = useState(null)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [
      {data:t}, {data:rr}, {data:tl}, {data:ac}, {data:aa}
    ] = await Promise.all([
      supabase.from('desk_tickets').select('*').eq('id',id).single(),
      supabase.from('desk_replies').select('*').eq('ticket_id',id).order('created_at'),
      supabase.from('desk_time_logs').select('*').eq('ticket_id',id).order('started_at'),
      supabase.from('desk_activity').select('*').eq('ticket_id',id).order('created_at',{ascending:false}).limit(50),
      supabase.from('desk_agents').select('*').eq('agency_id',aid).eq('is_active',true),
    ])
    setTicket(t); setReplies(rr||[]); setTimeLogs(tl||[])
    setActivity(ac||[]); setAgents(aa||[])
    // Track view
    if (t) { supabase.from('desk_tickets').update({views:(t.views||0)+1}).eq('id',id) }
    // Find running timer
    const running = (tl||[]).find(l=>l.is_running)
    setActiveLog(running||null)
    // Find my agent record
    const me = (aa||[]).find(a=>a.email===user?.email)
    setAgentMe(me||null)
    setLoading(false)
  }

  async function sendReply() {
    if (!reply.trim()) return
    setSending(true)
    const { error } = await supabase.from('desk_replies').insert({
      ticket_id: id,
      author_id: user?.id, author_name: firstName||user?.email||'Agent',
      author_email: user?.email, author_type: internal?'agent':'agent',
      body: reply, is_internal: internal,
    })
    if (!error) {
      await supabase.from('desk_tickets').update({
        reply_count: (ticket.reply_count||0)+1,
        ...(ticket.status==='new'||ticket.status==='open' ? {status:'in_progress'} : {}),
        ...(!ticket.first_response_at ? {first_response_at:new Date().toISOString()} : {}),
        updated_at: new Date().toISOString(),
      }).eq('id',id)
      await logActivity(id,{name:firstName||'Agent',type:'agent'},
        'replied', internal?'Internal note added':'Reply sent to client')
      // Email notification
      const replyObj = { author_name:firstName||'Agent', author_type:'agent', body:reply, is_internal:internal }
      emailReplySent(ticket, replyObj).catch(console.warn)
      setReply(''); load()
    }
    setSending(false)
  }

  async function updateField(field, value) {
    setSavingField(field)
    const old = ticket[field]
    setTicket(t=>({...t,[field]:value}))
    await supabase.from('desk_tickets').update({[field]:value,updated_at:new Date().toISOString()}).eq('id',id)
    await logActivity(id,{name:firstName||'Agent',type:'agent'},
      field+'_changed', field.replace('_',' ')+' changed: '+old+' → '+value)
    setSavingField(null)
  }

  async function handleTimer() {
    if (activeLog) {
      await stopTimer(activeLog.id, '')
      await logActivity(id,{name:agentMe?.name||firstName||'Agent',type:'agent'},
        'time_stopped', 'Time tracking stopped')
      setActiveLog(null); load()
      toast.success('Timer stopped')
    } else {
      if (!agentMe) { toast.error('You are not set up as a desk agent'); return }
      const {data, error} = await startTimer(id, agentMe)
      if (error) { toast.error(error.message); return }
      setActiveLog(data)
      await logActivity(id,{name:agentMe.name,type:'agent'},'time_started','Time tracking started')
      toast.success('Timer started')
    }
  }

  async function resolveTicket(resolution) {
    await updateField('status','resolved')
    await supabase.from('desk_tickets').update({resolved_at:new Date().toISOString()}).eq('id',id)
    if (resolution && agentMe) await learnFromTicket(ticket, resolution, aid)
    emailTicketResolved(ticket).catch(console.warn)
    toast.success('Ticket resolved')
  }

  function copyAISuggestion() {
    if (ticket?.ai_suggested_response) {
      setReply(ticket.ai_suggested_response)
      toast.success('AI suggestion copied to reply box')
    }
  }

  if (loading) return (
    <div style={{display:'flex',height:'100vh'}}>
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
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
        <AlertCircle size={40} color={RED}/>
        <div style={{fontSize:18,fontWeight:800,color:'#111'}}>Ticket not found</div>
        <button onClick={()=>navigate('/desk')} style={{padding:'10px 24px',borderRadius:10,border:'none',background:RED,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
          Back to Desk
        </button>
      </div>
    </div>
  )

  const totalMins = timeLogs.reduce((s,l)=>s+(l.minutes||0),0)
  const totalCost = timeLogs.reduce((s,l)=>s+(l.cost||0),0)

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f4f4f5'}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Top bar */}
        <div style={{background:BLACK,padding:'14px 24px',flexShrink:0,
          display:'flex',alignItems:'center',gap:14}}>
          <button onClick={()=>navigate('/desk')}
            style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:9,
              border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',
              color:'rgba(255,255,255,.7)',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            <ChevronLeft size={14}/> All Tickets
          </button>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:13,fontWeight:800,color:TEAL}}>{ticket.ticket_number}</span>
              <h2 style={{fontSize:17,fontWeight:900,color:'#fff',margin:0,
                whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:500}}>
                {ticket.subject}
              </h2>
            </div>
            <div style={{fontSize:12,color:'rgba(255,255,255,.4)',marginTop:2}}>
              From {ticket.submitter_name} · {new Date(ticket.created_at).toLocaleString()}
            </div>
          </div>
          {/* Timer button */}
          <button onClick={handleTimer}
            style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:10,
              border:'none',background:activeLog?'#16a34a':TEAL,color:'#fff',
              fontSize:13,fontWeight:800,cursor:'pointer'}}>
            {activeLog ? (
              <><Square size={13}/> Stop · <ElapsedTimer startedAt={activeLog.started_at}/></>
            ) : (
              <><Play size={13}/> Start Timer</>
            )}
          </button>
          {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
            <button onClick={()=>resolveTicket('')}
              style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:10,
                border:'none',background:'#16a34a',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>
              <CheckCircle size={13}/> Resolve
            </button>
          )}
        </div>

        <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 320px',overflow:'hidden'}}>

          {/* Main content */}
          <div style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:'1px solid #e5e7eb'}}>

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

              {tab === 'thread' && (
                <>
                  {/* Original message */}
                  <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
                    padding:'18px 20px',marginBottom:14}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                      <div style={{width:34,height:34,borderRadius:'50%',background:RED,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:14,fontWeight:900,color:'#fff'}}>
                        {ticket.submitter_name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontSize:14,fontWeight:800,color:'#111'}}>{ticket.submitter_name}</div>
                        <div style={{fontSize:12,color:'#9ca3af'}}>{ticket.submitter_email}</div>
                      </div>
                      <div style={{marginLeft:'auto',fontSize:12,color:'#9ca3af'}}>
                        {new Date(ticket.created_at).toLocaleString()}
                      </div>
                    </div>
                    <p style={{fontSize:15,color:'#374151',lineHeight:1.75,margin:0,whiteSpace:'pre-wrap'}}>
                      {ticket.description}
                    </p>
                  </div>

                  {/* AI analysis card */}
                  {ticket.ai_summary && (
                    <div style={{background:BLACK,borderRadius:14,padding:'16px 18px',marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <Sparkles size={14} color={TEAL}/>
                        <span style={{fontSize:13,fontWeight:800,color:TEAL}}>AI Triage Analysis</span>
                        {ticket.ai_sentiment && (
                          <span style={{fontSize:18,marginLeft:'auto'}}>{SENT_EMOJI[ticket.ai_sentiment]||''}</span>
                        )}
                      </div>
                      <p style={{fontSize:14,color:'rgba(255,255,255,.75)',lineHeight:1.7,margin:'0 0 12px'}}>
                        {ticket.ai_summary}
                      </p>
                      {ticket.ai_suggested_response && (
                        <div style={{background:'rgba(255,255,255,.06)',borderRadius:10,padding:'12px 14px',
                          border:'1px solid rgba(255,255,255,.1)'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                            <span style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,.4)',textTransform:'uppercase',letterSpacing:'.06em'}}>
                              Suggested response
                            </span>
                            <button onClick={copyAISuggestion}
                              style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:8,
                                border:'none',background:TEAL,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                              <Copy size={10}/> Use this
                            </button>
                          </div>
                          <p style={{fontSize:13,color:'rgba(255,255,255,.6)',lineHeight:1.7,margin:0}}>
                            {ticket.ai_suggested_response}
                          </p>
                        </div>
                      )}
                      {ticket.ai_tags?.length > 0 && (
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>
                          {ticket.ai_tags.map((tg,i)=>(
                            <span key={i} style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,
                              background:'rgba(255,255,255,.1)',color:'rgba(255,255,255,.6)'}}>{tg}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Replies */}
                  {replies.map(r=>(
                    <div key={r.id} style={{
                      background:r.is_internal?'#fffbeb':r.author_type==='ai'?BLACK:'#fff',
                      borderRadius:14,border:'1px solid '+(r.is_internal?'#fde68a':r.author_type==='ai'?'rgba(255,255,255,.1)':'#e5e7eb'),
                      padding:'16px 18px',marginBottom:10}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                        <div style={{width:30,height:30,borderRadius:'50%',
                          background:r.author_type==='client'?'#6b7280':r.author_type==='ai'?TEAL:RED,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:12,fontWeight:900,color:'#fff'}}>
                          {r.author_name[0].toUpperCase()}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:800,
                            color:r.author_type==='ai'?'#fff':'#111'}}>{r.author_name}</div>
                        </div>
                        {r.is_internal && (
                          <span style={{fontSize:11,fontWeight:700,color:'#d97706',
                            background:'#fef3c7',padding:'2px 8px',borderRadius:20}}>Internal Note</span>
                        )}
                        <span style={{fontSize:12,color:r.author_type==='ai'?'rgba(255,255,255,.4)':'#9ca3af'}}>
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p style={{fontSize:14,color:r.author_type==='ai'?'rgba(255,255,255,.75)':'#374151',
                        lineHeight:1.75,margin:0,whiteSpace:'pre-wrap'}}>{r.body}</p>
                    </div>
                  ))}

                  {/* Reply box */}
                  <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',padding:'16px 18px',marginTop:14}}>
                    <div style={{display:'flex',gap:10,marginBottom:10}}>
                      <button onClick={()=>setInternal(false)}
                        style={{padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',
                          background:!internal?RED:'#f3f4f6',color:!internal?'#fff':'#374151',
                          fontSize:13,fontWeight:700}}>Reply to Client</button>
                      <button onClick={()=>setInternal(true)}
                        style={{padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',
                          background:internal?'#d97706':'#f3f4f6',color:internal?'#fff':'#374151',
                          fontSize:13,fontWeight:700}}>Internal Note</button>
                    </div>
                    <textarea value={reply} onChange={e=>setReply(e.target.value)}
                      rows={4} placeholder={internal?'Internal note (only visible to team)…':'Reply to '+ticket.submitter_name+'…'}
                      style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1.5px solid #e5e7eb',
                        fontSize:14,fontFamily:'inherit',lineHeight:1.65,outline:'none',
                        resize:'vertical',color:'#111',boxSizing:'border-box',
                        background:internal?'#fffbeb':'#fff'}}/>
                    <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
                      <button onClick={sendReply} disabled={sending||!reply.trim()}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'9px 20px',
                          borderRadius:10,border:'none',
                          background:internal?'#d97706':RED,color:'#fff',
                          fontSize:14,fontWeight:700,cursor:'pointer',opacity:!reply.trim()?.5:1}}>
                        {sending?<><Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> Sending…</>
                          :<><Send size={13}/> {internal?'Add Note':'Send Reply'}</>}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {tab === 'activity' && (
                <div>
                  {activity.map((a,i)=>(
                    <div key={a.id} style={{display:'flex',gap:12,marginBottom:14,alignItems:'flex-start'}}>
                      <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
                        background:a.actor_type==='ai'?TEAL:a.actor_type==='system'?'#6b7280':RED,
                        display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff',fontWeight:800}}>
                        {a.actor_type==='ai'?'AI':a.actor_type==='system'?'⚙':a.actor_name[0].toUpperCase()}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,color:'#111'}}>
                          <strong>{a.actor_name}</strong>{' '}
                          <span style={{color:'#374151'}}>{a.action.replace(/_/g,' ')}</span>
                          {a.detail && <span style={{color:'#9ca3af'}}> — {a.detail}</span>}
                        </div>
                        <div style={{fontSize:12,color:'#9ca3af',marginTop:2}}>
                          {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'time' && (
                <div>
                  <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',
                    padding:'18px 20px',marginBottom:16,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                    <div>
                      <div style={{fontSize:24,fontWeight:900,color:'#111'}}>{totalMins}m</div>
                      <div style={{fontSize:13,color:'#374151'}}>Total time logged</div>
                    </div>
                    <div>
                      <div style={{fontSize:24,fontWeight:900,color:'#16a34a'}}>${totalCost.toFixed(2)}</div>
                      <div style={{fontSize:13,color:'#374151'}}>Total cost</div>
                    </div>
                    <div>
                      <div style={{fontSize:24,fontWeight:900,color:TEAL}}>
                        {[...new Set(timeLogs.map(l=>l.agent_id))].filter(Boolean).length}
                      </div>
                      <div style={{fontSize:13,color:'#374151'}}>Agents involved</div>
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
                        <div style={{fontSize:12,color:'#9ca3af'}}>
                          {new Date(log.started_at).toLocaleString()}
                          {log.stopped_at && ' → '+new Date(log.stopped_at).toLocaleTimeString()}
                          {log.is_running && <span style={{color:TEAL,fontWeight:700}}> · Running now</span>}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:16,fontWeight:800,color:'#111'}}>
                          {log.is_running ? <ElapsedTimer startedAt={log.started_at}/> : (log.minutes||0)+'m'}
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:'#16a34a'}}>
                          {log.hourly_rate > 0 ? '$'+(log.cost||0).toFixed(2) : 'No rate set'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar — ticket details */}
          <div style={{overflowY:'auto',padding:'20px',background:'#fff',borderLeft:'1px solid #e5e7eb'}}>

            {/* Status */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Status</div>
              <select value={ticket.status}
                onChange={e=>updateField('status',e.target.value)}
                style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px solid #e5e7eb',
                  fontSize:14,outline:'none',background:'#fff',color:'#111',fontFamily:'inherit'}}>
                {STATUS_OPTS.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Priority</div>
              <select value={ticket.priority}
                onChange={e=>updateField('priority',e.target.value)}
                style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px solid #e5e7eb',
                  fontSize:14,outline:'none',background:'#fff',color:'#111',fontFamily:'inherit'}}>
                {PRI_OPTS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>

            {/* Assign agent */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Assigned Agent</div>
              <select value={ticket.assigned_agent_id||''}
                onChange={e=>updateField('assigned_agent_id',e.target.value||null)}
                style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px solid #e5e7eb',
                  fontSize:14,outline:'none',background:'#fff',color:'#111',fontFamily:'inherit'}}>
                <option value="">— Unassigned —</option>
                {agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* AI info */}
            {ticket.ai_category && (
              <div style={{marginBottom:20,padding:'14px',background:'#f5f3ff',borderRadius:12,border:'1px solid #e9d5ff'}}>
                <div style={{fontSize:11,fontWeight:800,color:'#7c3aed',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>
                  AI Classification
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  <span style={{fontSize:12,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#7c3aed',color:'#fff',textTransform:'capitalize'}}>
                    {ticket.ai_category.replace(/_/g,' ')}
                  </span>
                  <span style={{fontSize:12,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#f5f3ff',color:'#7c3aed',border:'1px solid #e9d5ff',textTransform:'capitalize'}}>
                    {ticket.ai_priority}
                  </span>
                </div>
              </div>
            )}

            {/* Time summary */}
            <div style={{padding:'14px',background:'#f9fafb',borderRadius:12,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:11,fontWeight:800,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>Time & Cost</div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:13,color:'#374151'}}>Time logged</span>
                <span style={{fontSize:13,fontWeight:800,color:'#111'}}>{totalMins}m</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:13,color:'#374151'}}>Cost</span>
                <span style={{fontSize:13,fontWeight:800,color:'#16a34a'}}>${totalCost.toFixed(2)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:13,color:'#374151'}}>Views</span>
                <span style={{fontSize:13,fontWeight:800,color:'#111'}}>{ticket.views||0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}