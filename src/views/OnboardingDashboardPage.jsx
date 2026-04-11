"use client"
import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle, Clock, Send, AlertCircle, RefreshCw,
  Loader2, Users, Mail, Copy, Search, Plus, X,
  ChevronDown, ChevronUp, Lock, ExternalLink, Filter,
  FileText, Eye, Sparkles
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const RED   = '#E6007E'
const TEAL  = '#00C2CB'
const BLK = '#111111'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const REQUIRED_FIELDS = [
  { key:'first_name',           label:'First Name',                step:1  },
  { key:'last_name',            label:'Last Name',                 step:1  },
  { key:'phone',                label:'Primary Phone',             step:1  },
  { key:'email',                label:'Email',                     step:1  },
  { key:'contact_consent',      label:'Contact Preference',        step:1  },
  { key:'business_name',        label:'Business Name',             step:2  },
  { key:'industry',             label:'Industry',                  step:2  },
  { key:'address',              label:'Street Address',            step:2  },
  { key:'city',                 label:'City',                      step:2  },
  { key:'state',                label:'State',                     step:2  },
  { key:'business_description', label:'Business Description',      step:2  },
  { key:'products_services',    label:'Products & Services',       step:3  },
  { key:'top_services',         label:'Top Services',              step:3  },
  { key:'service_pricing_model',label:'Pricing Model',             step:3  },
  { key:'customer_types',       label:'Customer Types',            step:4  },
  { key:'ideal_customer_desc',  label:'Ideal Customer Description',step:4  },
  { key:'customer_pain_points', label:'Customer Pain Points',      step:4  },
  { key:'customer_lifestyle',   label:'Customer Lifestyle',        step:4  },
  { key:'why_choose_you',       label:'Why Choose You',            step:5  },
  { key:'unique_value_prop',    label:'Unique Value Proposition',  step:5  },
  { key:'primary_city',         label:'Primary Market',            step:6  },
  { key:'growth_scope',         label:'Growth Scope',              step:6  },
  { key:'logo_url',             label:'Logo File Link',            step:7  },
  { key:'brand_tone',           label:'Brand Tone',                step:7  },
  { key:'brand_primary_color',  label:'Primary Brand Color',       step:7  },
  { key:'google_biz_url',       label:'Google Business Profile',   step:8  },
  { key:'ga4_id',               label:'Google Analytics 4 ID',     step:9  },
  { key:'primary_goal',         label:'Primary Marketing Goal',    step:12 },
  { key:'budget_for_agency',    label:'Monthly Budget',            step:12 },
]

