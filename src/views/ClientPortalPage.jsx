"use client"
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, CheckCircle, AlertCircle, FileText, MessageSquare, Star, Globe, Clock, ChevronRight, Send, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

const RED  = '#ea2729'
const TEAL = '#5bc6d0'
const BLK  = '#0a0a0a'
const FH   = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB   = "'Raleway','Helvetica Neue',sans-serif"

export default function ClientPortalPage() {
  const { token } = useParams()
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [client,   setClient]   = useState(null)
  const [session,  setSession]  = useState(null)
  const [tab,      setTab]      = useState('overview')
  const [projects, setProjects] = useState([])
  const [reviews,  setReviews]  = useState([])
  const [tickets,  setTickets]  = useState([])
  const [showTicket,setShowTicket] = useState(false)
  const [ticketForm, setTicketForm] = useState({ subject:'', message:'', email:'' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { validateToken() }, [token])

  async function validateToken() {
    try {
      const res = await fetch('/api/client-portal', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'validate', token }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Invalid link'); setLoading(false); return }
      setClient(data.client)
      setSession(data.session)
      loadClientData(data.client.id)
    } catch (e) { setError('Failed to validate link'); setLoading(false) }
  }

  async function loadClientData(clientId) {
    const [projRes, revRes, ticketRes] = await Promise.all([
      supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', {ascending:false}),
      supabase.from('reviews').select('rating,review_text,reviewer_name,review_date,is_responded').eq('client_id', clientId).order('review_date',{ascending:false}).limit(10),
      supabase.from('desk_tickets').select('id,subject,status,created_at,priority').eq('client_id', clientId).order('created_at',{ascending:false}).limit(10),
    ])
    setProjects(projRes.data || [])
    setReviews(revRes.data || [])
    setTickets(ticketRes.data || [])
    setLoading(false)
  }

  async function submitTicket() {
    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) { toast.error('Subject and message required'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('desk_tickets').insert({
        client_id: client.id,
        subject:   ticketForm.subject,
        body:      ticketForm.message,
        status:    'new',
        priority:  'normal',
        submitter_email: ticketForm.email || session?.email || '',
        submitter_name:  client.name,
        source:    'client_portal',
      })
      if (error) throw error
      toast.success('Ticket submitted!')
      setShowTicket(false)
      setTicketForm({ subject:'', message:'', email:'' })
      loadClientData(client.id)
    } catch (e) { toast.error('Failed: ' + e.message) }
    setSubmitting(false)
  }

  const avgRating = reviews.length ? (reviews.filter(r=>r.rating).reduce((s,r)=>s+r.rating,0) / reviews.filter(r=>r.rating).length).toFixed(1) : null

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f2f2f0', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:16, background:RED+'15', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <Loader2 size={28} color={RED} style={{animation:'spin 1s linear infinite'}}/>
        </div>
        <div style={{ fontFamily:FH, fontSize:16, color:'#374151' }}>Loading your portal…</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', background:'#f2f2f0', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'40px', textAlign:'center', maxWidth:400 }}>
        <AlertCircle size={44} color={RED} style={{ margin:'0 auto 16px' }}/>
        <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, marginBottom:8 }}>Link Invalid</div>
        <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB }}>{error}</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f2f2f0' }}>
      <Toaster position="top-right"/>

      {/* Header */}
      <div style={{ background:BLK, padding:'0 28px' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ padding:'20px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:11, background:RED, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FH, fontSize:18, fontWeight:900, color:'#fff' }}>
                {client?.name?.[0]?.toUpperCase() || 'K'}
              </div>
              <div>
                <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-.02em' }}>{client?.name}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', fontFamily:FB }}>Client Portal</div>
              </div>
            </div>
            <button onClick={()=>setShowTicket(true)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
              <MessageSquare size={13}/> Submit Request
            </button>
          </div>
          <div style={{ display:'flex', gap:0, marginTop:16 }}>
            {[
              { key:'overview',  label:'Overview'  },
              { key:'projects',  label:`Projects (${projects.length})`  },
              { key:'reviews',   label:`Reviews${avgRating?' ★'+avgRating:''}`   },
              { key:'tickets',   label:`Tickets (${tickets.length})`   },
            ].map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{ padding:'11px 18px', border:'none', background:'transparent', borderBottom:`2.5px solid ${tab===t.key?RED:'transparent'}`, color:tab===t.key?'#fff':'rgba(255,255,255,.35)', fontSize:13, fontWeight:tab===t.key?700:500, cursor:'pointer', fontFamily:FH }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'24px 28px' }}>

        {tab==='overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
            {[
              { label:'Active Projects', value:projects.filter(p=>p.status!=='closed').length, color:TEAL, icon:FileText },
              { label:'Open Tickets',    value:tickets.filter(t=>!['resolved','closed'].includes(t.status)).length, color:'#f59e0b', icon:MessageSquare },
              { label:'Avg Review',      value:avgRating?'★'+avgRating:'—', color:'#f59e0b', icon:Star },
            ].map((s,i)=>(
              <div key={i} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'20px' }}>
                <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>{s.label}</div>
                <div style={{ fontFamily:FH, fontSize:32, fontWeight:900, color:s.color, letterSpacing:'-.03em' }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {tab==='projects' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {projects.length===0 ? (
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB }}>No projects yet</div>
            ) : projects.map(p=>(
              <div key={p.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:TEAL+'20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <FileText size={18} color={TEAL}/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:700, color:BLK }}>{p.name}</div>
                  <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>{p.type} · {p.status}</div>
                </div>
                <div style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20,
                  background:p.status==='active'?'#f0fdf4':p.status==='closed'?'#f3f4f6':'#fffbeb',
                  color:p.status==='active'?'#16a34a':p.status==='closed'?'#6b7280':'#d97706', fontFamily:FH }}>
                  {p.status}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='reviews' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {reviews.length===0 ? (
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB }}>No reviews yet</div>
            ) : reviews.map((r,i)=>(
              <div key={i} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ color:'#f59e0b', fontSize:14 }}>{'★'.repeat(r.rating||0)}{'☆'.repeat(5-(r.rating||0))}</span>
                  <span style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{r.reviewer_name||'Anonymous'}</span>
                  {r.is_responded && <span style={{ fontSize:11, fontWeight:700, padding:'1px 7px', borderRadius:20, background:'#f0fdf4', color:'#16a34a', fontFamily:FH }}>✓ Responded</span>}
                  <span style={{ fontSize:11, color:'#9ca3af', marginLeft:'auto' }}>{r.review_date?new Date(r.review_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}</span>
                </div>
                <div style={{ fontSize:14, color:'#374151', lineHeight:1.65, fontFamily:FB }}>{r.review_text||'(No text)'}</div>
              </div>
            ))}
          </div>
        )}

        {tab==='tickets' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button onClick={()=>setShowTicket(true)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 18px', borderRadius:12, border:`1.5px dashed ${RED}`, background:RED+'08', color:RED, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, marginBottom:4 }}>
              <MessageSquare size={16}/> Submit a new request
            </button>
            {tickets.length===0 ? (
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB }}>No tickets yet</div>
            ) : tickets.map(t=>(
              <div key={t.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'14px 20px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{t.subject}</div>
                  <div style={{ fontSize:12, color:'#9ca3af', marginTop:3 }}>{new Date(t.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                </div>
                <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, fontFamily:FH,
                  background:t.status==='resolved'?'#f0fdf4':t.status==='new'?'#f5f3ff':'#fffbeb',
                  color:t.status==='resolved'?'#16a34a':t.status==='new'?'#7c3aed':'#d97706' }}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New ticket modal */}
      {showTicket && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:20 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:'28px', width:'100%', maxWidth:500 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK }}>Submit a Request</div>
              <button onClick={()=>setShowTicket(false)} style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af' }}><X size={20}/></button>
            </div>
            {[
              { label:'Your Email', field:'email', placeholder:'your@email.com', type:'email' },
              { label:'Subject',    field:'subject', placeholder:'What do you need help with?' },
            ].map(f=>(
              <div key={f.field} style={{ marginBottom:14 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>{f.label}</label>
                <input value={ticketForm[f.field]} onChange={e=>setTicketForm(prev=>({...prev,[f.field]:e.target.value}))}
                  type={f.type||'text'} placeholder={f.placeholder}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', boxSizing:'border-box' }}
                  onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>
            ))}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Message</label>
              <textarea value={ticketForm.message} onChange={e=>setTicketForm(prev=>({...prev,message:e.target.value}))}
                placeholder="Describe your request in detail…" rows={5}
                style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }}
                onFocus={e=>e.target.style.borderColor=RED} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
            </div>
            <button onClick={submitTicket} disabled={submitting}
              style={{ width:'100%', padding:'12px', borderRadius:11, border:'none', background:RED, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {submitting?<Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/>:<Send size={16}/>}
              {submitting?'Submitting…':'Submit Request'}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
