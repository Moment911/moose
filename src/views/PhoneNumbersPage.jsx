"use client";
import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import {
  Phone, PhoneCall, Plus, Trash2, Edit2, Search, X, Loader2, RefreshCw,
  DollarSign, Hash, Calendar, Check, AlertTriangle
} from 'lucide-react'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
const W = '#ffffff'

const API = '/api/phone'

function fmt(num) {
  if (!num) return ''
  const d = num.replace(/\D/g,'')
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  return num
}

/* ── tiny reusable pieces ── */
const Badge = ({ label, color, bg }) => (
  <span style={{ fontSize:11, fontWeight:700, color, background:bg, padding:'2px 10px', borderRadius:999, textTransform:'uppercase', letterSpacing:.5 }}>{label}</span>
)

const statusColors = { active:{c:W,bg:GRN}, suspended:{c:BLK,bg:AMB}, released:{c:'#555',bg:'#e5e7eb'}, pending:{c:'#555',bg:'#e5e7eb'} }
const statusColor = s => statusColors[s] || { c:'#555', bg:'#e5e7eb' }

const typeColors = { local:{c:'#1d4ed8',bg:'#dbeafe'}, tollfree:{c:'#7c3aed',bg:'#ede9fe'}, mobile:{c:'#0891b2',bg:'#cffafe'} }
const purposeColors = { voice:{c:'#1d4ed8',bg:'#dbeafe'}, sms:{c:'#059669',bg:'#d1fae5'}, both:{c:'#7c3aed',bg:'#ede9fe'}, answering:{c:R,bg:'#fee2e2'}, outbound:{c:'#b45309',bg:'#fef3c7'} }

const StatPill = ({ label, value, color }) => (
  <div style={{ display:'flex', alignItems:'center', gap:6, background:`${color}18`, padding:'3px 10px', borderRadius:999, fontSize:12 }}>
    <span style={{ fontWeight:700, color }}>{value}</span>
    <span style={{ color:'#6b7280' }}>{label}</span>
  </div>
)

const Btn = ({ children, onClick, bg=R, color=W, small, disabled, style:sx }) => (
  <button disabled={disabled} onClick={onClick} style={{ fontFamily:FH, fontSize:small?12:13, fontWeight:600, padding:small?'5px 12px':'8px 18px', background:disabled?'#ccc':bg, color, border:'none', borderRadius:8, cursor:disabled?'default':'pointer', display:'inline-flex', alignItems:'center', gap:6, transition:'opacity .15s', ...sx }}>{children}</button>
)

const Card = ({ children, style:sx }) => (
  <div style={{ background:W, borderRadius:12, border:'1px solid #e5e7eb', padding:20, ...sx }}>{children}</div>
)

const StatCard = ({ icon:Icon, label, value, color=T, sub }) => (
  <Card style={{ flex:1, minWidth:160 }}>
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
      <div style={{ width:32, height:32, borderRadius:8, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon size={16} color={color} /></div>
      <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5, fontFamily:FH }}>{label}</span>
    </div>
    <div style={{ fontSize:24, fontWeight:700, color:BLK, fontFamily:FH }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{sub}</div>}
  </Card>
)

