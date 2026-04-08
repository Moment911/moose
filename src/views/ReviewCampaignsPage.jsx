"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Star, Send, Plus, Users, Mail, MessageSquare, BarChart2,
  CheckCircle, Clock, AlertCircle, Loader2, Trash2, Edit2,
  Copy, X, Upload, ArrowRight, RefreshCw, Sparkles,
  ChevronDown, ChevronUp, ExternalLink, Eye, Phone
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ClientSearchSelect from '../components/ClientSearchSelect'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import { useClient } from '../context/ClientContext'
import toast from 'react-hot-toast'

const RED   = '#E6007E'
const TEAL  = '#00C2CB'
const BLK = '#111111'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const STATUS_CFG = {
  pending:       { label: 'Pending',       color: '#6b7280', bg: '#f3f4f6' },
  sent:          { label: 'Sent',          color: '#3b82f6', bg: '#eff6ff' },
  opened:        { label: 'Opened',        color: AMBER,     bg: '#fffbeb' },
  clicked:       { label: 'Clicked',       color: GREEN,     bg: '#f0fdf4' },
  bounced:       { label: 'Bounced',       color: RED,       bg: '#fef2f2' },
  unsubscribed:  { label: 'Unsubscribed',  color: '#9ca3af', bg: '#f9fafb' },
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #f3f4f6', padding:'14px 16px', textAlign:'center' }}>
      {Icon && <Icon size={16} color={color||'#9ca3af'} style={{ margin:'0 auto 6px', display:'block' }}/>}
      <div style={{ fontFamily:FH, fontSize:24, fontWeight:900, color:color||BLK, letterSpacing:'-.03em', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginTop:3 }}>{label}</div>
    </div>
  )
}

