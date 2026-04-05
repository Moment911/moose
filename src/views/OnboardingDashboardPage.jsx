"use client"
import { useState, useEffect } from 'react'
import {
  CheckCircle, Clock, Send, AlertCircle, RefreshCw,
  Loader2, Users, Mail, ArrowRight, ExternalLink, Copy
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const STATUS_CFG = {
  complete:  { label: 'Complete',   color: GREEN,  bg: '#f0fdf4', icon: CheckCircle },
  sent:      { label: 'Link Sent',  color: TEAL,   bg: '#f0fbfc', icon: Send        },
  not_sent:  { label: 'Not Sent',   color: '#9ca3af', bg: '#f9fafb', icon: Clock   },
  bounced:   { label: 'Bounced',    color: RED,    bg: '#fef2f2', icon: AlertCircle },
}

export default function OnboardingDashboardPage() {
  const { agencyId } = useAuth()
  const [clients,  setClients]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState({})
  const [filter,   setFilter]   = useState('all')
  const [search,   setSearch]   = useState('')

  useEffect(() => { if (agencyId) load() }, [agencyId])

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', agency_id: agencyId }),
    })
    const data = await res.json()
    setClients(data.clients || [])
    setLoading(false)
  }

  async function sendLink(client) {
    if (!client.email) { toast.error(`${client.name} has no email address`); return }
    setSending(s => ({ ...s, [client.id]: true }))
    const res  = await fetch('/api/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_link', client_id: client.id, agency_id: agencyId }),
    })
    const data = await res.json()
    if (data.error) {
      toast.error(data.error)
    } else {
      toast.success(`Onboarding email sent to ${client.name} ✓`)
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, onboarding_status: 'sent', onboarding_sent_at: new Date().toISOString() } : c))
    }
    setSending(s => ({ ...s, [client.id]: false }))
  }

  async function copyLink(client) {
    if (!client.onboarding_token) {
      // Send first to generate token
      await sendLink(client)
      return
    }
    const url = `${window.location.origin}/onboarding/${client.onboarding_token}`
    navigator.clipboard.writeText(url)
    toast.success('Onboarding link copied!')
  }

  const filtered = clients.filter(c => {
    if (filter !== 'all' && (c.onboarding_status || 'not_sent') !== filter) return false
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = {
    all:      clients.length,
    complete: clients.filter(c => c.onboarding_status === 'complete').length,
    sent:     clients.filter(c => c.onboarding_status === 'sent').length,
    not_sent: clients.filter(c => !c.onboarding_status || c.onboarding_status === 'not_sent').length,
  }

  const completionRate = clients.length ? Math.round(counts.complete / clients.length * 100) : 0

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f2f2f0' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:BLK, padding:'20px 28px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:9 }}>
                <Users size={18} color={TEAL}/> Client Onboarding
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.35)', margin:'3px 0 0', fontFamily:FB }}>
                Track and send onboarding links — completions auto-configure the CMO agent
              </div>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              {/* Completion rate */}
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:FH, fontSize:24, fontWeight:900, color:completionRate===100?GREEN:TEAL }}>{completionRate}%</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', fontFamily:FB }}>completed</div>
              </div>
              <button onClick={load} style={{ padding:'8px 10px', borderRadius:9, border:'1px solid rgba(255,255,255,.1)', background:'transparent', color:'rgba(255,255,255,.5)', cursor:'pointer' }}>
                <RefreshCw size={13}/>
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
            {[
              { key:'all',      label:'Total Clients', color:BLK   },
              { key:'complete', label:'Completed',     color:GREEN  },
              { key:'sent',     label:'Link Sent',     color:TEAL   },
              { key:'not_sent', label:'Not Sent',      color:AMBER  },
            ].map(s => (
              <button key={s.key} onClick={()=>setFilter(s.key)}
                style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${filter===s.key?s.color:'#f3f4f6'}`, padding:'14px 16px', textAlign:'center', cursor:'pointer', transition:'all .15s' }}>
                <div style={{ fontFamily:FH, fontSize:26, fontWeight:900, color:s.color, letterSpacing:'-.03em', lineHeight:1 }}>{counts[s.key]}</div>
                <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginTop:4 }}>{s.label}</div>
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ marginBottom:16 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search clients…"
              style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
          </div>

          {/* Send all not-sent */}
          {counts.not_sent > 0 && (
            <div style={{ background:`${AMBER}12`, borderRadius:12, border:`1px solid ${AMBER}30`, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#92400e' }}>
                {counts.not_sent} client{counts.not_sent>1?'s have':'has'} not received an onboarding link yet
              </div>
              <button onClick={async ()=>{
                const unsent = clients.filter(c=>(!c.onboarding_status||c.onboarding_status==='not_sent')&&c.email)
                for (const cl of unsent) await sendLink(cl)
                toast.success(`Sent to ${unsent.length} clients ✓`)
              }}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'none', background:AMBER, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                <Send size={12}/> Send All Now
              </button>
            </div>
          )}

          {/* Clients list */}
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'48px 0' }}>
              <Loader2 size={24} color={TEAL} style={{ animation:'spin 1s linear infinite' }}/>
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 200px 160px 180px', gap:12, padding:'10px 18px', borderBottom:'1px solid #f3f4f6', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.06em' }}>
                <span>Client</span><span>Email</span><span>Status</span><span>Actions</span>
              </div>
              {filtered.length === 0 && (
                <div style={{ padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>No clients found</div>
              )}
              {filtered.map(cl => {
                const status = cl.onboarding_status || 'not_sent'
                const cfg = STATUS_CFG[status] || STATUS_CFG.not_sent
                const Icon = cfg.icon
                const isSending = sending[cl.id]
                return (
                  <div key={cl.id} style={{ display:'grid', gridTemplateColumns:'1fr 200px 160px 180px', gap:12, padding:'13px 18px', borderBottom:'1px solid #f9fafb', alignItems:'center' }}>
                    <div>
                      <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{cl.name}</div>
                      {cl.onboarding_completed_at && (
                        <div style={{ fontSize:11, color:GREEN, fontFamily:FB, marginTop:2 }}>
                          Completed {new Date(cl.onboarding_completed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                        </div>
                      )}
                      {cl.onboarding_sent_at && status !== 'complete' && (
                        <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginTop:2 }}>
                          Sent {new Date(cl.onboarding_sent_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {cl.email || <span style={{ color:'#d1d5db', fontStyle:'italic' }}>No email</span>}
                    </div>
                    <div>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:20, background:cfg.bg, color:cfg.color, fontFamily:FH }}>
                        <Icon size={11}/> {cfg.label}
                      </span>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {status !== 'complete' && (
                        <button onClick={()=>sendLink(cl)} disabled={isSending||!cl.email}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'none', background:cl.email?RED:'#f3f4f6', color:cl.email?'#fff':'#9ca3af', fontSize:11, fontWeight:700, cursor:cl.email?'pointer':'default', fontFamily:FH }}>
                          {isSending?<Loader2 size={10} style={{animation:'spin 1s linear infinite'}}/>:<Send size={10}/>}
                          {isSending?'Sending…':status==='sent'?'Resend':'Send'}
                        </button>
                      )}
                      {cl.onboarding_token && (
                        <button onClick={()=>copyLink(cl)}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                          <Copy size={10}/> Link
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
