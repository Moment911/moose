"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Target, Plus, Send, Phone, Mail, Globe, Star,
  ChevronRight, CheckCircle, X, Edit2, Trash2,
  Loader2, Sparkles, Copy, ArrowRight, TrendingUp,
  Clock, Building2, MessageSquare, DollarSign, Filter
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../hooks/useAuth'
import { useMobile } from '../../hooks/useMobile'
import toast from 'react-hot-toast'

const RED   = '#E6007E'
const TEAL  = '#00C2CB'
const BLK = '#111111'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const PURP  = '#7c3aed'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const STAGES = [
  { key:'new',           label:'New Leads',      color:'#6b7280', bg:'#f3f4f6' },
  { key:'contacted',     label:'Contacted',       color:TEAL,      bg:'#f0fbfc' },
  { key:'interested',    label:'Interested',      color:AMBER,     bg:'#fffbeb' },
  { key:'proposal_sent', label:'Proposal Sent',   color:PURP,      bg:'#f5f3ff' },
  { key:'negotiating',   label:'Negotiating',     color:'#f97316', bg:'#fff7ed' },
  { key:'won',           label:'Won ✓',           color:GREEN,     bg:'#f0fdf4' },
  { key:'lost',          label:'Lost',            color:RED,       bg:'#fef2f2' },
]

const TEMP_COLOR = { hot:'#ef4444', warm:AMBER, cold:TEAL, frozen:'#93c5fd' }

function LeadCard({ lead, onMove, onSelect, selected }) {
  const tempColor = TEMP_COLOR[lead.temperature] || '#9ca3af'
  const stage = STAGES.find(s => s.key === lead.stage) || STAGES[0]
  return (
    <div onClick={()=>onSelect(lead)}
      style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${selected?RED:'#e5e7eb'}`, padding:'12px 14px', cursor:'pointer', marginBottom:8, transition:'border-color .15s' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK, lineHeight:1.3, flex:1 }}>{lead.business_name}</div>
        <div style={{ width:10, height:10, borderRadius:'50%', background:tempColor, flexShrink:0, marginTop:3, boxShadow:`0 0 0 3px ${tempColor}25` }}/>
      </div>
      {lead.industry && <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginBottom:6 }}>{lead.industry}</div>}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:4 }}>
          {lead.email    && <Mail    size={11} color="#9ca3af"/>}
          {lead.phone    && <Phone   size={11} color="#9ca3af"/>}
          {lead.website  && <Globe   size={11} color="#9ca3af"/>}
        </div>
        {lead.estimated_value > 0 && (
          <div style={{ fontSize:11, fontWeight:700, color:GREEN, fontFamily:FH }}>${lead.estimated_value?.toLocaleString()}/mo</div>
        )}
      </div>
      {lead.lead_score > 0 && (
        <div style={{ marginTop:8 }}>
          <div style={{ height:3, borderRadius:99, background:'#f3f4f6', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${lead.lead_score}%`, background:lead.lead_score>=70?GREEN:lead.lead_score>=40?AMBER:TEAL, borderRadius:99, transition:'width .3s' }}/>
          </div>
          <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FB, marginTop:2 }}>{lead.lead_score}/100 score</div>
        </div>
      )}
      {lead.next_follow_up && new Date(lead.next_follow_up) <= new Date() && (
        <div style={{ marginTop:6, fontSize:11, fontWeight:700, color:RED, fontFamily:FH, display:'flex', alignItems:'center', gap:4 }}>
          <Clock size={10}/> Follow-up due
        </div>
      )}
    </div>
  )
}