export default function ReviewCampaignsPage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const { selectedClient } = useClient()

  const [clientId,   setClientId]   = useState('')
  const [clientObj,  setClientObj]  = useState(null)
  const [campaigns,  setCampaigns]  = useState([])
  const [loading,    setLoading]    = useState(false)
  const [activeTab,  setActiveTab]  = useState('campaigns')
  const [showNew,    setShowNew]    = useState(false)
  const [activeCamp, setActiveCamp] = useState(null)
  const [contacts,   setContacts]   = useState([])
  const [sending,    setSending]    = useState(false)
  const [generating, setGenerating] = useState(false)

  // New campaign form
  const [form, setForm] = useState({
    name: '', channel: 'email', subject: '',
    message_email: '', message_sms: '',
    review_url: '', send_delay_days: 1,
  })

  // Contact import
  const [contactInput, setContactInput] = useState('')
  const [parsedContacts, setParsedContacts] = useState([])

  useEffect(() => { if (selectedClient) { setClientId(selectedClient.id); setClientObj(selectedClient) } }, [selectedClient])
  useEffect(() => { if (clientId) loadCampaigns() }, [clientId])

  async function loadCampaigns() {
    setLoading(true)
    const res  = await fetch(`/api/reviews/campaign?client_id=${clientId}&agency_id=${agencyId}`)
    const data = await res.json()
    setCampaigns(data.campaigns || [])
    setLoading(false)
  }

  async function loadContacts(campaignId) {
    const res  = await fetch('/api/reviews/campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'contacts', campaign_id: campaignId, client_id: clientId, agency_id: agencyId }),
    })
    const data = await res.json()
    setContacts(data.contacts || [])
  }

  async function generateMessage(channel) {
    if (!clientId) return
    setGenerating(true)
    const res  = await fetch('/api/reviews/campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_message', client_id: clientId, agency_id: agencyId, channel }),
    })
    const data = await res.json()
    if (data.message) {
      if (channel === 'email') setForm(f => ({ ...f, message_email: data.message }))
      else setForm(f => ({ ...f, message_sms: data.message }))
      toast.success('Message generated ✓')
    }
    setGenerating(false)
  }

  async function createCampaign() {
    if (!form.name || !form.review_url) { toast.error('Name and Review URL required'); return }
    const res  = await fetch('/api/reviews/campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', client_id: clientId, agency_id: agencyId, ...form }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); return }
    toast.success('Campaign created ✓')
    setShowNew(false)
    setForm({ name:'', channel:'email', subject:'', message_email:'', message_sms:'', review_url:'', send_delay_days:1 })
    await loadCampaigns()
    setActiveCamp(data.campaign)
    setActiveTab('contacts')
    setContacts([])
  }

  async function sendCampaign(campaignId) {
    setSending(true)
    const res  = await fetch('/api/reviews/campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', campaign_id: campaignId, client_id: clientId, agency_id: agencyId }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); setSending(false); return }
    toast.success(`Sent to ${data.sent} contacts ✓`)
    await loadCampaigns()
    await loadContacts(campaignId)
    setSending(false)
  }

  // Parse pasted contacts (Name, Email, Phone - CSV or line-by-line)
  function parseContacts(text) {
    const lines = text.trim().split('\n').filter(Boolean)
    const parsed = lines.map(line => {
      const parts = line.split(/[,\t]+/).map(p => p.trim())
      const emailPart = parts.find(p => p.includes('@'))
      const phonePart = parts.find(p => /[\d\-\(\)\+]{10,}/.test(p.replace(/\D/g,'')))
      const namePart  = parts.find(p => p !== emailPart && p !== phonePart) || parts[0]
      return { name: namePart || 'Customer', email: emailPart || null, phone: phonePart || null }
    }).filter(c => c.name && (c.email || c.phone))
    setParsedContacts(parsed)
    return parsed
  }

  async function addContacts() {
    if (!activeCamp || parsedContacts.length === 0) return
    const res  = await fetch('/api/reviews/campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_contacts', campaign_id: activeCamp.id, client_id: clientId, agency_id: agencyId, contacts: parsedContacts }),
    })
    const data = await res.json()
    toast.success(`Added ${data.added} contacts ✓`)
    setParsedContacts([])
    setContactInput('')
    await loadContacts(activeCamp.id)
  }

  async function deleteCampaign(id) {
    await fetch('/api/reviews/campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', campaign_id: id }),
    })
    setCampaigns(prev => prev.filter(c => c.id !== id))
    if (activeCamp?.id === id) setActiveCamp(null)
    toast.success('Deleted')
  }

  const activeContacts = contacts.filter(c => c.status !== 'unsubscribed')
  const openRate  = contacts.length ? Math.round(contacts.filter(c => ['opened','clicked'].includes(c.status)).length / Math.max(contacts.filter(c => c.status !== 'pending').length, 1) * 100) : 0
  const clickRate = contacts.length ? Math.round(contacts.filter(c => c.status === 'clicked').length / Math.max(contacts.filter(c => c.status !== 'pending').length, 1) * 100) : 0

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#F9F9F9' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'18px 28px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:9 }}>
                <Star size={18} color={AMBER} fill={AMBER}/> Review Campaigns
              </div>
              <div style={{ fontSize:12, color:'#999999', margin:'3px 0 0', fontFamily:FB }}>
                Send review requests via email & SMS — track opens, clicks, and conversions
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <ClientSearchSelect value={clientId} onChange={(id,cl)=>{setClientId(id);setClientObj(cl)}} minWidth={200}/>
              {clientId && (
                <button onClick={()=>{setShowNew(true);setActiveCamp(null)}}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, boxShadow:`0 2px 10px ${RED}50` }}>
                  <Plus size={13}/> New Campaign
                </button>
              )}
            </div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {[
              { key:'campaigns', label:'Campaigns',        icon:Star    },
              { key:'contacts',  label:'Contacts & Send',  icon:Users   },
              { key:'analytics', label:'Analytics',        icon:BarChart2 },
            ].map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'9px 14px', borderRadius:'8px 8px 0 0', border:'none', background:active?'#F9F9F9':'transparent', color:active?BLK:'rgba(255,255,255,.45)', fontSize:12, fontWeight:active?700:500, cursor:'pointer', fontFamily:FH }}>
                  <Icon size={12}/> {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>

          {!clientId && (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'56px 24px', textAlign:'center' }}>
              <Star size={40} color="#e5e7eb" style={{ margin:'0 auto 14px', display:'block' }}/>
              <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, marginBottom:8 }}>Select a client to manage review campaigns</div>
              <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB }}>Campaigns are built per-client and use their branding</div>
            </div>
          )}

          {/* ── CAMPAIGNS TAB ─────────────────────────────────────────── */}
          {clientId && activeTab === 'campaigns' && (
            <div>
              {/* New campaign form */}
              {showNew && (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'22px 24px', marginBottom:20 }}>
                  <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK, marginBottom:16, display:'flex', justifyContent:'space-between' }}>
                    New Campaign
                    <button onClick={()=>setShowNew(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={15}/></button>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                    <div>
                      <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:5 }}>Campaign Name *</label>
                      <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                        placeholder="Post-Service Review Request"
                        style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
                    </div>
                    <div>
                      <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:5 }}>Google Review URL *</label>
                      <input value={form.review_url} onChange={e=>setForm(f=>({...f,review_url:e.target.value}))}
                        placeholder="https://g.page/r/xxxxx/review"
                        style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
                    </div>
                  </div>

                  {/* Channel selector */}
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:8 }}>Channel</label>
                    <div style={{ display:'flex', gap:8 }}>
                      {[['email','Email','✉️'],['sms','SMS','💬'],['both','Email + SMS','📲']].map(([val,label,icon]) => (
                        <button key={val} onClick={()=>setForm(f=>({...f,channel:val}))}
                          style={{ flex:1, padding:'10px', borderRadius:10, border:`2px solid ${form.channel===val?RED:'#e5e7eb'}`, background:form.channel===val?RED+'10':'#fff', cursor:'pointer', fontFamily:FH, fontSize:12, fontWeight:form.channel===val?700:400, color:form.channel===val?RED:'#374151' }}>
                          {icon} {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Email */}
                  {(form.channel === 'email' || form.channel === 'both') && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                        <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK }}>Email Subject</label>
                      </div>
                      <input value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}
                        placeholder="How was your experience with us?"
                        style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box', marginBottom:8 }}/>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                        <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK }}>Email Message</label>
                        <button onClick={()=>generateMessage('email')} disabled={generating}
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:7, border:`1px solid ${TEAL}40`, background:`${TEAL}10`, color:TEAL, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                          {generating?<Loader2 size={10} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={10}/>} AI Write
                        </button>
                      </div>
                      <textarea value={form.message_email} onChange={e=>setForm(f=>({...f,message_email:e.target.value}))}
                        rows={5} placeholder="Hi [NAME], thank you for choosing us..."
                        style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', resize:'vertical', boxSizing:'border-box', lineHeight:1.7 }}/>
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:4, fontFamily:FB }}>Use [NAME] for customer's first name · [REVIEW_LINK] for the review URL (auto-inserted if omitted)</div>
                    </div>
                  )}

                  {/* SMS */}
                  {(form.channel === 'sms' || form.channel === 'both') && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                        <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK }}>SMS Message ({form.message_sms.length}/160)</label>
                        <button onClick={()=>generateMessage('sms')} disabled={generating}
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:7, border:`1px solid ${TEAL}40`, background:`${TEAL}10`, color:TEAL, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                          {generating?<Loader2 size={10} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={10}/>} AI Write
                        </button>
                      </div>
                      <textarea value={form.message_sms} onChange={e=>setForm(f=>({...f,message_sms:e.target.value.slice(0,160)}))}
                        rows={3} placeholder="Hi [NAME]! Thanks for choosing us. We'd love your review: [REVIEW_LINK]"
                        style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', resize:'none', boxSizing:'border-box' }}/>
                    </div>
                  )}

                  <button onClick={createCampaign}
                    style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                    Create Campaign →
                  </button>
                </div>
              )}

              {/* Campaign list */}
              {campaigns.length === 0 && !showNew ? (
                <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'48px 24px', textAlign:'center' }}>
                  <Star size={36} color="#e5e7eb" style={{ margin:'0 auto 12px', display:'block' }}/>
                  <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK, marginBottom:6 }}>No campaigns yet</div>
                  <div style={{ fontSize:13, color:'#9ca3af', fontFamily:FB, marginBottom:16 }}>Create your first review request campaign for {clientObj?.name}</div>
                  <button onClick={()=>setShowNew(true)}
                    style={{ padding:'10px 24px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                    <Plus size={13} style={{ display:'inline', marginRight:5 }}/> New Campaign
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {campaigns.map(camp => (
                    <div key={camp.id} onClick={()=>{setActiveCamp(camp);setActiveTab('contacts');loadContacts(camp.id)}}
                      style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${activeCamp?.id===camp.id?RED:'#e5e7eb'}`, padding:'16px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:camp.status==='active'?GREEN+'15':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {camp.channel==='sms'?<MessageSquare size={18} color={camp.status==='active'?GREEN:'#9ca3af'}/>:<Mail size={18} color={camp.status==='active'?GREEN:'#9ca3af'}/>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{camp.name}</div>
                        <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginTop:2 }}>
                          {camp.channel} · {camp.total_sent} sent · {camp.total_clicked} clicked
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:camp.status==='active'?GREEN+'15':'#f3f4f6', color:camp.status==='active'?GREEN:'#6b7280', fontFamily:FH }}>
                          {camp.status}
                        </span>
                        <button onClick={e=>{e.stopPropagation();deleteCampaign(camp.id)}}
                          style={{ padding:'5px 7px', borderRadius:7, border:'1px solid #fecaca', background:'#fef2f2', color:RED, cursor:'pointer' }}>
                          <Trash2 size={11}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CONTACTS & SEND TAB ───────────────────────────────────── */}
          {clientId && activeTab === 'contacts' && (
            <div>
              {!activeCamp ? (
                <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
                  Select a campaign from the Campaigns tab first
                </div>
              ) : (
                <div>
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK }}>{activeCamp.name}</div>
                      <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{activeCamp.channel} · {contacts.length} contacts</div>
                    </div>
                    <button onClick={()=>sendCampaign(activeCamp.id)} disabled={sending||contacts.filter(c=>c.status==='pending').length===0}
                      style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 20px', borderRadius:10, border:'none', background:contacts.filter(c=>c.status==='pending').length>0?RED:'#f3f4f6', color:contacts.filter(c=>c.status==='pending').length>0?'#fff':'#9ca3af', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, boxShadow:contacts.filter(c=>c.status==='pending').length>0?`0 2px 10px ${RED}50`:'none' }}>
                      {sending?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<Send size={13}/>}
                      {sending?'Sending…':`Send to ${contacts.filter(c=>c.status==='pending').length} Pending`}
                    </button>
                  </div>

                  {/* Add contacts */}
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 18px', marginBottom:16 }}>
                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:800, color:BLK, marginBottom:10 }}>Add Contacts</div>
                    <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginBottom:8 }}>
                      Paste names, emails, and/or phone numbers — one per line or comma-separated.<br/>
                      Format: Name, email@example.com, (555) 555-5555
                    </div>
                    <textarea value={contactInput} onChange={e=>{setContactInput(e.target.value);parseContacts(e.target.value)}}
                      rows={4} placeholder={"John Smith, john@email.com, 555-555-5555\nJane Doe, jane@email.com\nBob Johnson, 555-123-4567"}
                      style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:'monospace', outline:'none', resize:'vertical', boxSizing:'border-box', marginBottom:10 }}/>
                    {parsedContacts.length > 0 && (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                        <div style={{ fontSize:13, color:GREEN, fontFamily:FH, fontWeight:700 }}>
                          <CheckCircle size={13} style={{ display:'inline', marginRight:4 }}/> {parsedContacts.length} contacts ready to import
                        </div>
                        <button onClick={addContacts}
                          style={{ padding:'7px 16px', borderRadius:8, border:'none', background:GREEN, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                          Add {parsedContacts.length} Contacts →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Contacts table */}
                  {contacts.length > 0 && (
                    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                      <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6', display:'grid', gridTemplateColumns:'1fr 1fr 1fr 100px', gap:12, fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.06em' }}>
                        <span>Name</span><span>Contact</span><span>Sent</span><span>Status</span>
                      </div>
                      {contacts.map(c => {
                        const cfg = STATUS_CFG[c.status] || STATUS_CFG.pending
                        return (
                          <div key={c.id} style={{ padding:'11px 16px', borderBottom:'1px solid #f9fafb', display:'grid', gridTemplateColumns:'1fr 1fr 1fr 100px', gap:12, alignItems:'center' }}>
                            <div style={{ fontFamily:FH, fontSize:13, fontWeight:600, color:BLK }}>{c.name}</div>
                            <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>
                              {c.email && <div><Mail size={10} style={{ display:'inline', marginRight:3 }}/>{c.email}</div>}
                              {c.phone && <div><Phone size={10} style={{ display:'inline', marginRight:3 }}/>{c.phone}</div>}
                            </div>
                            <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>
                              {c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'}
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, background:cfg.bg, color:cfg.color, fontFamily:FH, display:'inline-block' }}>
                              {cfg.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ANALYTICS TAB ─────────────────────────────────────────── */}
          {clientId && activeTab === 'analytics' && (
            <div>
              {campaigns.length === 0 ? (
                <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
                  No campaigns yet — create one to see analytics
                </div>
              ) : (
                <div>
                  {/* Overall stats */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
                    <StatCard label="Total Sent"    value={campaigns.reduce((s,c)=>s+c.total_sent,0)}    icon={Send}      color={TEAL}/>
                    <StatCard label="Total Opened"  value={campaigns.reduce((s,c)=>s+c.total_opened,0)}  icon={Eye}       color={AMBER}/>
                    <StatCard label="Total Clicked" value={campaigns.reduce((s,c)=>s+c.total_clicked,0)} icon={Star}      color={GREEN}/>
                    <StatCard label="Campaigns"     value={campaigns.length}                               icon={BarChart2} color={RED}/>
                  </div>

                  {/* Per-campaign breakdown */}
                  <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                    <div style={{ padding:'14px 18px', borderBottom:'1px solid #f3f4f6', fontFamily:FH, fontSize:14, fontWeight:800, color:BLK }}>Campaign Performance</div>
                    {campaigns.map(camp => {
                      const sent = camp.total_sent || 0
                      const open  = sent ? Math.round(camp.total_opened / sent * 100) : 0
                      const click = sent ? Math.round(camp.total_clicked / sent * 100) : 0
                      return (
                        <div key={camp.id} style={{ padding:'14px 18px', borderBottom:'1px solid #f9fafb', display:'grid', gridTemplateColumns:'1fr 80px 80px 80px 80px', gap:12, alignItems:'center' }}>
                          <div>
                            <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{camp.name}</div>
                            <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{camp.channel}</div>
                          </div>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:TEAL }}>{sent}</div>
                            <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FB }}>Sent</div>
                          </div>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:AMBER }}>{open}%</div>
                            <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FB }}>Opened</div>
                          </div>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:GREEN }}>{click}%</div>
                            <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FB }}>Clicked</div>
                          </div>
                          <div style={{ textAlign:'center' }}>
                            <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20, background:camp.status==='active'?GREEN+'15':'#f3f4f6', color:camp.status==='active'?GREEN:'#6b7280', fontFamily:FH }}>
                              {camp.status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