// Treat a value as present when it's a non-empty string or non-empty array.
function hasVal(v) {
  if (v === null || v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  return String(v).trim().length > 0
}

// Some REQUIRED_FIELDS keys don't map 1:1 to real client columns —
// business_name is stored in clients.name, first_name / last_name are
// derived from owner_name, business_description spills into notes or
// onboarding_answers, etc. This function checks dedicated columns first
// and then falls back to the onboarding_answers jsonb.
function getMissing(client) {
  if (!client) return REQUIRED_FIELDS.map(f => ({ ...f }))
  const answers = client.onboarding_answers || client.onboarding_data || {}

  return REQUIRED_FIELDS.filter(f => {
    // 1. Dedicated column on the clients row
    if (hasVal(client[f.key])) return false

    // 2. Spillover jsonb (set by the onboarding autosave action)
    if (hasVal(answers[f.key])) return false

    // 3. Field-specific fallbacks — tolerant of schema drift
    if (f.key === 'business_name' && hasVal(client.name)) return false
    if (f.key === 'business_description' && (hasVal(client.notes) || hasVal(client.welcome_statement))) return false
    if (f.key === 'first_name' && hasVal(client.owner_name)) return false
    if (f.key === 'last_name' && client.owner_name?.includes?.(' ')) return false
    if (f.key === 'primary_city' && hasVal(client.city)) return false
    if (f.key === 'primary_goal' && hasVal(client.notes)) return false

    return true
  })
}

function pct(client) {
  const miss = getMissing(client)
  return Math.round(((REQUIRED_FIELDS.length - miss.length) / REQUIRED_FIELDS.length) * 100)
}

const STATUS_CFG = {
  complete:  { label:'Complete',  color:GREEN,      bg:'#f0fdf4', icon:CheckCircle  },
  sent:      { label:'Link Sent', color:TEAL,        bg:'#f0fbfc', icon:Send         },
  not_sent:  { label:'Not Sent',  color:'#9ca3af',   bg:'#f9fafb', icon:Clock        },
  bounced:   { label:'Bounced',   color:RED,         bg:'#fef2f2', icon:AlertCircle  },
}

// ── Send-to-client modal ────────────────────────────────────────────────────
function SendModal({ allClients, agencyId, onClose, onSent }) {
  const [query,    setQuery]    = useState('')
  const [selected, setSelected] = useState(null)
  const [sending,  setSending]  = useState(false)
  const [copied,   setCopied]   = useState(false)
  const [result,   setResult]   = useState(null)   // { url, token }
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const matches = query.length > 0
    ? allClients.filter(c =>
        c.name?.toLowerCase().includes(query.toLowerCase()) ||
        c.email?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  async function send() {
    if (!selected) return
    setSending(true)
    try {
      const res  = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_link', client_id: selected.id, agency_id: agencyId }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setSending(false); return }
      setResult({ url: data.onboarding_url, token: data.token })
      toast.success(`Onboarding link sent to ${selected.name} ✓`)
      onSent(selected.id, data.token)
    } catch (e) { toast.error(e.message) }
    setSending(false)
  }

  async function copyOnly() {
    if (!selected) return
    setSending(true)
    try {
      const res  = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_link', client_id: selected.id, agency_id: agencyId }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setSending(false); return }
      navigator.clipboard.writeText(data.onboarding_url)
      setResult({ url: data.onboarding_url, token: data.token })
      setCopied(true)
      toast.success('Link copied — paste it anywhere')
      onSent(selected.id, data.token)
    } catch (e) { toast.error(e.message) }
    setSending(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:520, padding:28, boxShadow:'0 24px 80px rgba(0,0,0,.25)' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK }}>Send Onboarding Link</div>
            <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginTop:2 }}>Find a client, send email + copy the link</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={18}/></button>
        </div>

        {/* Client search */}
        {!result && (
          <>
            <div style={{ position:'relative', marginBottom: matches.length > 0 || query ? 0 : 16 }}>
              <Search size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null) }}
                placeholder="Type client name or email…"
                style={{ width:'100%', padding:'12px 14px 12px 38px', borderRadius:11, border:`1.5px solid ${selected ? RED : '#e5e7eb'}`, fontSize:14, fontFamily:FB, outline:'none', boxSizing:'border-box' }}
              />
            </div>

            {/* Autocomplete dropdown */}
            {matches.length > 0 && !selected && (
              <div style={{ border:'1px solid #e5e7eb', borderTop:'none', borderRadius:'0 0 11px 11px', overflow:'hidden', marginBottom:16 }}>
                {matches.map(cl => (
                  <button key={cl.id} onClick={() => { setSelected(cl); setQuery(cl.name) }}
                    style={{ width:'100%', textAlign:'left', padding:'11px 16px', borderBottom:'1px solid #f9fafb', background:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{cl.name}</div>
                      <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{cl.email || 'No email'}</div>
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, background:STATUS_CFG[cl.onboarding_status||'not_sent']?.bg, color:STATUS_CFG[cl.onboarding_status||'not_sent']?.color, fontFamily:FH }}>
                      {STATUS_CFG[cl.onboarding_status||'not_sent']?.label}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected client card */}
            {selected && (
              <div style={{ background:'#f9fafb', borderRadius:12, border:`2px solid ${RED}30`, padding:'14px 16px', marginTop:10, marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:BLK }}>{selected.name}</div>
                    <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>{selected.email || 'No email on file'}</div>
                  </div>
                  <button onClick={() => { setSelected(null); setQuery('') }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={14}/></button>
                </div>
                {!selected.email && (
                  <div style={{ marginTop:8, fontSize:12, color:AMBER, fontWeight:600, fontFamily:FH }}>
                    ⚠️ No email — you can still copy the link and send it manually
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={send}
                disabled={!selected || sending || !selected.email}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'13px', borderRadius:11, border:'none', background:selected&&selected.email?RED:'#f3f4f6', color:selected&&selected.email?'#fff':'#9ca3af', fontSize:14, fontWeight:700, cursor:selected&&selected.email?'pointer':'default', fontFamily:FH }}>
                {sending ? <Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> : <Send size={15}/>}
                {sending ? 'Sending…' : 'Send Email + Copy Link'}
              </button>
              <button
                onClick={copyOnly}
                disabled={!selected || sending}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'13px 18px', borderRadius:11, border:`1.5px solid ${selected?'#e5e7eb':'#f3f4f6'}`, background:'#fff', color:selected?BLK:'#d1d5db', fontSize:14, fontWeight:700, cursor:selected?'pointer':'default', fontFamily:FH }}>
                <Copy size={15}/> Link Only
              </button>
            </div>

            {selected && !selected.email && (
              <div style={{ marginTop:10, fontSize:12, color:'#6b7280', fontFamily:FB, textAlign:'center' }}>
                "Link Only" will generate a token and copy the link so you can text or paste it manually
              </div>
            )}
          </>
        )}

        {/* Success state */}
        {result && (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'#f0fdf4', border:`2px solid ${GREEN}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <CheckCircle size={26} color={GREEN}/>
            </div>
            <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK, marginBottom:6 }}>Link ready for {selected?.name}</div>
            <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, marginBottom:18 }}>Email sent. The link below never expires — they can return anytime.</div>

            <div style={{ background:'#f9fafb', borderRadius:11, border:'1px solid #e5e7eb', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ flex:1, fontFamily:'monospace', fontSize:12, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{result.url}</div>
              <button onClick={() => { navigator.clipboard.writeText(result.url); toast.success('Copied!'); setCopied(true) }}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'none', background:copied?GREEN:RED, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, flexShrink:0 }}>
                {copied ? <CheckCircle size={11}/> : <Copy size={11}/>}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setResult(null); setSelected(null); setQuery(''); setCopied(false) }}
                style={{ flex:1, padding:'11px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                Send Another
              </button>
              <button onClick={onClose}
                style={{ flex:1, padding:'11px', borderRadius:10, border:'none', background:BLK, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function OnboardingDashboardPage() {
  const { agencyId }  = useAuth()
  const navigate      = useNavigate()
  // Filter + search persisted in URL so refreshes / back-nav keep state
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = searchParams.get('filter') || 'all'
  const search = searchParams.get('q') || ''
  const setFilter = (v) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev)
    if (v === 'all') p.delete('filter'); else p.set('filter', v)
    return p
  }, { replace: true })
  const setSearch = (v) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev)
    if (!v) p.delete('q'); else p.set('q', v)
    return p
  }, { replace: true })

  const [clients,     setClients]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [sending,     setSending]     = useState({})
  const [expanded,    setExpanded]    = useState({})
  const [showSend,    setShowSend]    = useState(false)

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
    if (!client.email) { toast.error(`${client.name} has no email — use "Send New Link" to copy manually`); return }
    setSending(s => ({ ...s, [client.id]: true }))
    const res  = await fetch('/api/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_link', client_id: client.id, agency_id: agencyId }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error) }
    else {
      toast.success(`Onboarding link sent to ${client.name} ✓`)
      setClients(prev => prev.map(c => c.id === client.id
        ? { ...c, onboarding_status: c.onboarding_status === 'complete' ? 'complete' : 'sent', onboarding_sent_at: new Date().toISOString(), onboarding_token: data.token }
        : c
      ))
    }
    setSending(s => ({ ...s, [client.id]: false }))
  }

  function copyLink(client) {
    // The OnboardingPage resolver accepts the bare client id as the token,
    // so this works even when the client has never had a separate
    // onboarding_tokens row generated (common for clients created via the
    // convert-from-Scout flow).
    const url = `${window.location.origin}/onboard/${client.id}`
    navigator.clipboard.writeText(url)
    toast.success('Onboarding link copied!')
  }

  function handleModalSent(clientId, token) {
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, onboarding_status: c.onboarding_status === 'complete' ? 'complete' : 'sent', onboarding_sent_at: new Date().toISOString(), onboarding_token: token }
      : c
    ))
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
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#F9F9F9' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'18px 28px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:9 }}>
                <Users size={18} color={TEAL}/> Client Onboarding
              </div>
              <div style={{ fontSize:12, color:'#6b7280', margin:'3px 0 0', fontFamily:FB }}>
                Send links, track completion, view profiles — {completionRate}% complete
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {/* ★ KEY BUTTON — Send New Link ★ */}
              <button onClick={() => setShowSend(true)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, boxShadow:`0 2px 12px ${RED}50` }}>
                <Plus size={14}/> Send New Link
              </button>
              <button onClick={load}
                style={{ padding:'9px 10px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', cursor:'pointer' }}>
                <RefreshCw size={13}/>
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
            {[
              { key:'all',      label:'Total Clients',  color:BLK  },
              { key:'complete', label:'Completed',       color:GREEN },
              { key:'sent',     label:'Link Sent',       color:TEAL  },
              { key:'not_sent', label:'Not Sent',        color:AMBER },
            ].map(s => (
              <button key={s.key} onClick={() => setFilter(s.key)}
                style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${filter===s.key?s.color:'#f3f4f6'}`, padding:'14px 16px', textAlign:'center', cursor:'pointer' }}>
                <div style={{ fontFamily:FH, fontSize:26, fontWeight:900, color:s.color, letterSpacing:'-.03em', lineHeight:1 }}>{counts[s.key]}</div>
                <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginTop:4 }}>{s.label}</div>
              </button>
            ))}
          </div>

          {/* Search + filter */}
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <div style={{ position:'relative', flex:1 }}>
              <Search size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search clients by name or email…"
                style={{ width:'100%', padding:'10px 14px 10px 34px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
            </div>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'10px 14px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                <X size={12}/> Clear Filter
              </button>
            )}
          </div>

          {/* Bulk send banner */}
          {counts.not_sent > 0 && (
            <div style={{ background:`${AMBER}12`, borderRadius:12, border:`1px solid ${AMBER}30`, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:'#92400e' }}>
                {counts.not_sent} client{counts.not_sent>1?'s have':'has'} not received an onboarding link
              </div>
              <button onClick={async () => {
                const unsent = clients.filter(c => (!c.onboarding_status||c.onboarding_status==='not_sent') && c.email)
                for (const cl of unsent) await sendLink(cl)
                toast.success(`Sent to ${unsent.length} clients ✓`)
              }}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'none', background:AMBER, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                <Send size={12}/> Send All Now
              </button>
            </div>
          )}

          {/* Client table */}
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'48px 0' }}>
              <Loader2 size={24} color={TEAL} style={{ animation:'spin 1s linear infinite' }}/>
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              {/* Table header */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 130px 260px', gap:12, padding:'10px 18px', borderBottom:'1px solid #f3f4f6', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.06em' }}>
                <span>Client</span><span>Fields</span><span>Status</span><span>Actions</span>
              </div>

              {filtered.length === 0 && (
                <div style={{ padding:'40px 24px', textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:14 }}>
                  {search || filter !== 'all' ? 'No clients match your filter' : 'No clients yet — add clients first, then send onboarding links'}
                </div>
              )}

              {filtered.map(cl => {
                const status     = cl.onboarding_status || 'not_sent'
                const cfg        = STATUS_CFG[status] || STATUS_CFG.not_sent
                const Icon       = cfg.icon
                const isSending  = sending[cl.id]
                // `cl` is the full client row since the status API now
                // spreads `...c, profile: c`. Compute completion against
                // the client row + onboarding_answers fallback.
                const missing    = getMissing(cl)
                const completion = pct(cl)
                const isExpanded = expanded[cl.id]

                return (
                  <div key={cl.id} style={{ borderBottom:'1px solid #f9fafb' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 130px 260px', gap:12, padding:'13px 18px', alignItems:'center' }}>

                      {/* Client info + progress bar */}
                      <div>
                        <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{cl.name}</div>
                        <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, marginBottom:5 }}>
                          {cl.email || <span style={{ fontStyle:'italic' }}>No email</span>}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ flex:1, maxWidth:160, height:5, background:'#f3f4f6', borderRadius:10, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${completion}%`, background:completion===100?GREEN:completion>60?TEAL:AMBER, borderRadius:10, transition:'width .3s' }}/>
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, color:completion===100?GREEN:completion>60?TEAL:'#92400e', fontFamily:FH }}>{completion}%</span>
                          {missing.length > 0 && (
                            <button type="button" onClick={() => setExpanded(e => ({ ...e, [cl.id]: !e[cl.id] }))}
                              style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6, border:'1px solid #fde68a', background:'#fffbeb', color:'#92400e', cursor:'pointer', fontFamily:FH }}>
                              {missing.length} missing {isExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                        {cl.onboarding_completed_at && (
                          <div style={{ fontSize:11, color:GREEN, fontFamily:FB, marginTop:2 }}>
                            ✓ Completed {new Date(cl.onboarding_completed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                          </div>
                        )}
                        {cl.onboarding_sent_at && status !== 'complete' && (
                          <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginTop:2 }}>
                            Sent {new Date(cl.onboarding_sent_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                          </div>
                        )}
                      </div>

                      {/* Field count */}
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontFamily:FH, fontSize:15, fontWeight:800, color:completion===100?GREEN:AMBER }}>
                          {REQUIRED_FIELDS.length - missing.length}/{REQUIRED_FIELDS.length}
                        </div>
                        <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FB }}>fields</div>
                      </div>

                      {/* Status badge */}
                      <div>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:20, background:cfg.bg, color:cfg.color, fontFamily:FH }}>
                          <Icon size={11}/> {cfg.label}
                        </span>
                      </div>

                      {/* Actions */}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {/* Send / Resend */}
                        <button onClick={() => sendLink(cl)} disabled={isSending || !cl.email}
                          title={!cl.email ? 'No email — use Send New Link button' : status === 'sent' ? 'Resend link' : 'Send link'}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'none', background:cl.email?RED:'#f3f4f6', color:cl.email?'#fff':'#9ca3af', fontSize:11, fontWeight:700, cursor:cl.email?'pointer':'default', fontFamily:FH }}>
                          {isSending ? <Loader2 size={10} style={{ animation:'spin 1s linear infinite' }}/> : <Send size={10}/>}
                          {isSending ? 'Sending…' : status === 'sent' || status === 'complete' ? 'Resend' : 'Send'}
                        </button>

                        {/* Copy link */}
                        {cl.onboarding_token && (
                          <button onClick={() => copyLink(cl)}
                            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                            <Copy size={10}/> Link
                          </button>
                        )}

                        {/* View profile */}
                        <button onClick={() => navigate(`/clients/${cl.id}`)}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                          <Eye size={10}/> Profile
                        </button>
                      </div>
                    </div>

                    {/* Voice onboarding line — show if client has a provisioned number */}
                    {cl.onboarding_phone && (
                      <div style={{ padding:'0 18px 10px', fontSize:11, color:'#6b7280', fontFamily:FB, display:'flex', alignItems:'center', gap:6 }}>
                        📞 {cl.onboarding_phone_display || cl.onboarding_phone}
                        {cl.onboarding_pin && (
                          <>
                            <span style={{ color:'#d1d5db' }}>·</span>
                            PIN: <strong style={{ color:BLK, fontFamily:'monospace' }}>{cl.onboarding_pin}</strong>
                          </>
                        )}
                      </div>
                    )}

                    {/* Missing fields panel */}
                    {isExpanded && missing.length > 0 && (
                      <div style={{ padding:'10px 18px 16px', borderTop:'1px solid #f9fafb', background:'#fffbeb' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#92400e', fontFamily:FH, marginBottom:8 }}>
                          📋 Call {cl.name?.split(' ')[0]} to collect these missing fields:
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                          {missing.map(m => (
                            <span key={m.key} style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', fontFamily:FH, fontWeight:600 }}>
                              Step {m.step}: {m.label}
                            </span>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <button onClick={() => sendLink(cl)} disabled={isSending || !cl.email}
                            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'none', background:cl.email?RED:'#e5e7eb', color:cl.email?'#fff':'#9ca3af', fontSize:12, fontWeight:700, cursor:cl.email?'pointer':'default', fontFamily:FH }}>
                            <Send size={11}/> Resend Link
                          </button>
                          {cl.onboarding_token && (
                            <button onClick={() => copyLink(cl)}
                              style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                              <Copy size={11}/> Copy Link
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Send Modal */}
      {showSend && (
        <SendModal
          allClients={clients}
          agencyId={agencyId}
          onClose={() => setShowSend(false)}
          onSent={handleModalSent}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