const Modal = ({ title, onClose, children }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{ background:W, borderRadius:16, width:520, maxHeight:'85vh', overflow:'auto', padding:28 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h3 style={{ margin:0, fontFamily:FH, fontSize:18, fontWeight:700 }}>{title}</h3>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
)

const TabBar = ({ tabs, active, onChange }) => (
  <div style={{ display:'flex', gap:2, background:'#e5e7eb', borderRadius:10, padding:3, marginBottom:20 }}>
    {tabs.map(t => (
      <button key={t.key} onClick={()=>onChange(t.key)} style={{ flex:1, padding:'8px 12px', fontSize:12, fontWeight:600, fontFamily:FH, border:'none', borderRadius:8, cursor:'pointer', background:active===t.key?W:'transparent', color:active===t.key?BLK:'#888', transition:'all .15s', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
        {t.icon && <t.icon size={14} />}{t.label}
      </button>
    ))}
  </div>
)

const TABS = [
  { key:'numbers', label:'My Numbers', icon:Phone },
  { key:'buy', label:'Buy Numbers', icon:Plus },
  { key:'billing', label:'Billing', icon:DollarSign },
]

/* ══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                         */
/* ══════════════════════════════════════════════════════════════════════════ */
export default function PhoneNumbersPage() {
  const { agencyId: authAgencyId, isSuperAdmin } = useAuth()
  const aid = authAgencyId || '00000000-0000-0000-0000-000000000099'

  const [tab, setTab] = useState('numbers')
  const [loading, setLoading] = useState(false)

  // Data
  const [numbers, setNumbers] = useState([])
  const [stats, setStats] = useState({ total:0, active:0, monthly_cost:0, last_purchased:null })
  const [available, setAvailable] = useState([])
  const [agencyNames, setAgencyNames] = useState({})
  const [clientNames, setClientNames] = useState({})

  // Search / filter
  const [areaCode, setAreaCode] = useState('')
  const [searchType, setSearchType] = useState('local')
  const [searchProvider, setSearchProvider] = useState('telnyx')
  const [searching, setSearching] = useState(false)
  const [buying, setBuying] = useState(null)
  const [providers, setProviders] = useState(null)

  // Edit modal
  const [editModal, setEditModal] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPurpose, setEditPurpose] = useState('voice')

  // Confirm release
  const [releaseConfirm, setReleaseConfirm] = useState(null)

  /* ── LOAD DATA ── */
  useEffect(() => { loadAll() }, [aid])

  const loadAll = async () => {
    setLoading(true)
    try {
      const listParams = `action=list&agency_id=${aid}`
      const [numsRes, statsRes, provRes] = await Promise.all([
        fetch(`${API}?${listParams}`).then(r => r.json()),
        fetch(`${API}?action=stats&agency_id=${aid}`).then(r => r.json()),
        fetch(`${API}?action=providers`).then(r => r.json()),
      ])
      if (Array.isArray(numsRes)) {
        setNumbers(numsRes)
        // Fetch agency and client names for display
        const agIds = [...new Set(numsRes.map(n => n.agency_id).filter(Boolean))]
        const clIds = [...new Set(numsRes.map(n => n.client_id).filter(Boolean))]
        if (agIds.length > 0) {
          fetch(`/api/billing?action=get_all_agencies_billing`).then(r => r.json()).then(data => {
            if (Array.isArray(data)) {
              const map = {}
              data.forEach(a => { map[a.agency_id] = a.agencies?.brand_name || a.agencies?.name || a.agency_id?.slice(0, 8) })
              setAgencyNames(map)
            }
          }).catch(() => {})
        }
        if (clIds.length > 0) {
          // Simple client name lookup via supabase
          const params = clIds.map(id => `id=eq.${id}`).join(',')
          fetch(`/api/billing?action=get_client_pricing&agency_id=${aid}`).then(r => r.json()).then(() => {
            // Client names would need a dedicated endpoint; for now use ID prefix
            const map = {}
            clIds.forEach(id => { map[id] = `Client ${id.slice(0, 8)}...` })
            setClientNames(map)
          }).catch(() => {})
        }
      }
      if (statsRes && !statsRes.error) setStats(statsRes)
      if (provRes && !provRes.error) setProviders(provRes)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  /* ── SEARCH AVAILABLE ── */
  const searchAvailable = async () => {
    setSearching(true)
    setAvailable([])
    try {
      const params = new URLSearchParams({ action:'available', type:searchType, provider:searchProvider })
      if (areaCode) params.set('area_code', areaCode)
      const res = await fetch(`${API}?${params}`).then(r => r.json())
      if (res.error) { toast.error(res.error); return }
      setAvailable(Array.isArray(res) ? res : [])
      if (Array.isArray(res) && res.length === 0) toast('No numbers found for that area code', { icon:'📞' })
    } catch (e) { toast.error('Search failed') }
    setSearching(false)
  }

  /* ── PURCHASE ── */
  const purchaseNumber = async (num) => {
    setBuying(num.phone_number)
    try {
      const res = await fetch(API, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'purchase', agency_id:aid, phone_number:num.phone_number, friendly_name:num.friendly_name || num.phone_number, type:searchType, provider: num.provider || searchProvider }),
      }).then(r => r.json())
      if (res.error) { toast.error(res.error); return }
      toast.success(`Purchased ${fmt(num.phone_number)}`)
      setAvailable(prev => prev.filter(n => n.phone_number !== num.phone_number))
      loadAll()
    } catch (e) { toast.error('Purchase failed') }
    setBuying(null)
  }

  /* ── RELEASE ── */
  const releaseNumber = async (id) => {
    try {
      const res = await fetch(API, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'release', phone_id:id }),
      }).then(r => r.json())
      if (res.error) { toast.error(res.error); return }
      toast.success('Number released')
      setReleaseConfirm(null)
      loadAll()
    } catch (e) { toast.error('Release failed') }
  }

  /* ── UPDATE ── */
  const updateNumber = async () => {
    if (!editModal) return
    try {
      const res = await fetch(API, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'update', phone_id:editModal.id, friendly_name:editName, purpose:editPurpose }),
      }).then(r => r.json())
      if (res.error) { toast.error(res.error); return }
      toast.success('Updated')
      setEditModal(null)
      loadAll()
    } catch (e) { toast.error('Update failed') }
  }

  /* ── TAB 1: MY NUMBERS ── */
  const renderNumbers = () => {
    const activeNums = numbers.filter(n => n.status !== 'released')
    return (
      <div>
        {/* Stats row */}
        <div style={{ display:'flex', gap:16, marginBottom:20, flexWrap:'wrap' }}>
          <StatCard icon={Hash} label="Total Numbers" value={stats.total} color={T} />
          <StatCard icon={Check} label="Active" value={stats.active} color={GRN} />
          <StatCard icon={DollarSign} label="Monthly Cost" value={`$${(stats.monthly_cost||0).toFixed(2)}`} color={R} />
          <StatCard icon={Calendar} label="Last Purchased" value={stats.last_purchased ? new Date(stats.last_purchased).toLocaleDateString() : 'Never'} color={AMB} />
        </div>

        {/* Table */}
        {numbers.length === 0 && !loading ? (
          <Card style={{ textAlign:'center', padding:48 }}>
            <Phone size={40} color="#ccc" style={{ marginBottom:12 }} />
            <div style={{ fontSize:16, fontWeight:600, color:'#6b7280', fontFamily:FH, marginBottom:4 }}>No phone numbers yet</div>
            <div style={{ fontSize:13, color:'#999', marginBottom:16 }}>Buy your first number to get started.</div>
            <Btn onClick={()=>setTab('buy')}><Plus size={14} /> Buy Number</Btn>
          </Card>
        ) : (
          <Card style={{ padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FB }}>
              <thead>
                <tr style={{ background:'#fafafa', borderBottom:'1px solid #e5e7eb' }}>
                  {['Phone Number','Friendly Name','Assigned To','Provider','Type','Purpose','Status','Cost/mo','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.04em', fontFamily:FH }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {numbers.map(n => {
                  const sc = statusColor(n.status)
                  const tc = typeColors[n.type] || typeColors.local
                  const pc = purposeColors[n.purpose] || purposeColors.voice
                  return (
                    <tr key={n.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                      <td style={{ padding:'10px 14px', fontWeight:600, color:BLK }}>{fmt(n.phone_number)}</td>
                      <td style={{ padding:'10px 14px', color:'#374151' }}>{n.friendly_name || '-'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <div style={{ width:6, height:6, borderRadius:'50%', background: n.client_id ? GRN : n.agency_id ? T : AMB, flexShrink:0 }} />
                            <span style={{ fontSize:12, fontWeight:600, color:BLK }}>
                              {n.client_id
                                ? (clientNames[n.client_id] || `Client ${n.client_id.slice(0,8)}...`)
                                : n.agency_id
                                  ? (agencyNames[n.agency_id] || `Agency ${n.agency_id.slice(0,8)}...`)
                                  : 'Koto Platform'}
                            </span>
                          </div>
                          <span style={{ fontSize:10, color:'#999', fontFamily:FH, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>
                            {n.client_id ? 'Client' : n.agency_id ? 'Agency' : 'Platform'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding:'10px 14px' }}><Badge label={n.provider || 'twilio'} color={n.provider === 'telnyx' ? '#16a34a' : '#1d4ed8'} bg={n.provider === 'telnyx' ? '#dcfce7' : '#dbeafe'} /></td>
                      <td style={{ padding:'10px 14px' }}><Badge label={n.type} color={tc.c} bg={tc.bg} /></td>
                      <td style={{ padding:'10px 14px' }}><Badge label={n.purpose} color={pc.c} bg={pc.bg} /></td>
                      <td style={{ padding:'10px 14px' }}><Badge label={n.status} color={sc.c} bg={sc.bg} /></td>
                      <td style={{ padding:'10px 14px', color:'#374151' }}>${Number(n.monthly_cost||0).toFixed(2)}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          {n.status !== 'released' && (
                            <>
                              <button onClick={()=>{ setEditModal(n); setEditName(n.friendly_name||''); setEditPurpose(n.purpose||'voice') }} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:6, padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#374151' }}>
                                <Edit2 size={12} /> Edit
                              </button>
                              <button onClick={()=>setReleaseConfirm(n)} style={{ background:'none', border:'1px solid #fee2e2', borderRadius:6, padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:12, color:R }}>
                                <Trash2 size={12} /> Release
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    )
  }

  /* ── TAB 2: BUY NUMBERS ── */
  const renderBuy = () => (
    <div>
      {/* Provider selection */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        {/* Telnyx card */}
        <div onClick={()=>setSearchProvider('telnyx')} style={{
          padding:20, borderRadius:14, cursor:'pointer', transition:'all .2s',
          border: searchProvider === 'telnyx' ? `2px solid ${GRN}` : '2px solid #e5e7eb',
          background: searchProvider === 'telnyx' ? GRN+'06' : W,
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Phone size={16} color={GRN} />
              </div>
              <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK }}>Telnyx</div>
            </div>
            <Badge label="RECOMMENDED" color={GRN} bg="#dcfce7" />
          </div>
          <div style={{ fontSize:13, color:'#374151', lineHeight:1.6, marginBottom:12 }}>
            Next-gen carrier with lower costs and no setup fees. Ideal for AI voice agents and local presence dialing.
          </div>
          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            <div><div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:GRN }}>$1.00</div><div style={{ fontSize:10, color:'#6b7280', fontFamily:FH, fontWeight:600 }}>LOCAL/MO</div></div>
            <div><div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:GRN }}>$2.00</div><div style={{ fontSize:10, color:'#6b7280', fontFamily:FH, fontWeight:600 }}>TOLL-FREE/MO</div></div>
            <div><div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:GRN }}>$0</div><div style={{ fontSize:10, color:'#6b7280', fontFamily:FH, fontWeight:600 }}>SETUP FEE</div></div>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {['No setup fees', 'Local presence', 'Lower per-min rates', 'Number porting', 'SIP trunking'].map(f => (
              <span key={f} style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'#dcfce7', color:GRN }}>{f}</span>
            ))}
          </div>
        </div>

        {/* Twilio card */}
        <div onClick={()=>setSearchProvider('twilio')} style={{
          padding:20, borderRadius:14, cursor:'pointer', transition:'all .2s',
          border: searchProvider === 'twilio' ? '2px solid #3b82f6' : '2px solid #e5e7eb',
          background: searchProvider === 'twilio' ? '#3b82f608' : W,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Phone size={16} color="#3b82f6" />
            </div>
            <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK }}>Twilio</div>
          </div>
          <div style={{ fontSize:13, color:'#374151', lineHeight:1.6, marginBottom:12 }}>
            Industry standard with worldwide coverage and rich programmable features. Higher cost but most established provider.
          </div>
          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            <div><div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:'#3b82f6' }}>$1.15</div><div style={{ fontSize:10, color:'#6b7280', fontFamily:FH, fontWeight:600 }}>LOCAL/MO</div></div>
            <div><div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:'#3b82f6' }}>$2.15</div><div style={{ fontSize:10, color:'#6b7280', fontFamily:FH, fontWeight:600 }}>TOLL-FREE/MO</div></div>
            <div><div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:AMB }}>$1.00</div><div style={{ fontSize:10, color:'#6b7280', fontFamily:FH, fontWeight:600 }}>SETUP FEE</div></div>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {['Worldwide coverage', 'Rich SMS/MMS', 'Programmable voice', 'Established provider'].map(f => (
              <span key={f} style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'#dbeafe', color:'#3b82f6' }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Local Presence explainer (Telnyx only) */}
      {searchProvider === 'telnyx' && (
        <Card style={{ marginBottom:16, background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:GRN+'20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <PhoneCall size={16} color={GRN} />
            </div>
            <div>
              <div style={{ fontFamily:FH, fontSize:14, fontWeight:800, color:BLK, marginBottom:4 }}>Local Presence Dialing</div>
              <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>
                Telnyx supports <strong>local presence</strong> — your AI voice agent can call from a number with the same area code as the person being called. This dramatically increases answer rates (up to 4x) because recipients see a local number, not a random out-of-state call. Numbers purchased from Telnyx automatically support this feature.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Search bar */}
      <Card style={{ marginBottom:20 }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4, fontFamily:FH }}>Area Code</label>
            <input value={areaCode} onChange={e=>setAreaCode(e.target.value.replace(/\D/g,'').slice(0,3))} placeholder="e.g. 212" style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, width:120, boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4, fontFamily:FH }}>Type</label>
            <select value={searchType} onChange={e=>setSearchType(e.target.value)} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, background:W, boxSizing:'border-box' }}>
              <option value="local">Local</option>
              <option value="tollfree">Toll-Free</option>
            </select>
          </div>
          <Btn onClick={searchAvailable} disabled={searching} bg={searchProvider === 'telnyx' ? GRN : T} style={{ marginBottom:0 }}>
            {searching ? <Loader2 size={14} className="spin" /> : <Search size={14} />} Search {searchProvider === 'telnyx' ? 'Telnyx' : 'Twilio'}
          </Btn>
        </div>
      </Card>

      {/* Results */}
      {available.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
          {available.map(n => (
            <Card key={n.phone_number} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:BLK, fontFamily:FH }}>{fmt(n.phone_number)}</div>
                  <Badge label={n.provider || searchProvider} color={n.provider === 'telnyx' || searchProvider === 'telnyx' ? GRN : '#3b82f6'} bg={n.provider === 'telnyx' || searchProvider === 'telnyx' ? '#dcfce7' : '#dbeafe'} />
                </div>
                <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                  {[n.locality, n.region].filter(Boolean).join(', ') || 'US'}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:BLK, marginTop:4, fontFamily:FH }}>
                  ${(n.cost_monthly || (searchType === 'tollfree' ? 2.00 : 1.00)).toFixed(2)}/mo
                  {(n.cost_setup || 0) > 0 && <span style={{ fontSize:11, color:'#6b7280', fontWeight:500 }}> + ${n.cost_setup} setup</span>}
                </div>
              </div>
              <Btn small onClick={()=>purchaseNumber(n)} disabled={buying === n.phone_number} bg={searchProvider === 'telnyx' ? GRN : R}>
                {buying === n.phone_number ? <Loader2 size={12} className="spin" /> : <Plus size={12} />} Buy
              </Btn>
            </Card>
          ))}
        </div>
      )}

      {!searching && available.length === 0 && (
        <Card style={{ textAlign:'center', padding:48 }}>
          <Search size={40} color="#ccc" style={{ marginBottom:12 }} />
          <div style={{ fontSize:14, color:'#6b7280', fontFamily:FH }}>Select a provider above, then search by area code</div>
        </Card>
      )}
    </div>
  )

  /* ── TAB 3: BILLING ── */
  const renderBilling = () => {
    const activeNums = numbers.filter(n => n.status === 'active')
    const totalCost = activeNums.reduce((s, n) => s + Number(n.monthly_cost || 0), 0)
    const avgCost = activeNums.length > 0 ? totalCost / activeNums.length : 0

    return (
      <div>
        {/* Stats */}
        <div style={{ display:'flex', gap:16, marginBottom:20, flexWrap:'wrap' }}>
          <StatCard icon={DollarSign} label="Total Monthly Cost" value={`$${Number(totalCost||0).toFixed(2)}`} color={R} />
          <StatCard icon={Hash} label="Active Numbers" value={activeNums.length} color={GRN} />
          <StatCard icon={DollarSign} label="Avg Cost / Number" value={`$${Number(avgCost||0).toFixed(2)}`} color={T} />
        </div>

        {/* Billing table */}
        {activeNums.length === 0 ? (
          <Card style={{ textAlign:'center', padding:48 }}>
            <DollarSign size={40} color="#ccc" style={{ marginBottom:12 }} />
            <div style={{ fontSize:14, color:'#6b7280', fontFamily:FH }}>No active numbers to bill</div>
          </Card>
        ) : (
          <Card style={{ padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FB }}>
              <thead>
                <tr style={{ background:'#fafafa', borderBottom:'1px solid #e5e7eb' }}>
                  {['Phone Number','Type','Monthly Cost','Next Billing','Status'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.04em', fontFamily:FH }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeNums.map(n => {
                  const nextBill = new Date()
                  nextBill.setMonth(nextBill.getMonth() + 1)
                  nextBill.setDate(1)
                  return (
                    <tr key={n.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                      <td style={{ padding:'10px 14px', fontWeight:600, color:BLK }}>{fmt(n.phone_number)}</td>
                      <td style={{ padding:'10px 14px' }}><Badge label={n.type} color={(typeColors[n.type]||typeColors.local).c} bg={(typeColors[n.type]||typeColors.local).bg} /></td>
                      <td style={{ padding:'10px 14px', color:'#374151' }}>${Number(n.monthly_cost||0).toFixed(2)}</td>
                      <td style={{ padding:'10px 14px', color:'#374151' }}>{nextBill.toLocaleDateString()}</td>
                      <td style={{ padding:'10px 14px' }}><Badge label="active" color={W} bg={GRN} /></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:'#fafafa', borderTop:'2px solid #e5e7eb' }}>
                  <td style={{ padding:'10px 14px', fontWeight:700, fontFamily:FH }}>Total</td>
                  <td />
                  <td style={{ padding:'10px 14px', fontWeight:700, fontFamily:FH, color:R }}>${Number(totalCost||0).toFixed(2)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </Card>
        )}
      </div>
    )
  }

  /* ── RENDER TAB ── */
  const renderTab = () => {
    switch(tab) {
      case 'numbers': return renderNumbers()
      case 'buy': return renderBuy()
      case 'billing': return renderBilling()
      default: return renderNumbers()
    }
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ background:W, padding:'16px 28px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background: '#E6007E', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Phone size={18} color={W} />
            </div>
            <div>
              <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:W, fontFamily:FH }}>Phone Numbers</h1>
              <p style={{ margin:0, fontSize:11, color:'#6b7280', fontFamily:FB }}>Manage provisioned numbers, purchase new ones, assign to agents</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {loading && <Loader2 size={16} color={T} className="spin" />}
            <Btn small bg={`${T}30`} color={T} onClick={loadAll}><RefreshCw size={12} /> Refresh</Btn>
            <div style={{ display:'flex', gap:6 }}>
              <StatPill label="total" value={stats.total} color={T} />
              <StatPill label="active" value={stats.active} color={GRN} />
            </div>
            <Btn onClick={()=>setTab('buy')}><Plus size={14} /> Buy Number</Btn>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:24, flex:1, overflow:'auto' }}>
          <TabBar tabs={TABS} active={tab} onChange={setTab} />
          {renderTab()}
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <Modal title="Edit Phone Number" onClose={()=>setEditModal(null)}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:600, color:BLK, fontFamily:FH, marginBottom:12 }}>{fmt(editModal.phone_number)}</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4, fontFamily:FH }}>Friendly Name</label>
              <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="e.g. Main Office Line" style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4, fontFamily:FH }}>Purpose</label>
              <select value={editPurpose} onChange={e=>setEditPurpose(e.target.value)} style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, background:W, boxSizing:'border-box' }}>
                <option value="voice">Voice</option>
                <option value="sms">SMS</option>
                <option value="both">Both</option>
                <option value="answering">Answering</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Btn small bg="#e5e7eb" color="#555" onClick={()=>setEditModal(null)}>Cancel</Btn>
            <Btn small onClick={updateNumber}><Check size={12} /> Save</Btn>
          </div>
        </Modal>
      )}

      {/* Release Confirm Modal */}
      {releaseConfirm && (
        <Modal title="Release Phone Number" onClose={()=>setReleaseConfirm(null)}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:16, background:'#fef2f2', borderRadius:10, marginBottom:20 }}>
            <AlertTriangle size={24} color={R} />
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:BLK, fontFamily:FH }}>Are you sure?</div>
              <div style={{ fontSize:13, color:'#6b7280' }}>This will release <strong>{fmt(releaseConfirm.phone_number)}</strong> back to {releaseConfirm.provider === 'telnyx' ? 'Telnyx' : 'Twilio'}. This action cannot be undone.</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Btn small bg="#e5e7eb" color="#555" onClick={()=>setReleaseConfirm(null)}>Cancel</Btn>
            <Btn small bg={R} onClick={()=>releaseNumber(releaseConfirm.id)}><Trash2 size={12} /> Release</Btn>
          </div>
        </Modal>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  )
}