function LeadDetail({ lead, agencyId, onClose, onUpdate, onDelete }) {
  const [notes,       setNotes]       = useState(lead.notes || '')
  const [email,       setEmail]       = useState('')
  const [generating,  setGenerating]  = useState(false)
  const [converting,  setConverting]  = useState(false)
  const [activity,    setActivity]    = useState([])
  const [followUp,    setFollowUp]    = useState(lead.next_follow_up || '')
  const [estValue,    setEstValue]    = useState(lead.estimated_value || '')
  const [saving,      setSaving]      = useState(false)
  const [activeTab,   setActiveTab]   = useState('overview')

  useEffect(() => { loadActivity() }, [lead.id])

  async function loadActivity() {
    const res  = await fetch('/api/scout/pipeline', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'activity', lead_id: lead.id, agency_id: agencyId }),
    })
    const data = await res.json()
    setActivity(data.activity || [])
  }

  async function moveStage(new_stage) {
    await fetch('/api/scout/pipeline', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'move', lead_id: lead.id, agency_id: agencyId, new_stage }),
    })
    onUpdate({ ...lead, stage: new_stage })
    toast.success(`Moved to ${new_stage.replace(/_/g,' ')} ✓`)
    loadActivity()
  }

  async function addNote(type='note') {
    if (!notes.trim()) return
    await fetch('/api/scout/pipeline', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'note', lead_id: lead.id, agency_id: agencyId, type, content: notes }),
    })
    toast.success('Saved ✓')
    setNotes('')
    loadActivity()
  }

  async function generateEmail() {
    setGenerating(true)
    const res  = await fetch('/api/scout/pipeline', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'outreach_email', lead, agency_id: agencyId }),
    })
    const data = await res.json()
    if (data.email) { setEmail(data.email); setActiveTab('outreach') }
    else toast.error('Failed to generate email')
    setGenerating(false)
  }

  async function saveUpdates() {
    setSaving(true)
    await fetch('/api/scout/pipeline', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'update', lead_id: lead.id, agency_id: agencyId,
        updates: { next_follow_up: followUp || null, estimated_value: parseFloat(estValue) || null } }),
    })
    onUpdate({ ...lead, next_follow_up: followUp, estimated_value: parseFloat(estValue)||null })
    toast.success('Saved ✓')
    setSaving(false)
  }

  async function convert() {
    if (!window.confirm(`Convert ${lead.business_name} to a client?`)) return
    setConverting(true)
    const res  = await fetch('/api/scout/pipeline', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'convert', lead_id: lead.id, agency_id: agencyId }),
    })
    const data = await res.json()
    if (data.client_id) { toast.success('Converted to client ✓'); onUpdate({ ...lead, stage:'won' }) }
    else toast.error(data.error || 'Failed')
    setConverting(false)
  }

  const currentStage = STAGES.find(s => s.key === lead.stage) || STAGES[0]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:9999, display:'flex', alignItems:'flex-start', justifyContent:'flex-end' }}>
      <div style={{ width:480, height:'100vh', background:'#fff', overflowY:'auto', display:'flex', flexDirection:'column', boxShadow:'-4px 0 40px rgba(0,0,0,.15)' }}>
        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'18px 20px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
            <div>
              <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:'#fff', marginBottom:3 }}>{lead.business_name}</div>
              <div style={{ fontSize:12, color:'#999999', fontFamily:FB }}>{lead.industry} · {[lead.city,lead.state].filter(Boolean).join(', ')}</div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#999999', padding:4 }}><X size={16}/></button>
          </div>
          {/* Stage buttons */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {STAGES.filter(s=>!['won','lost'].includes(s.key)).map(s => (
              <button key={s.key} onClick={()=>moveStage(s.key)}
                style={{ padding:'4px 10px', borderRadius:20, border:`1px solid ${lead.stage===s.key?s.color:'#999999'}`, background:lead.stage===s.key?s.color+'30':'transparent', color:lead.stage===s.key?s.color:'#999999', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #f3f4f6', background:'#fff', flexShrink:0 }}>
          {[['overview','Overview'],['outreach','Outreach'],['activity','Activity']].map(([key,label])=>(
            <button key={key} onClick={()=>setActiveTab(key)}
              style={{ flex:1, padding:'10px', border:'none', background:'transparent', color:activeTab===key?BLK:'#9ca3af', fontSize:12, fontWeight:activeTab===key?700:400, cursor:'pointer', fontFamily:FH, borderBottom:`2px solid ${activeTab===key?RED:'transparent'}` }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          {activeTab === 'overview' && (
            <div>
              {/* Contact info */}
              <div style={{ marginBottom:16 }}>
                {[[Mail,lead.email,'email'],[Phone,lead.phone,'tel'],[Globe,lead.website,'url']].map(([Icon,val,type])=> val ? (
                  <div key={type} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid #f9fafb' }}>
                    <Icon size={13} color="#9ca3af" style={{ flexShrink:0 }}/>
                    <span style={{ fontSize:13, color:'#374151', fontFamily:FB, flex:1 }}>{val}</span>
                    <button onClick={()=>{navigator.clipboard.writeText(val);toast.success('Copied!')}} style={{ background:'none', border:'none', cursor:'pointer', color:'#d1d5db' }}><Copy size={11}/></button>
                  </div>
                ) : null)}
              </div>

              {/* Follow-up + value */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                <div>
                  <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK, display:'block', marginBottom:4 }}>Follow-up Date</label>
                  <input type="date" value={followUp} onChange={e=>setFollowUp(e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:12, outline:'none', boxSizing:'border-box', fontFamily:FB }}/>
                </div>
                <div>
                  <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK, display:'block', marginBottom:4 }}>Est. Monthly Value ($)</label>
                  <input type="number" value={estValue} onChange={e=>setEstValue(e.target.value)} placeholder="500"
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:12, outline:'none', boxSizing:'border-box', fontFamily:FB }}/>
                </div>
              </div>
              <button onClick={saveUpdates} disabled={saving}
                style={{ width:'100%', padding:'9px', borderRadius:9, border:'none', background:'#f3f4f6', color:BLK, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, marginBottom:16 }}>
                {saving?'Saving…':'Save Changes'}
              </button>

              {/* Quick note */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK, display:'block', marginBottom:6 }}>Add Note</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Call notes, follow-up details…"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', resize:'none', boxSizing:'border-box', marginBottom:6 }}/>
                <div style={{ display:'flex', gap:6 }}>
                  {[['note','Note'],['call','Call'],['email','Email']].map(([type,label])=>(
                    <button key={type} onClick={()=>addNote(type)}
                      style={{ flex:1, padding:'7px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                      + {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {lead.stage !== 'won' && lead.stage !== 'lost' && (
                  <button onClick={convert} disabled={converting}
                    style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', background:GREEN, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                    {converting?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<CheckCircle size={13}/>}
                    {converting?'Converting…':'Convert to Client'}
                  </button>
                )}
                <button onClick={()=>moveStage('lost')}
                  style={{ width:'100%', padding:'9px', borderRadius:9, border:'1px solid #fecaca', background:'#fef2f2', color:RED, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                  Mark as Lost
                </button>
                <button onClick={()=>{if(window.confirm('Delete this lead?'))onDelete(lead.id)}}
                  style={{ width:'100%', padding:'9px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', color:'#9ca3af', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                  Delete Lead
                </button>
              </div>
            </div>
          )}

          {activeTab === 'outreach' && (
            <div>
              <button onClick={generateEmail} disabled={generating}
                style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', background:`${TEAL}20`, color:TEAL, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginBottom:14 }}>
                {generating?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={13}/>}
                {generating?'Writing in your voice…':'Generate Personalized Email'}
              </button>
              {email && (
                <div>
                  <textarea value={email} onChange={e=>setEmail(e.target.value)} rows={12}
                    style={{ width:'100%', padding:'12px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, lineHeight:1.8, outline:'none', resize:'vertical', boxSizing:'border-box', marginBottom:8 }}/>
                  <button onClick={()=>{navigator.clipboard.writeText(email);toast.success('Copied!')}}
                    style={{ width:'100%', padding:'9px', borderRadius:9, border:'1px solid #e5e7eb', background:'#fff', color:BLK, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    <Copy size={12}/> Copy Email
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              {activity.length === 0 ? (
                <div style={{ textAlign:'center', color:'#9ca3af', fontFamily:FB, fontSize:13, padding:'24px 0' }}>No activity yet</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {activity.map(act => (
                    <div key={act.id} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:'1px solid #f9fafb' }}>
                      <div style={{ width:24, height:24, borderRadius:7, background:act.type==='stage_change'?TEAL+'20':act.type==='call'?GREEN+'20':act.type==='email'?PURP+'20':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {act.type==='call'?<Phone size={11} color={GREEN}/>:act.type==='email'?<Mail size={11} color={PURP}/>:act.type==='stage_change'?<ArrowRight size={11} color={TEAL}/>:<MessageSquare size={11} color="#9ca3af"/>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:'#374151', fontFamily:FB, lineHeight:1.5 }}>{act.content}</div>
                        <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB, marginTop:2 }}>
                          {new Date(act.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ScoutPipelinePage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const [byStage,    setByStage]    = useState({})
  const [stats,      setStats]      = useState({})
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)
  const [view,       setView]       = useState('kanban') // kanban|list
  const [showAdd,    setShowAdd]    = useState(false)
  const [addForm,    setAddForm]    = useState({ business_name:'', email:'', phone:'', website:'', industry:'', city:'', state:'', estimated_value:'', notes:'' })
  const [adding,     setAdding]     = useState(false)

  useEffect(() => { if (agencyId) load() }, [agencyId])

  async function load() {
    setLoading(true)
    const res  = await fetch(`/api/scout/pipeline?agency_id=${agencyId}`)
    const data = await res.json()
    setByStage(data.by_stage || {})
    setStats(data.stats || {})
    setLoading(false)
  }

  async function addLead() {
    if (!addForm.business_name.trim()) { toast.error('Business name required'); return }
    setAdding(true)
    const res  = await fetch('/api/scout/pipeline', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'add', agency_id: agencyId, lead: addForm }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); setAdding(false); return }
    toast.success('Lead added ✓')
    setShowAdd(false)
    setAddForm({ business_name:'', email:'', phone:'', website:'', industry:'', city:'', state:'', estimated_value:'', notes:'' })
    load()
    setAdding(false)
  }

  function handleUpdate(updated) {
    setByStage(prev => {
      const next = { ...prev }
      for (const stage of Object.keys(next)) {
        next[stage] = next[stage].map(l => l.id === updated.id ? updated : l)
      }
      // If stage changed, move it
      if (updated.stage !== selected?.stage) {
        for (const stage of Object.keys(next)) {
          next[stage] = next[stage].filter(l => l.id !== updated.id)
        }
        if (next[updated.stage]) next[updated.stage] = [updated, ...next[updated.stage]]
      }
      return next
    })
    setSelected(updated)
  }

  function handleDelete(id) {
    fetch('/api/scout/pipeline', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'delete', lead_id:id, agency_id:agencyId }),
    })
    setByStage(prev => {
      const next = { ...prev }
      for (const s of Object.keys(next)) next[s] = next[s].filter(l => l.id !== id)
      return next
    })
    setSelected(null)
    toast.success('Lead deleted')
  }

  const allLeads = Object.values(byStage).flat()

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#F9F9F9' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'18px 28px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:9 }}>
                <Target size={18} color={RED}/> Scout Pipeline
              </div>
              <div style={{ fontSize:12, color:'#999999', margin:'3px 0 0', fontFamily:FB }}>
                {stats.total||0} leads · ${(stats.pipeline_value||0).toLocaleString()} pipeline · {stats.won||0} won
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ display:'flex', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', overflow:'hidden' }}>
                {[['kanban','Kanban'],['list','List']].map(([v,l])=>(
                  <button key={v} onClick={()=>setView(v)}
                    style={{ padding:'7px 14px', border:'none', background:view===v?'rgba(255,255,255,.15)':'transparent', color:view===v?'#fff':'rgba(255,255,255,.4)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={()=>setShowAdd(true)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9, border:'none', background:RED, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:FH, boxShadow:`0 2px 10px ${RED}50` }}>
                <Plus size={13}/> Add Lead
              </button>
            </div>
          </div>
        </div>

        {/* Kanban board */}
        <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', padding:'16px 20px' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'48px 0' }}>
              <Loader2 size={24} color={TEAL} style={{ animation:'spin 1s linear infinite' }}/>
            </div>
          ) : view === 'kanban' ? (
            <div style={{ display:'flex', gap:12, height:'100%', minWidth:'max-content' }}>
              {STAGES.map(stage => {
                const leads = byStage[stage.key] || []
                return (
                  <div key={stage.key} style={{ width:220, flexShrink:0, display:'flex', flexDirection:'column', height:'100%' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:stage.color }}/>
                        <span style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK }}>{stage.label}</span>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:10, background:stage.bg, color:stage.color, fontFamily:FH }}>{leads.length}</span>
                    </div>
                    <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
                      {leads.map(lead => (
                        <LeadCard key={lead.id} lead={lead} selected={selected?.id===lead.id}
                          onSelect={setSelected} onMove={()=>{}}/>
                      ))}
                      {leads.length === 0 && (
                        <div style={{ padding:'20px 12px', textAlign:'center', border:'2px dashed #e5e7eb', borderRadius:10, color:'#d1d5db', fontSize:12, fontFamily:FB }}>
                          No leads
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* List view */
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 120px 100px 100px', gap:12, padding:'10px 16px', borderBottom:'1px solid #f3f4f6', fontSize:11, fontWeight:700, color:'#9ca3af', fontFamily:FH, textTransform:'uppercase', letterSpacing:'.06em' }}>
                <span>Business</span><span>Industry</span><span>Stage</span><span>Score</span><span>Value</span>
              </div>
              {allLeads.map(lead => {
                const stage = STAGES.find(s=>s.key===lead.stage)||STAGES[0]
                return (
                  <div key={lead.id} onClick={()=>setSelected(lead)} style={{ display:'grid', gridTemplateColumns:'1fr 120px 120px 100px 100px', gap:12, padding:'11px 16px', borderBottom:'1px solid #f9fafb', cursor:'pointer', alignItems:'center', background:selected?.id===lead.id?'#fef2f2':'#fff' }}>
                    <div>
                      <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}>{lead.business_name}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{[lead.city,lead.state].filter(Boolean).join(', ')}</div>
                    </div>
                    <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>{lead.industry||'—'}</div>
                    <div><span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:stage.bg, color:stage.color, fontFamily:FH }}>{stage.label}</span></div>
                    <div style={{ fontFamily:FH, fontSize:13, fontWeight:700, color:lead.lead_score>=70?GREEN:lead.lead_score>=40?AMBER:TEAL }}>{lead.lead_score||0}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:GREEN, fontFamily:FH }}>{lead.estimated_value?`$${lead.estimated_value?.toLocaleString()}`:'—'}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lead detail panel */}
      {selected && (
        <LeadDetail lead={selected} agencyId={agencyId}
          onClose={()=>setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}/>
      )}

      {/* Add lead modal */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'24px 28px', width:'100%', maxWidth:500, maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK }}>Add Lead</div>
              <button onClick={()=>setShowAdd(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={16}/></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              {[
                { key:'business_name', label:'Business Name *', full:true },
                { key:'email',         label:'Email'            },
                { key:'phone',         label:'Phone'            },
                { key:'website',       label:'Website'          },
                { key:'industry',      label:'Industry'         },
                { key:'city',          label:'City'             },
                { key:'state',         label:'State'            },
                { key:'estimated_value',label:'Est. Monthly Value ($)' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn:f.full?'1/-1':'auto' }}>
                  <label style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK, display:'block', marginBottom:4 }}>{f.label}</label>
                  <input value={addForm[f.key]} onChange={e=>setAddForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{ width:'100%', padding:'8px 11px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
                </div>
              ))}
            </div>
            <button onClick={addLead} disabled={adding}
              style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
              {adding?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Plus size={14}/>}
              {adding?'Adding…':'Add to Pipeline'}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
