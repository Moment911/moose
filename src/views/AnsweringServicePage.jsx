"use client"
import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import VoiceSelector from '../components/VoiceSelector'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { SIC_CODES } from '../data/sicCodes'
import {
  Phone, PhoneIncoming, PhoneOff, Plus, Play, Pause, Search, ChevronRight,
  ChevronDown, Clock, Users, Check, X, Loader2, BarChart2, Globe, AlertCircle,
  Volume2, FileText, Sparkles, RefreshCw, Send, Star, Shield, Calendar, Settings,
  Zap, Copy, Download, Edit2, Trash2, Mail, MessageSquare, Target, Brain
} from 'lucide-react'

import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
const PURP='#7c3aed'
const W='#ffffff'

const DEPARTMENTS = ['Main Line','Sales','Support','Billing','Emergency','After Hours']
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const TIMEZONES = [
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Anchorage','Pacific/Honolulu','America/Phoenix','America/Detroit',
  'America/Indiana/Indianapolis','America/Kentucky/Louisville'
]
const TABS = ['Setup','Voice & Greeting','Intake Form','Prompt Editor','Routing','Live Monitor','Call Log','Analytics']

const defaultHours = () => DAYS.reduce((a,d)=>({...a,[d]:{enabled:d!=='Sat'&&d!=='Sun',open:'09:00',close:'17:00'}}),{})

// ── Styles ────────────────────────────────────────────────────────────────────
const card = { background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20 }
const input = { width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:14, fontFamily:FB, outline:'none' }
const btn = (bg=R,c='#fff') => ({ padding:'8px 18px', borderRadius:8, background:bg, color:c, border:'none', fontSize:14, fontFamily:FH, fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 })
const badge = (bg,c='#fff') => ({ display:'inline-block', padding:'2px 8px', borderRadius:20, background:bg, color:c, fontSize:12, fontWeight:600 })
const tabStyle = (active) => ({ padding:'8px 16px', borderRadius:'8px 8px 0 0', background:active?'#fff':'transparent', color:active?R:'#6b7280', fontWeight:active?700:500, border:'none', borderBottom:active?`2px solid ${R}`:'2px solid transparent', cursor:'pointer', fontSize:13, fontFamily:FH })

export default function AnsweringServicePage() {
  const { user, agencyId: authAgencyId } = useAuth()
  const agencyId = authAgencyId || '00000000-0000-0000-0000-000000000099'

  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [searchQ, setSearchQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  // ── Load agents ─────────────────────────────────────────────────────────────
  useEffect(() => { loadAgents() }, [agencyId])

  async function loadAgents() {
    setLoading(true)
    try {
      const res = await fetch(`/api/inbound?action=get_agents&agency_id=${agencyId}`)
      if (res.ok) { const d = await res.json(); setAgents(d.agents || []); if (d.agents?.length && !selectedAgent) setSelectedAgent(d.agents[0]) }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const filtered = agents.filter(a => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return (a.business_name||'').toLowerCase().includes(q) || (a.department||'').toLowerCase().includes(q) || (a.phone_number||'').includes(q)
  })

  // ── MAIN RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="page-shell" style={{ display:'flex', height:'100vh', overflow:'hidden', background:GRY, fontFamily:FB }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ background:W, padding:'16px 28px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Phone size={22} color={R} />
            <span style={{ color:BLK, fontSize:20, fontWeight:700, fontFamily:FH }}>Koto Answering</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:'#6b7280', fontSize:13 }}>{agents.length} agent{agents.length!==1?'s':''}</span>
            <RefreshCw size={16} color='#6b7280' style={{ cursor:'pointer' }} onClick={loadAgents} />
          </div>
        </div>

        {/* Two-panel */}
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          {/* LEFT PANEL */}
          <div style={{ width:260, minWidth:260, borderRight:'1px solid #e5e7eb', background:'#fff', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:12 }}>
              <button onClick={()=>setShowWizard(true)} style={{ ...btn(), width:'100%', justifyContent:'center' }}><Plus size={16}/> New Agent</button>
            </div>
            <div style={{ padding:'0 12px 8px' }}>
              <div style={{ position:'relative' }}>
                <Search size={14} color='#6b7280' style={{ position:'absolute', left:10, top:10 }} />
                <input placeholder="Search agents..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{ ...input, paddingLeft:32 }} />
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {loading ? <div style={{ padding:20, textAlign:'center' }}><Loader2 size={20} className="spin" color={R} /></div>
              : filtered.length === 0 ? <div style={{ padding:20, color:'#6b7280', fontSize:13, textAlign:'center' }}>No agents yet. Click "New Agent" to get started.</div>
              : filtered.map(a => (
                <div key={a.id} onClick={()=>{setSelectedAgent(a);setActiveTab(0)}} style={{
                  padding:'10px 14px', cursor:'pointer', borderLeft: selectedAgent?.id===a.id ? `3px solid ${R}` : '3px solid transparent',
                  background: selectedAgent?.id===a.id ? 'rgba(234,39,41,.04)' : 'transparent', transition:'all .15s'
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:99, background: (a.status==='active' || a.is_active || a.retell_agent_id) ? GRN : '#d1d5db' }} />
                    <span style={{ fontSize:14, fontWeight:600, fontFamily:FH, color:BLK }}>{a.name || a.business_name || 'Untitled'}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, marginLeft:16 }}>
                    {a.department && <span style={badge('#f3f4f6','#374151')}>{a.department}</span>}
                    {a.phone_number && <span style={{ fontSize:12, color:'#6b7280' }}>{a.phone_number}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {showWizard ? (
              <NewAgentWizard agencyId={agencyId} onClose={()=>setShowWizard(false)} onCreated={(a)=>{setAgents(p=>[a,...p]);setSelectedAgent(a);setShowWizard(false)}} />
            ) : !selectedAgent ? (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
                <PhoneIncoming size={40} color='#d1d5db' />
                <p style={{ color:'#6b7280', fontSize:15 }}>Select an agent or create a new one</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div style={{ display:'flex', gap:2, padding:'12px 20px 0', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
                  {TABS.map((t,i) => <button key={t} onClick={()=>setActiveTab(i)} style={tabStyle(activeTab===i)}>{t}</button>)}
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:20 }}>
                  {activeTab===0 && <SetupTab agent={selectedAgent} setAgent={a=>{setSelectedAgent(a);setAgents(prev=>prev.map(x=>x.id===a.id?a:x))}} agencyId={agencyId} saving={saving} setSaving={setSaving} />}
                  {activeTab===1 && <VoiceGreetingTab agent={selectedAgent} setAgent={a=>{setSelectedAgent(a);setAgents(prev=>prev.map(x=>x.id===a.id?a:x))}} />}
                  {activeTab===2 && <IntakeFormTab agent={selectedAgent} setAgent={a=>{setSelectedAgent(a);setAgents(prev=>prev.map(x=>x.id===a.id?a:x))}} />}
                  {activeTab===3 && <PromptComplianceTab agent={selectedAgent} setAgent={a=>{setSelectedAgent(a);setAgents(prev=>prev.map(x=>x.id===a.id?a:x))}} />}
                  {activeTab===4 && <RoutingTab agent={selectedAgent} />}
                  {activeTab===5 && <LiveMonitorTab agent={selectedAgent} />}
                  {activeTab===6 && <CallLogTab agent={selectedAgent} />}
                  {activeTab===7 && <AnalyticsTab agent={selectedAgent} agencyId={agencyId} />}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — SETUP
// ═══════════════════════════════════════════════════════════════════════════════
function SetupTab({ agent, setAgent, agencyId, saving, setSaving }) {
  const [form, setForm] = useState({ ...agent })
  const [sicSearch, setSicSearch] = useState('')
  const [sicOpen, setSicOpen] = useState(false)
  const [kwInput, setKwInput] = useState('')
  const sicRef = useRef(null)

  useEffect(() => { setForm({ ...agent }) }, [agent.id])

  const upd = (k,v) => setForm(p=>({...p,[k]:v}))
  const hours = form.business_hours || defaultHours()
  const setHour = (day,field,val) => upd('business_hours',{...hours,[day]:{...hours[day],[field]:val}})

  const filteredSic = SIC_CODES.filter(s => {
    if (!sicSearch) return true
    const q = sicSearch.toLowerCase()
    return s.label.toLowerCase().includes(q) || s.code.includes(q) || (s.division||'').toLowerCase().includes(q)
  }).slice(0,80)

  async function provisionNumber() {
    const code = form._area_code || '212'
    toast.loading('Provisioning number...',{id:'prov'})
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'provision_number', area_code:code, agent_id:agent.id }) })
      const d = await res.json()
      if (d.phone_number) { upd('phone_number',d.phone_number); toast.success(`Got ${d.phone_number}`,{id:'prov'}) }
      else toast.error(d.error||'Failed',{id:'prov'})
    } catch { toast.error('Provision failed',{id:'prov'}) }
  }

  async function saveAgent() {
    setSaving(true)
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'update_agent', agent_id:agent.id, ...form }) })
      const d = await res.json()
      if (d.success) { setAgent({...agent,...form}); toast.success('Agent saved') }
      else toast.error(d.error||'Save failed')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  function addKeyword() {
    if (!kwInput.trim()) return
    const kw = [...(form.emergency_keywords||[]), kwInput.trim()]
    upd('emergency_keywords', kw)
    setKwInput('')
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
      {/* Left col */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={card}>
          <h3 style={{ margin:'0 0 14px', fontFamily:FH, fontSize:15 }}>Business Info</h3>
          <label style={{ fontSize:12, color:'#6b7280', marginBottom:4, display:'block' }}>Business Name</label>
          <input style={input} value={form.business_name||''} onChange={e=>upd('business_name',e.target.value)} />

          <label style={{ fontSize:12, color:'#6b7280', marginTop:12, marginBottom:4, display:'block' }}>Department</label>
          <select style={input} value={form.department||''} onChange={e=>upd('department',e.target.value)}>
            <option value="">Select...</option>
            {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
          </select>

          <label style={{ fontSize:12, color:'#6b7280', marginTop:12, marginBottom:4, display:'block' }}>SIC Code</label>
          <div ref={sicRef} style={{ position:'relative' }}>
            <input style={input} placeholder="Search SIC codes..." value={sicOpen ? sicSearch : (form.sic_code ? `${form.sic_code} — ${SIC_CODES.find(s=>s.code===form.sic_code)?.label||''}` : '')}
              onFocus={()=>{setSicOpen(true);setSicSearch('')}} onChange={e=>{setSicSearch(e.target.value);setSicOpen(true)}} />
            {sicOpen && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, maxHeight:200, overflowY:'auto', background:'#fff', border:'1px solid #d1d5db', borderRadius:8, zIndex:10, boxShadow:'0 4px 12px rgba(0,0,0,.1)' }}>
                {filteredSic.map(s => (
                  <div key={s.code} onClick={()=>{upd('sic_code',s.code);setSicOpen(false)}} style={{ padding:'6px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f3f4f6' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <strong>{s.code}</strong> — {s.label} <span style={{ color:'#6b7280', fontSize:11 }}>{s.division}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Phone */}
        <div style={card}>
          <h3 style={{ margin:'0 0 14px', fontFamily:FH, fontSize:15 }}><Phone size={16} style={{ marginRight:6 }} />Phone Number</h3>
          {form.phone_number ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18, fontWeight:700, fontFamily:FH, color:GRN }}>{form.phone_number}</span>
              <span style={badge(GRN)}>Active</span>
            </div>
          ) : (
            <div>
              <p style={{ fontSize:13, color:'#6b7280', marginBottom:8 }}>Get a Koto Number</p>
              <div style={{ display:'flex', gap:8 }}>
                <input style={{ ...input, width:100 }} placeholder="Area code" value={form._area_code||''} onChange={e=>upd('_area_code',e.target.value)} />
                <button onClick={provisionNumber} style={btn()}>Provision</button>
              </div>
              <div style={{ margin:'12px 0', color:'#6b7280', fontSize:12, textAlign:'center' }}>— or —</div>
              <label style={{ fontSize:12, color:'#6b7280', marginBottom:4, display:'block' }}>Forward an Existing Number</label>
              <input style={input} placeholder="+1 (555) 123-4567" value={form.forward_number||''} onChange={e=>upd('forward_number',e.target.value)} />
            </div>
          )}
        </div>

        {/* Emergency Keywords */}
        <div style={card}>
          <h3 style={{ margin:'0 0 14px', fontFamily:FH, fontSize:15 }}><AlertCircle size={16} style={{ marginRight:6 }} />Emergency Keywords</h3>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
            {(form.emergency_keywords||[]).map((kw,i)=>(
              <span key={i} style={{ ...badge('#fef2f2',R), display:'flex', alignItems:'center', gap:4 }}>
                {kw} <X size={12} style={{ cursor:'pointer' }} onClick={()=>upd('emergency_keywords',(form.emergency_keywords||[]).filter((_,j)=>j!==i))} />
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input style={input} placeholder="Add keyword..." value={kwInput} onChange={e=>setKwInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addKeyword()} />
            <button onClick={addKeyword} style={btn('#374151')}>Add</button>
          </div>
        </div>
      </div>

      {/* Right col */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {/* Business Hours */}
        <div style={card}>
          <h3 style={{ margin:'0 0 14px', fontFamily:FH, fontSize:15 }}><Clock size={16} style={{ marginRight:6 }} />Business Hours</h3>
          {DAYS.map(day=>(
            <div key={day} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <label style={{ width:40, fontSize:13, fontWeight:600 }}>{day}</label>
              <button onClick={()=>setHour(day,'enabled',!hours[day]?.enabled)} style={{ width:36, height:22, borderRadius:11, border:'none', background:hours[day]?.enabled?GRN:'#d1d5db', cursor:'pointer', position:'relative', transition:'background .2s' }}>
                <div style={{ width:18, height:18, borderRadius:9, background:'#fff', position:'absolute', top:2, left:hours[day]?.enabled?16:2, transition:'left .2s' }} />
              </button>
              {hours[day]?.enabled ? (
                <>
                  <input type="time" style={{ ...input, width:120 }} value={hours[day]?.open||'09:00'} onChange={e=>setHour(day,'open',e.target.value)} />
                  <span style={{ color:'#6b7280' }}>to</span>
                  <input type="time" style={{ ...input, width:120 }} value={hours[day]?.close||'17:00'} onChange={e=>setHour(day,'close',e.target.value)} />
                </>
              ) : <span style={{ color:'#6b7280', fontSize:12 }}>Closed</span>}
            </div>
          ))}
          <label style={{ fontSize:12, color:'#6b7280', marginTop:12, marginBottom:4, display:'block' }}>Timezone</label>
          <select style={input} value={form.timezone||'America/New_York'} onChange={e=>upd('timezone',e.target.value)}>
            {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz.replace(/_/g,' ')}</option>)}
          </select>
        </div>

        {/* Toggles */}
        <div style={card}>
          <h3 style={{ margin:'0 0 14px', fontFamily:FH, fontSize:15 }}><Settings size={16} style={{ marginRight:6 }} />Settings</h3>
          {[
            { key:'hipaa_compliant', label:'HIPAA Compliant', icon:<Shield size={14}/> },
            { key:'recording_enabled', label:'Call Recording', icon:<Volume2 size={14}/> },
            { key:'sms_notifications', label:'SMS Notifications', icon:<MessageSquare size={14}/> },
            { key:'email_notifications', label:'Email Notifications', icon:<Mail size={14}/> },
          ].map(t=>(
            <div key={t.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>{t.icon} {t.label}</div>
              <button onClick={()=>upd(t.key,!form[t.key])} style={{ width:36, height:22, borderRadius:11, border:'none', background:form[t.key]?GRN:'#d1d5db', cursor:'pointer', position:'relative', transition:'background .2s' }}>
                <div style={{ width:18, height:18, borderRadius:9, background:'#fff', position:'absolute', top:2, left:form[t.key]?16:2, transition:'left .2s' }} />
              </button>
            </div>
          ))}
          {form.sms_notifications && (
            <div style={{ marginTop:8 }}>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>SMS Number</label>
              <input style={input} placeholder="+1..." value={form.sms_number||''} onChange={e=>upd('sms_number',e.target.value)} />
            </div>
          )}
          {form.email_notifications && (
            <div style={{ marginTop:8 }}>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Notification Email</label>
              <input style={input} placeholder="alerts@..." value={form.notification_email||''} onChange={e=>upd('notification_email',e.target.value)} />
            </div>
          )}
        </div>

        <button onClick={saveAgent} disabled={saving} style={{ ...btn(), width:'100%', justifyContent:'center', padding:'12px 0', opacity:saving?.6:1 }}>
          {saving ? <Loader2 size={16} className="spin" /> : <Check size={16}/>} {saving ? 'Saving...' : 'Save Agent'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — VOICE & GREETING
// ═══════════════════════════════════════════════════════════════════════════════
function VoiceGreetingTab({ agent, setAgent }) {
  // Section → DB column mapping. Scripts are individual columns, not a nested `scripts` jsonb.
  const SECTION_COLS = {
    greeting: 'greeting_script',
    open_hours: 'open_hours_script',
    closed_hours: 'closed_hours_script',
    emergency: 'emergency_script',
    voicemail: 'voicemail_script',
  }
  const [scripts, setScripts] = useState(() => {
    const init = {}
    for (const [section, col] of Object.entries(SECTION_COLS)) {
      init[section] = agent[col] || agent.scripts?.[section] || ''
    }
    return init
  })
  const [generating, setGenerating] = useState(null)
  const [saving, setSaving] = useState(false)

  async function generateScript(section) {
    setGenerating(section)
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'generate_script', section, business_context:{ name:agent.name||agent.business_name, department:agent.department, sic:agent.sic_code, hours:agent.business_hours }})
      })
      const d = await res.json()
      if (d.script) { setScripts(p=>({...p,[section]:d.script})); toast.success(`Generated ${section.replace(/_/g,' ')} script`) }
      else toast.error(d.error||'Generation failed')
    } catch { toast.error('Generation failed') }
    setGenerating(null)
  }

  async function handleVoiceSelect(voiceId) {
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'update_agent', agent_id:agent.id, voice_id:voiceId })
      })
      const d = await res.json().catch(()=>({}))
      if (d.success) { setAgent({...agent, voice_id:voiceId}); toast.success('Voice updated') }
      else toast.error(d.error||'Voice update failed')
    } catch { toast.error('Failed to update voice') }
  }

  async function saveScripts() {
    setSaving(true)
    try {
      // Send as flat columns so the update_agent whitelist accepts them.
      const updates = {}
      for (const [section, col] of Object.entries(SECTION_COLS)) {
        updates[col] = scripts[section] || ''
      }
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'update_agent', agent_id:agent.id, ...updates })
      })
      const d = await res.json().catch(()=>({}))
      if (d.success) {
        const nextAgent = { ...agent, ...updates }
        setAgent(nextAgent)
        toast.success('Scripts saved')
      } else toast.error(d.error||'Save failed')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  const sections = [
    { key:'greeting', label:'Greeting', icon:<PhoneIncoming size={14}/> },
    { key:'open_hours', label:'Open Hours Response', icon:<Clock size={14}/> },
    { key:'closed_hours', label:'Closed Hours Response', icon:<PhoneOff size={14}/> },
    { key:'emergency', label:'Emergency Response', icon:<AlertCircle size={14}/> },
    { key:'voicemail', label:'Voicemail Message', icon:<Volume2 size={14}/> },
  ]

  // ── Voice settings (Retell speech config — matched to VOB agent defaults) ─
  // interruption_sensitivity is stored as a Retell-native number (0.0–1.0).
  // Legacy rows that stored "low"/"medium"/"high" strings are coerced below.
  function coerceInterrupt(v) {
    if (typeof v === 'number') return v
    if (v === 'low') return 0.3
    if (v === 'high') return 0.8
    return 0.5
  }
  const [voiceSettings, setVoiceSettings] = useState({
    voice_speed: agent.voice_speed ?? 0.95,
    voice_temperature: agent.voice_temperature ?? 1.0,
    interruption_sensitivity: coerceInterrupt(agent.interruption_sensitivity ?? 0.3),
    backchannel_frequency: agent.backchannel_frequency ?? 0.7,
    enable_backchannel: agent.enable_backchannel === true,
    ambient_sound: agent.ambient_sound || 'none',
    responsiveness: agent.responsiveness ?? 0.7,
    end_call_after_silence_ms: agent.end_call_after_silence_ms ?? 30000,
    reminder_trigger_ms: agent.reminder_trigger_ms ?? 10000,
    reminder_max_count: agent.reminder_max_count ?? 2,
    max_call_duration_ms: agent.max_call_duration_ms ?? 1800000,
  })
  const [savingVoice, setSavingVoice] = useState(false)

  async function saveVoiceSettings() {
    setSavingVoice(true)
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'update_agent', agent_id:agent.id, ...voiceSettings })
      })
      const d = await res.json().catch(()=>({}))
      if (d.success) { setAgent({ ...agent, ...voiceSettings }); toast.success('Voice settings saved') }
      else toast.error(d.error||'Save failed')
    } catch { toast.error('Save failed') }
    setSavingVoice(false)
  }

  const AMBIENT_OPTIONS = [
    { v:'none', l:'None' },
    { v:'office', l:'Office' },
    { v:'coffee-shop', l:'Coffee Shop' },
    { v:'convention-hall', l:'Convention Hall' },
    { v:'summer-outdoor', l:'Summer Outdoor' },
    { v:'mountain-outdoor', l:'Mountain Outdoor' },
    { v:'static-noise', l:'Static Noise' },
    { v:'call-center', l:'Call Center' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={card}>
        <h3 style={{ margin:'0 0 14px', fontFamily:FH, fontSize:15 }}>Agent Voice</h3>
        <VoiceSelector selectedVoiceId={agent.voice_id} onSelect={handleVoiceSelect} maxHeight="350px" />
      </div>

      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <h3 style={{ margin:0, fontFamily:FH, fontSize:15 }}><Settings size={16} style={{ marginRight:6, verticalAlign:'-3px' }}/>Voice Controls</h3>
          <button onClick={saveVoiceSettings} disabled={savingVoice} style={btn()}>
            {savingVoice ? <Loader2 size={14} className="spin"/> : <Check size={14}/>} Save
          </button>
        </div>
        <p style={{ fontSize:12, color:'#6b7280', marginTop:0, marginBottom:14 }}>Retell speech parameters — tune how the agent sounds on calls.</p>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:6 }}>
              Speaking Speed · <strong style={{ color:BLK }}>{voiceSettings.voice_speed.toFixed(2)}x</strong>
            </label>
            <input type="range" min="0.5" max="2.0" step="0.05" value={voiceSettings.voice_speed}
              onChange={e=>setVoiceSettings(p=>({...p, voice_speed:parseFloat(e.target.value)}))} style={{ width:'100%' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
              <span>Slower</span><span>1.00x</span><span>Faster</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:6 }}>
              Voice Temperature · <strong style={{ color:BLK }}>{voiceSettings.voice_temperature.toFixed(2)}</strong>
            </label>
            <input type="range" min="0" max="2" step="0.05" value={voiceSettings.voice_temperature}
              onChange={e=>setVoiceSettings(p=>({...p, voice_temperature:parseFloat(e.target.value)}))} style={{ width:'100%' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
              <span>Flat</span><span>Expressive</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:6 }}>
              Responsiveness · <strong style={{ color:BLK }}>{voiceSettings.responsiveness.toFixed(2)}</strong>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={voiceSettings.responsiveness}
              onChange={e=>setVoiceSettings(p=>({...p, responsiveness:parseFloat(e.target.value)}))} style={{ width:'100%' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
              <span>Contemplative</span><span>Quick</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:6 }}>
              Interruption Sensitivity · <strong style={{ color:BLK }}>{voiceSettings.interruption_sensitivity.toFixed(2)}</strong>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={voiceSettings.interruption_sensitivity}
              onChange={e=>setVoiceSettings(p=>({...p, interruption_sensitivity:parseFloat(e.target.value)}))} style={{ width:'100%' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
              <span>Patient</span><span>0.30 (VOB default)</span><span>Eager</span>
            </div>
          </div>

          <div style={{ gridColumn:'1 / -1', display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderTop:'1px solid #f3f4f6' }}>
            <button onClick={()=>setVoiceSettings(p=>({...p, enable_backchannel:!p.enable_backchannel}))} style={{
              width:40, height:22, borderRadius:99, border:'none', cursor:'pointer', position:'relative',
              background:voiceSettings.enable_backchannel?GRN:'#d1d5db', transition:'background .2s',
            }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:voiceSettings.enable_backchannel?21:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
            </button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, fontFamily:FH }}>Backchanneling</div>
              <div style={{ fontSize:11, color:'#6b7280' }}>Natural "mm-hmm", "I see", "right" while the caller speaks.</div>
            </div>
            {voiceSettings.enable_backchannel && (
              <div style={{ width:180 }}>
                <label style={{ fontSize:11, color:'#6b7280', display:'block' }}>
                  Frequency · <strong style={{ color:BLK }}>{voiceSettings.backchannel_frequency.toFixed(2)}</strong>
                </label>
                <input type="range" min="0" max="1" step="0.05" value={voiceSettings.backchannel_frequency}
                  onChange={e=>setVoiceSettings(p=>({...p, backchannel_frequency:parseFloat(e.target.value)}))} style={{ width:'100%' }}/>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:6 }}>
              Ambient Sound
            </label>
            <select style={input} value={voiceSettings.ambient_sound}
              onChange={e=>setVoiceSettings(p=>({...p, ambient_sound:e.target.value}))}>
              {AMBIENT_OPTIONS.map(a=><option key={a.v} value={a.v}>{a.l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid #f3f4f6' }}>
          <h4 style={{ margin:'0 0 4px', fontFamily:FH, fontSize:13 }}>Turn-Taking &amp; Silence</h4>
          <p style={{ margin:'0 0 12px', fontSize:11, color:'#6b7280' }}>
            How long the agent waits for an answer before nudging, and how patient it is overall.
            Defaults mirror the VOB agent so it asks one question and waits.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16 }}>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Nudge caller after</label>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input type="number" min="3" max="120" step="1" style={{ ...input, width:70 }}
                  value={Math.round(voiceSettings.reminder_trigger_ms/1000)}
                  onChange={e=>setVoiceSettings(p=>({...p, reminder_trigger_ms:Math.max(3000, (parseInt(e.target.value,10)||10)*1000)}))}/>
                <span style={{ fontSize:12, color:'#6b7280' }}>sec</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Max nudges</label>
              <input type="number" min="0" max="5" step="1" style={input}
                value={voiceSettings.reminder_max_count}
                onChange={e=>setVoiceSettings(p=>({...p, reminder_max_count:Math.max(0, parseInt(e.target.value,10)||0)}))}/>
            </div>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>End call after silence</label>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input type="number" min="10" max="600" step="5" style={{ ...input, width:70 }}
                  value={Math.round(voiceSettings.end_call_after_silence_ms/1000)}
                  onChange={e=>setVoiceSettings(p=>({...p, end_call_after_silence_ms:Math.max(10000, (parseInt(e.target.value,10)||30)*1000)}))}/>
                <span style={{ fontSize:12, color:'#6b7280' }}>sec</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Max call length</label>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input type="number" min="1" max="120" step="1" style={{ ...input, width:70 }}
                  value={Math.round(voiceSettings.max_call_duration_ms/60000)}
                  onChange={e=>setVoiceSettings(p=>({...p, max_call_duration_ms:Math.max(60000, (parseInt(e.target.value,10)||30)*60000)}))}/>
                <span style={{ fontSize:12, color:'#6b7280' }}>min</span>
              </div>
            </div>
          </div>
          <p style={{ margin:'10px 0 0', fontSize:11, color:'#9ca3af' }}>
            The agent won't re-ask the same question unprompted — it waits for an answer, then nudges once with a rephrased prompt after the silence window.
          </p>
        </div>
      </div>

      {sections.map(s => (
        <div key={s.key} style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <h3 style={{ margin:0, fontFamily:FH, fontSize:14, display:'flex', alignItems:'center', gap:6 }}>{s.icon} {s.label}</h3>
            <button onClick={()=>generateScript(s.key)} disabled={generating===s.key} style={btn(PURP)}>
              {generating===s.key ? <Loader2 size={14} className="spin"/> : <Sparkles size={14}/>} Generate with AI
            </button>
          </div>
          <textarea style={{ ...input, minHeight:90, resize:'vertical' }} value={scripts[s.key]} onChange={e=>setScripts(p=>({...p,[s.key]:e.target.value}))}
            placeholder={`Enter ${s.label.toLowerCase()} script...`} />
        </div>
      ))}

      <button onClick={saveScripts} disabled={saving} style={{ ...btn(), padding:'12px 0', justifyContent:'center' }}>
        {saving ? <Loader2 size={16} className="spin"/> : <Check size={16}/>} {saving ? 'Saving...' : 'Save Scripts'}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — INTAKE FORM
// ═══════════════════════════════════════════════════════════════════════════════
function IntakeFormTab({ agent, setAgent }) {
  const QTYPES = ['text','phone','email','date','number','boolean']
  const [builtinTemplates, setBuiltinTemplates] = useState([])
  const [customTemplates, setCustomTemplates] = useState(agent.intake_templates_saved || [])
  const [selectedTemplate, setSelectedTemplate] = useState(agent.intake_template || null)
  const [questions, setQuestions] = useState(() => (agent.intake_questions || []).map(q=>({ type:'text', enabled:true, ...q })))
  const [loadingTpl, setLoadingTpl] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    (async () => {
      setLoadingTpl(true)
      try {
        const res = await fetch('/api/inbound?action=get_intake_templates')
        if (res.ok) { const d = await res.json(); setBuiltinTemplates(d.templates || []) }
      } catch (e) { console.error(e) }
      setLoadingTpl(false)
    })()
  }, [])

  function applyTemplate(tpl) {
    setSelectedTemplate(tpl.id)
    setQuestions((tpl.questions || []).map(q=>({ type:'text', enabled:true, ...q })))
    toast.success(`Applied "${tpl.name}" template`)
  }

  function toggleQuestion(idx) { setQuestions(prev => prev.map((q,i) => i===idx ? {...q, enabled:!q.enabled} : q)) }
  function updateQuestion(idx, patch) { setQuestions(prev => prev.map((q,i) => i===idx ? {...q, ...patch} : q)) }
  function removeQuestion(idx) { setQuestions(prev => prev.filter((_,i)=>i!==idx)) }
  function addQuestion() {
    if (!newQ.trim()) return
    setQuestions(prev => [...prev, { text:newQ.trim(), type:'text', enabled:true }])
    setNewQ('')
  }
  function moveQuestion(idx, dir) {
    setQuestions(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  async function saveIntake() {
    setSaving(true)
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'update_agent', agent_id:agent.id, intake_questions:questions, intake_template:selectedTemplate })
      })
      const d = await res.json().catch(()=>({}))
      if (d.success) { setAgent({...agent, intake_questions:questions, intake_template:selectedTemplate}); toast.success('Intake form saved') }
      else toast.error(d.error||'Save failed')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  async function saveAsTemplate() {
    const name = templateName.trim()
    if (!name) { toast.error('Template name required'); return }
    if (questions.length === 0) { toast.error('Add questions first'); return }
    setSavingTemplate(true)
    try {
      const newTpl = { id: `custom_${Date.now()}`, name, industry: 'custom', questions: questions.map(({ enabled, ...q }) => { void enabled; return q }) }
      const nextList = [...customTemplates.filter(t => t.name !== name), newTpl]
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'update_agent', agent_id:agent.id, intake_templates_saved: nextList })
      })
      const d = await res.json().catch(()=>({}))
      if (d.success) {
        setCustomTemplates(nextList)
        setSelectedTemplate(newTpl.id)
        setTemplateName('')
        setAgent({ ...agent, intake_templates_saved: nextList, intake_template: newTpl.id })
        toast.success(`Saved "${name}" as a template`)
      } else toast.error(d.error||'Save failed')
    } catch { toast.error('Save failed') }
    setSavingTemplate(false)
  }

  async function deleteCustomTemplate(id) {
    if (!confirm('Delete this custom template?')) return
    const nextList = customTemplates.filter(t => t.id !== id)
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'update_agent', agent_id:agent.id, intake_templates_saved: nextList })
      })
      const d = await res.json().catch(()=>({}))
      if (d.success) { setCustomTemplates(nextList); setAgent({ ...agent, intake_templates_saved: nextList }); toast.success('Template deleted') }
      else toast.error(d.error||'Delete failed')
    } catch { toast.error('Delete failed') }
  }

  const allTemplates = [
    ...customTemplates.map(t => ({ ...t, _custom: true })),
    ...builtinTemplates.map(t => ({ ...t, _custom: false })),
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <h3 style={{ margin:0, fontFamily:FH, fontSize:15 }}><FileText size={16} style={{ marginRight:6, verticalAlign:'-3px' }}/>Intake Templates</h3>
          <span style={{ fontSize:11, color:'#6b7280' }}>{customTemplates.length} custom · {builtinTemplates.length} built-in</span>
        </div>
        {loadingTpl ? <div style={{ textAlign:'center', padding:20 }}><Loader2 size={20} className="spin" color={R}/></div> : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
            {allTemplates.map(tpl => (
              <div key={tpl.id} onClick={()=>applyTemplate(tpl)} style={{
                padding:14, borderRadius:10, border: selectedTemplate===tpl.id ? `2px solid ${R}` : '1px solid #e5e7eb',
                cursor:'pointer', background: selectedTemplate===tpl.id ? 'rgba(234,39,41,.04)' : '#fafafa', transition:'all .15s', position:'relative'
              }}>
                {tpl._custom && (
                  <Trash2 size={13} color="#9ca3af" style={{ position:'absolute', top:8, right:8, cursor:'pointer' }}
                    onClick={(e)=>{ e.stopPropagation(); deleteCustomTemplate(tpl.id) }} />
                )}
                <div style={{ fontWeight:600, fontSize:13, marginBottom:4, paddingRight:tpl._custom?16:0 }}>{tpl.name}</div>
                <div style={{ fontSize:12, color:'#6b7280' }}>{tpl.questions?.length || 0} questions</div>
                {tpl._custom
                  ? <span style={badge('rgba(234,39,41,.1)', R)}>Custom</span>
                  : tpl.industry && <span style={badge('#f3f4f6','#374151')}>{tpl.industry}</span>
                }
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <h3 style={{ margin:0, fontFamily:FH, fontSize:15 }}>Questions</h3>
          <span style={{ fontSize:11, color:'#6b7280' }}>{questions.filter(q=>q.enabled!==false).length} active · {questions.length} total</span>
        </div>
        {questions.length===0 ? <p style={{ color:'#6b7280', fontSize:13 }}>Select a template above or add a question below.</p> : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {questions.map((q,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, background:q.enabled!==false?'#f9fafb':'#fafafa', border:'1px solid #e5e7eb' }}>
                <button onClick={()=>toggleQuestion(i)} title={q.enabled!==false?'Disable':'Enable'} style={{ width:22, height:22, borderRadius:6, border:`2px solid ${q.enabled!==false?GRN:'#d1d5db'}`, background:q.enabled!==false?GRN:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {q.enabled!==false && <Check size={13} color="#fff"/>}
                </button>
                <input style={{ ...input, padding:'4px 8px', flex:1, background:'#fff' }} value={q.text||''} onChange={e=>updateQuestion(i,{text:e.target.value})} />
                <select style={{ ...input, padding:'4px 6px', width:100, background:'#fff' }} value={q.type||'text'} onChange={e=>updateQuestion(i,{type:e.target.value})}>
                  {QTYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                <div style={{ display:'flex', gap:2 }}>
                  <button onClick={()=>moveQuestion(i,-1)} disabled={i===0} title="Move up" style={{ background:'none', border:'none', cursor:i===0?'default':'pointer', opacity:i===0?.3:.7 }}>▲</button>
                  <button onClick={()=>moveQuestion(i,1)} disabled={i===questions.length-1} title="Move down" style={{ background:'none', border:'none', cursor:i===questions.length-1?'default':'pointer', opacity:i===questions.length-1?.3:.7 }}>▼</button>
                </div>
                <Trash2 size={14} color="#9ca3af" style={{ cursor:'pointer', flexShrink:0 }} onClick={()=>removeQuestion(i)} />
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <input style={input} placeholder="Add a custom question..." value={newQ} onChange={e=>setNewQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addQuestion()} />
          <button onClick={addQuestion} style={btn('#374151')}><Plus size={14}/> Add</button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin:'0 0 10px', fontFamily:FH, fontSize:15 }}><Sparkles size={16} style={{ marginRight:6, verticalAlign:'-3px', color:PURP }}/>Save Questions as Template</h3>
        <p style={{ margin:'0 0 10px', fontSize:12, color:'#6b7280' }}>Save the current question set as a reusable custom template for this agent.</p>
        <div style={{ display:'flex', gap:8 }}>
          <input style={input} placeholder="Template name (e.g. Emergency Intake)" value={templateName} onChange={e=>setTemplateName(e.target.value)} />
          <button onClick={saveAsTemplate} disabled={savingTemplate||!templateName.trim()||questions.length===0} style={btn(PURP)}>
            {savingTemplate ? <Loader2 size={14} className="spin"/> : <Sparkles size={14}/>} Save Template
          </button>
        </div>
      </div>

      <button onClick={saveIntake} disabled={saving} style={{ ...btn(), padding:'12px 0', justifyContent:'center' }}>
        {saving ? <Loader2 size={16} className="spin"/> : <Check size={16}/>} {saving ? 'Saving...' : 'Save Intake Form'}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB — LIVE MONITOR (polls Retell for in-progress calls + streaming transcript)
// ═══════════════════════════════════════════════════════════════════════════════
function LiveMonitorTab({ agent }) {
  const [liveCalls, setLiveCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCallId, setSelectedCallId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const transcriptEndRef = useRef(null)

  async function fetchLive() {
    try {
      const res = await fetch(`/api/inbound?action=get_live_calls&agent_id=${agent.id}`)
      const d = await res.json().catch(()=>({}))
      const calls = Array.isArray(d.calls) ? d.calls : []
      setLiveCalls(calls)
      if (!selectedCallId && calls.length > 0) setSelectedCallId(calls[0].call_id)
      if (selectedCallId && !calls.find(c => c.call_id === selectedCallId)) setSelectedCallId(calls[0]?.call_id || null)
    } catch {}
    setLoading(false)
  }

  async function fetchDetail(id) {
    if (!id) return
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/inbound?action=get_live_call_detail&call_id=${id}`)
      const d = await res.json().catch(()=>({}))
      if (d.call) setDetail(d.call)
    } catch {}
    setDetailLoading(false)
  }

  // Poll the list every 5s, poll the selected call's transcript every 2s.
  useEffect(() => {
    fetchLive()
    const t = setInterval(fetchLive, 5000)
    return () => clearInterval(t)
  }, [agent.id])

  useEffect(() => {
    if (!selectedCallId) { setDetail(null); return }
    fetchDetail(selectedCallId)
    const t = setInterval(() => fetchDetail(selectedCallId), 2000)
    return () => clearInterval(t)
  }, [selectedCallId])

  // Auto-scroll transcript to bottom as new lines arrive.
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [detail?.transcript])

  const lines = (() => {
    const arr = detail?.transcript_with_tool_calls || []
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.filter(e => e.role === 'agent' || e.role === 'user').map((e, i) => ({ i, role: e.role, content: e.content || '' }))
    }
    // Fallback: split the flat transcript into turns by "User:" / "Agent:" prefixes
    const t = detail?.transcript || ''
    return t.split(/\n(?=(?:User:|Agent:))/).map((chunk, i) => {
      const role = chunk.startsWith('User:') ? 'user' : chunk.startsWith('Agent:') ? 'agent' : 'system'
      return { i, role, content: chunk.replace(/^(User:|Agent:)\s*/, '') }
    }).filter(l => l.content.trim())
  })()

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:10, height:10, borderRadius:99, background: liveCalls.length > 0 ? GRN : '#d1d5db', boxShadow: liveCalls.length > 0 ? `0 0 0 4px ${GRN}25` : 'none', animation: liveCalls.length > 0 ? 'pulse-live 2s infinite' : 'none' }}/>
        <h3 style={{ margin:0, fontFamily:FH, fontSize:15 }}>Live Monitor</h3>
        <span style={{ fontSize:12, color:'#6b7280' }}>{liveCalls.length} active call{liveCalls.length===1?'':'s'}</span>
        <div style={{ flex:1 }}/>
        <button onClick={fetchLive} style={btn('#e5e7eb', BLK)}><RefreshCw size={14}/> Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} className="spin" color={R}/></div>
      ) : liveCalls.length === 0 ? (
        <div style={{ ...card, textAlign:'center', padding:40 }}>
          <PhoneIncoming size={32} color='#d1d5db' style={{ marginBottom:8 }}/>
          <p style={{ color:'#6b7280', margin:0 }}>No active calls right now.</p>
          <p style={{ color:'#9ca3af', fontSize:12, marginTop:6 }}>When a call comes in, it'll appear here live with the transcript updating in real time.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {liveCalls.map(c => {
              const elapsed = c.start_timestamp ? Math.floor((Date.now() - c.start_timestamp) / 1000) : 0
              return (
                <div key={c.call_id} onClick={()=>setSelectedCallId(c.call_id)} style={{
                  padding:12, borderRadius:10, cursor:'pointer', transition:'all .15s',
                  background: selectedCallId===c.call_id ? 'rgba(234,39,41,.06)' : '#fff',
                  border: selectedCallId===c.call_id ? `2px solid ${R}` : '1px solid #e5e7eb',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <div style={{ width:6, height:6, borderRadius:99, background:GRN, animation:'pulse-live 2s infinite' }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:GRN }}>LIVE</span>
                    <span style={{ fontSize:11, color:'#6b7280', fontFamily:'ui-monospace, Menlo, monospace', marginLeft:'auto' }}>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{c.from_number || 'Unknown'}</div>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{c.call_status}</div>
                </div>
              )
            })}
          </div>

          <div style={card}>
            {!selectedCallId ? (
              <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:13 }}>Select a call to listen in</div>
            ) : !detail ? (
              <div style={{ textAlign:'center', padding:40 }}><Loader2 size={20} className="spin" color={R}/></div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12, maxHeight:500 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, paddingBottom:10, borderBottom:'1px solid #f3f4f6' }}>
                  <div style={{ width:8, height:8, borderRadius:99, background:GRN, animation:'pulse-live 2s infinite' }}/>
                  <strong style={{ fontSize:14 }}>{detail.from_number || detail.to_number || 'Unknown caller'}</strong>
                  {detailLoading && <Loader2 size={12} className="spin" color="#9ca3af"/>}
                  <div style={{ flex:1 }}/>
                  <span style={{ fontSize:11, color:'#6b7280' }}>{detail.call_status}</span>
                </div>
                <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, padding:'4px 0', maxHeight:420 }}>
                  {lines.length === 0 ? (
                    <div style={{ textAlign:'center', padding:30, color:'#9ca3af', fontSize:12 }}>Waiting for transcript…</div>
                  ) : lines.map(l => (
                    <div key={l.i} style={{ display:'flex', flexDirection:l.role==='user'?'row-reverse':'row', gap:8 }}>
                      <div style={{ maxWidth:'75%', padding:'8px 12px', borderRadius:12,
                        background: l.role==='user' ? '#f3f4f6' : 'rgba(234,39,41,.06)',
                        borderTopLeftRadius: l.role==='user'?12:2,
                        borderTopRightRadius: l.role==='user'?2:12,
                        fontSize:13, lineHeight:1.5,
                      }}>
                        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color: l.role==='user'?'#374151':R, marginBottom:4 }}>
                          {l.role==='user' ? 'Caller' : 'Agent'}
                        </div>
                        {l.content}
                      </div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef}/>
                </div>
                <div style={{ fontSize:11, color:'#9ca3af', textAlign:'center' }}>Updating every 2 seconds</div>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes pulse-live { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }`}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — CALL LOG
// ═══════════════════════════════════════════════════════════════════════════════
function CallLogTab({ agent }) {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [filters, setFilters] = useState({ urgency:'all', outcome:'all', sentiment:'all' })
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/inbound?action=get_calls&agent_id=${agent.id}`)
        if (res.ok) { const d = await res.json(); setCalls(d.calls || []) }
      } catch (e) { console.error(e) }
      setLoading(false)
    })()
  }, [agent.id])

  const filtered = calls.filter(c => {
    if (filters.urgency!=='all' && c.urgency!==filters.urgency) return false
    if (filters.outcome!=='all' && c.outcome!==filters.outcome) return false
    if (filters.sentiment!=='all' && c.sentiment!==filters.sentiment) return false
    return true
  })

  const urgencyColor = u => u==='high'?R:u==='medium'?AMB:GRN
  const sentimentColor = s => s==='positive'?GRN:s==='negative'?R:AMB
  const outcomeColor = o => o==='appointment'?PURP:o==='resolved'?GRN:o==='escalated'?R:AMB

  function togglePlay(call) {
    if (playing===call.id) { audioRef.current?.pause(); setPlaying(null) }
    else { if (audioRef.current) { audioRef.current.src=call.recording_url; audioRef.current.play() }; setPlaying(call.id) }
  }

  function exportCSV() {
    const header = 'Date,Caller,Duration,Urgency,Outcome,Sentiment,Summary\n'
    const rows = filtered.map(c => `"${c.date||''}","${c.caller_name||c.caller_number||''}","${c.duration||''}","${c.urgency||''}","${c.outcome||''}","${c.sentiment||''}","${(c.ai_summary||'').replace(/"/g,'""')}"`).join('\n')
    const blob = new Blob([header+rows],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`calls_${agent.business_name||'agent'}_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <audio ref={audioRef} onEnded={()=>setPlaying(null)} style={{ display:'none' }} />

      {/* Filters */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <select style={{ ...input, width:140 }} value={filters.urgency} onChange={e=>setFilters(p=>({...p,urgency:e.target.value}))}>
          <option value="all">All Urgency</option>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <select style={{ ...input, width:140 }} value={filters.outcome} onChange={e=>setFilters(p=>({...p,outcome:e.target.value}))}>
          <option value="all">All Outcomes</option>
          <option value="appointment">Appointment</option><option value="resolved">Resolved</option><option value="escalated">Escalated</option><option value="voicemail">Voicemail</option>
        </select>
        <select style={{ ...input, width:140 }} value={filters.sentiment} onChange={e=>setFilters(p=>({...p,sentiment:e.target.value}))}>
          <option value="all">All Sentiment</option>
          <option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option>
        </select>
        <div style={{ flex:1 }} />
        <button onClick={exportCSV} style={btn('#374151')}><Download size={14}/> Export CSV</button>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} className="spin" color={R}/></div> : filtered.length===0 ? (
        <div style={{ ...card, textAlign:'center', padding:40 }}>
          <PhoneOff size={32} color='#d1d5db' style={{ marginBottom:8 }} />
          <p style={{ color:'#6b7280' }}>No calls match your filters</p>
        </div>
      ) : (
        <div style={card}>
          {/* Header */}
          <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 80px 80px 90px 80px', gap:8, padding:'8px 12px', borderBottom:'2px solid #e5e7eb', fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>
            <span>Date</span><span>Caller</span><span>Duration</span><span>Urgency</span><span>Outcome</span><span>Sentiment</span>
          </div>
          {filtered.map(c => (
            <div key={c.id}>
              <div onClick={()=>setExpanded(expanded===c.id?null:c.id)} style={{
                display:'grid', gridTemplateColumns:'140px 1fr 80px 80px 90px 80px', gap:8, padding:'10px 12px', borderBottom:'1px solid #f3f4f6',
                cursor:'pointer', background:expanded===c.id?'#fafafa':'transparent', alignItems:'center'
              }}>
                <span style={{ fontSize:12, color:'#6b7280' }}>{c.date ? new Date(c.date).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—'}</span>
                <span style={{ fontSize:13, fontWeight:500 }}>{c.caller_name || c.caller_number || 'Unknown'}</span>
                <span style={{ fontSize:12, color:'#6b7280' }}>{c.duration ? `${Math.floor(c.duration/60)}:${String(c.duration%60).padStart(2,'0')}` : '—'}</span>
                <span style={badge(urgencyColor(c.urgency)+'20', urgencyColor(c.urgency))}>{c.urgency||'—'}</span>
                <span style={badge(outcomeColor(c.outcome)+'20', outcomeColor(c.outcome))}>{c.outcome||'—'}</span>
                <span style={badge(sentimentColor(c.sentiment)+'20', sentimentColor(c.sentiment))}>{c.sentiment||'—'}</span>
              </div>
              {expanded===c.id && (
                <CallDetailPanel call={c} playing={playing} togglePlay={togglePlay} onUpdate={updated => setCalls(prev => prev.map(x => x.id===updated.id ? updated : x))} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALL DETAIL PANEL — expanded row inside CallLogTab
// Renders caller card, downloads, transcript, notes, resolve/follow-up actions.
// ═══════════════════════════════════════════════════════════════════════════════
function CallDetailPanel({ call, playing, togglePlay, onUpdate }) {
  const c = call
  const details = c.caller_details || c.intake_data || {}
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUpAt, setFollowUpAt] = useState(c.follow_up_at ? new Date(c.follow_up_at).toISOString().slice(0,16) : '')

  async function mutate(action, extra) {
    setSaving(true)
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action, call_id: c.id, ...extra })
      })
      const d = await res.json().catch(()=>({}))
      if (d.success) { onUpdate?.(d.call || { ...c, ...extra }); toast.success('Saved') }
      else toast.error(d.error || 'Save failed')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  async function regenerateVoice() {
    setSaving(true)
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'regenerate_summary_audio', call_id: c.id })
      })
      const d = await res.json().catch(()=>({}))
      if (d.summary_audio_url) { onUpdate?.({ ...c, summary_audio_url: d.summary_audio_url }); toast.success('Voice summary regenerated') }
      else toast.error(d.error || 'TTS failed')
    } catch { toast.error('TTS failed') }
    setSaving(false)
  }

  const downloadUrl = (kind) => `/api/inbound/download?call_id=${c.id}&kind=${kind}`
  const row = (label, value) => value ? <div style={{ display:'flex', gap:10, fontSize:13 }}><span style={{ color:'#6b7280', width:110, flexShrink:0 }}>{label}</span><span>{value}</span></div> : null

  return (
    <div style={{ padding:'16px 20px', background:'#fafafa', borderBottom:'1px solid #e5e7eb', display:'flex', flexDirection:'column', gap:14 }}>
      {/* Actions bar */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {c.recording_url && (
          <button onClick={()=>togglePlay(c)} style={btn('#374151')}>
            {playing===c.id ? <Pause size={14}/> : <Play size={14}/>} {playing===c.id ? 'Pause' : 'Play'}
          </button>
        )}
        {c.recording_url && (
          <a href={downloadUrl('recording')} style={{ ...btn('#e5e7eb', BLK), textDecoration:'none' }}>
            <Download size={14}/> Recording
          </a>
        )}
        {c.summary_audio_url
          ? <a href={downloadUrl('summary')} style={{ ...btn(PURP), textDecoration:'none' }}><Download size={14}/> Voice summary</a>
          : <button onClick={regenerateVoice} disabled={saving} style={btn(PURP)}><Sparkles size={14}/> Generate voice summary</button>
        }
        {c.transcript && (
          <a href={downloadUrl('transcript')} style={{ ...btn('#e5e7eb', BLK), textDecoration:'none' }}>
            <Download size={14}/> Transcript (.txt)
          </a>
        )}
        <div style={{ flex:1 }} />
        {!c.resolved_at && (
          <button onClick={()=>mutate('mark_resolved', {})} disabled={saving} style={btn(GRN)}>
            <Check size={14}/> Mark resolved
          </button>
        )}
        <button onClick={()=>setFollowUpOpen(o=>!o)} style={btn('#374151')}>
          <Clock size={14}/> {c.follow_up_at ? 'Edit follow-up' : 'Set follow-up'}
        </button>
      </div>

      {followUpOpen && (
        <div style={{ ...card, padding:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="datetime-local" style={input} value={followUpAt} onChange={e=>setFollowUpAt(e.target.value)} />
            <button onClick={()=>mutate('set_follow_up', { follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null, required: !!followUpAt, follow_up_notes: c.follow_up_notes })} disabled={saving} style={btn()}>Save</button>
            {c.follow_up_at && <button onClick={()=>{ setFollowUpAt(''); mutate('set_follow_up', { follow_up_at: null, required: false }) }} disabled={saving} style={btn('#e5e7eb', BLK)}>Clear</button>}
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Caller card */}
        <div style={{ ...card, padding:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:.6, marginBottom:8 }}>Caller</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {row('Name', details.caller_name || c.caller_name)}
            {row('Phone', details.callback_number || c.caller_number)}
            {row('Email', details.callback_email)}
            {row('Company', details.company_name)}
            {row('Address', details.address)}
            {row('Reason', details.reason_for_calling)}
            {row('Best time', details.best_time_to_reach)}
            {row('Notes', details.additional_notes)}
          </div>
        </div>

        {/* Call metadata + summary */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ ...card, padding:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:.6, marginBottom:8 }}>AI Summary</div>
            <div style={{ fontSize:13, lineHeight:1.5 }}>{c.ai_summary || c.summary || 'Summary unavailable.'}</div>
            {c.quality_score != null && (
              <div style={{ marginTop:10, padding:'8px 10px', background:'#f9fafb', borderRadius:6, fontSize:11, color:'#6b7280' }}>
                <strong style={{ color: c.quality_score>=80?GRN:c.quality_score>=60?AMB:R }}>Quality {c.quality_score}/100</strong>
                {c.quality_notes && <span> · {c.quality_notes}</span>}
              </div>
            )}
          </div>
          <div style={{ ...card, padding:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:.6, marginBottom:8 }}>Metadata</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {row('Duration', c.duration ? `${Math.floor(c.duration/60)}:${String(c.duration%60).padStart(2,'0')}` : '—')}
              {row('Intent', c.intent)}
              {row('Outcome', c.outcome)}
              {row('Sentiment', c.sentiment)}
              {row('Urgency', c.urgency)}
              {row('Resolved', c.resolved_at ? new Date(c.resolved_at).toLocaleString() : null)}
              {row('Follow-up', c.follow_up_at ? new Date(c.follow_up_at).toLocaleString() : null)}
            </div>
          </div>
        </div>
      </div>

      {/* Transcript */}
      {c.transcript && (
        <details style={{ ...card, padding:14 }}>
          <summary style={{ cursor:'pointer', fontSize:12, fontWeight:600, color:'#374151' }}>Full transcript</summary>
          <pre style={{ marginTop:10, whiteSpace:'pre-wrap', fontSize:12, lineHeight:1.5, color:'#374151', fontFamily:'ui-monospace,Menlo,monospace' }}>{c.transcript}</pre>
        </details>
      )}

      {/* Notes log */}
      <div style={{ ...card, padding:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:.6, marginBottom:8 }}>Notes</div>
        {c.follow_up_notes && (
          <pre style={{ whiteSpace:'pre-wrap', fontSize:12, color:'#374151', margin:'0 0 10px', fontFamily:'inherit' }}>{c.follow_up_notes}</pre>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <input style={input} placeholder="Add a note…" value={noteInput} onChange={e=>setNoteInput(e.target.value)} />
          <button onClick={()=>{ if (!noteInput.trim()) return; mutate('add_call_note', { note: noteInput.trim() }); setNoteInput('') }} disabled={saving || !noteInput.trim()} style={btn()}>Add</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5 — ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════
function AnalyticsTab({ agent, agencyId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/inbound?action=get_analytics&agency_id=${agencyId}&agent_id=${agent.id}`)
        if (res.ok) setData(await res.json())
      } catch (e) { console.error(e) }
      setLoading(false)
    })()
  }, [agent.id, agencyId])

  if (loading) return <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} className="spin" color={R}/></div>
  if (!data) return <div style={{ ...card, textAlign:'center', padding:40 }}><BarChart2 size={32} color="#d1d5db"/><p style={{ color:'#6b7280' }}>No analytics data available</p></div>

  const stats = [
    { label:'Total Calls', value:data.total_calls||0, icon:<Phone size={18}/>, color:R },
    { label:'Avg Duration', value:data.avg_duration ? `${Math.floor(data.avg_duration/60)}:${String(Math.round(data.avg_duration%60)).padStart(2,'0')}` : '0:00', icon:<Clock size={18}/>, color:T },
    { label:'Appointments', value:data.appointments||0, icon:<Calendar size={18}/>, color:PURP },
    { label:'Emergencies', value:data.emergencies||0, icon:<AlertCircle size={18}/>, color:AMB },
    { label:'Missed Rate', value:data.missed_rate!=null ? `${Math.round(data.missed_rate*100)}%` : '0%', icon:<PhoneOff size={18}/>, color:'#6b7280' },
  ]

  const hourData = data.calls_by_hour || new Array(24).fill(0)
  const dayData = data.calls_by_day || new Array(7).fill(0)
  const maxHour = Math.max(...hourData, 1)
  const maxDay = Math.max(...dayData, 1)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...card, textAlign:'center' }}>
            <div style={{ color:s.color, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:24, fontWeight:700, fontFamily:FH, color:BLK }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Calls by Hour */}
      <div style={card}>
        <h3 style={{ margin:'0 0 14px', fontFamily:FH, fontSize:15 }}><BarChart2 size={16} style={{ marginRight:6 }}/>Calls by Hour</h3>
        <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:120 }}>
          {hourData.map((v,i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ width:'100%', height:Math.max(2, (v/maxHour)*100), background: v>0 ? R : '#e5e7eb', borderRadius:'3px 3px 0 0', transition:'height .3s' }}
                title={`${i}:00 — ${v} calls`} />
              {i%3===0 && <span style={{ fontSize:9, color:'#6b7280', marginTop:2 }}>{i}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Calls by Day */}
      <div style={card}>
        <h3 style={{ margin:'0 0 14px', fontFamily:FH, fontSize:15 }}><Calendar size={16} style={{ marginRight:6 }}/>Calls by Day</h3>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100 }}>
          {dayData.map((v,i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ width:'100%', height:Math.max(2, (v/maxDay)*80), background:T, borderRadius:'3px 3px 0 0', transition:'height .3s' }}
                title={`${DAYS[i]} — ${v} calls`} />
              <span style={{ fontSize:10, color:'#6b7280', marginTop:4 }}>{DAYS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      {data.ai_insights && (
        <div style={{ ...card, background:'linear-gradient(135deg,#faf5ff,#f0f9ff)', border:`1px solid ${PURP}30` }}>
          <h3 style={{ margin:'0 0 10px', fontFamily:FH, fontSize:15, display:'flex', alignItems:'center', gap:6 }}><Sparkles size={16} color={PURP}/> AI Insights</h3>
          <p style={{ margin:0, fontSize:13, lineHeight:1.6, color:'#374151' }}>{data.ai_insights}</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB — PROMPT EDITOR (sectioned agent prompt — each section editable + AI-customizable)
// ═══════════════════════════════════════════════════════════════════════════════
function PromptComplianceTab({ agent, setAgent }) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [customizing, setCustomizing] = useState(null)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/inbound?action=get_prompt_sections&agent_id=${agent.id}`)
        const d = await res.json().catch(()=>({}))
        if (Array.isArray(d.sections)) setSections(d.sections)
      } catch (e) { console.error(e) }
      setLoading(false)
    })()
  }, [agent.id])

  function updSection(id, text) { setSections(prev => prev.map(s => s.id===id ? { ...s, text } : s)) }
  function resetSection(id) {
    setSections(prev => prev.map(s => s.id===id ? { ...s, text: s.default_text } : s))
    toast.success('Section reset to default')
  }

  async function customizeSection(section) {
    setCustomizing(section.id)
    try {
      const business_context = {
        agent_name: agent.name || agent.business_name,
        company_name: agent.business_name || agent.name,
        department: agent.department,
        sic_code: agent.sic_code,
        industry: agent.industry,
        phone_number: agent.phone_number,
        timezone: agent.timezone,
        business_hours: agent.business_hours,
      }
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'customize_section', section_id: section.id, current_text: section.text, business_context })
      })
      const d = await res.json().catch(()=>({}))
      if (d.text) { updSection(section.id, d.text); toast.success(`"${section.label}" customized`) }
      else toast.error(d.error||'Customization failed')
    } catch { toast.error('Customization failed') }
    setCustomizing(null)
  }

  async function saveAll() {
    setSaving(true)
    try {
      const prompt_sections = Object.fromEntries(sections.map(s => [s.id, s.text]))
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'update_agent', agent_id:agent.id, prompt_sections })
      })
      const d = await res.json().catch(()=>({}))
      if (d.success) { setAgent({ ...agent, prompt_sections }); toast.success('Prompt saved') }
      else toast.error(d.error||'Save failed')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  async function syncToRetell() {
    setSyncing(true)
    try {
      // Save first, then push to Retell
      const prompt_sections = Object.fromEntries(sections.map(s => [s.id, s.text]))
      const saveRes = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'update_agent', agent_id:agent.id, prompt_sections })
      })
      const saveData = await saveRes.json().catch(()=>({}))
      if (!saveData.success) { toast.error(saveData.error||'Save failed'); setSyncing(false); return }
      const syncRes = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'sync_retell_prompt', agent_id:agent.id })
      })
      const syncData = await syncRes.json().catch(()=>({}))
      if (syncData.success) { setAgent({ ...agent, prompt_sections }); toast.success(`Pushed ${syncData.prompt_length} chars to Retell`) }
      else toast.error(syncData.error||'Retell sync failed')
    } catch { toast.error('Sync failed') }
    setSyncing(false)
  }

  const byCategory = sections.reduce((a, s) => { (a[s.category] = a[s.category] || []).push(s); return a }, {})
  const CATEGORY_ORDER = ['identity','business','rules','craft','extras']
  const CATEGORY_LABELS = {
    identity: { label:'Identity', desc:'Who the agent is. Customize heavily per business.' },
    business: { label:'Business Playbook', desc:'What callers will ask and what the agent should do. Customize per business.' },
    rules: { label:'Rules & Compliance', desc:'Industry-specific guardrails. Customize when compliance differs.' },
    craft: { label:'Conversation Craft', desc:'Cadence, empathy, listening — standards from 20 years of phone work. Don\'t break these.' },
    extras: { label:'Extras', desc:'Freeform additions from the business owner.' },
  }

  if (loading) return <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} className="spin" color={R}/></div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ ...card, background:'linear-gradient(135deg, rgba(234,39,41,.04), rgba(124,58,237,.04))', borderColor:'rgba(234,39,41,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div>
            <h3 style={{ margin:'0 0 4px', fontFamily:FH, fontSize:16 }}><Brain size={18} style={{ marginRight:6, verticalAlign:'-4px', color:R }}/>Prompt Editor</h3>
            <p style={{ margin:0, fontSize:12, color:'#6b7280' }}>Each section below is a piece of the full system prompt. Edit in place, or click "Customize with AI" to rewrite for this business.</p>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={saveAll} disabled={saving} style={btn('#374151')}>
              {saving ? <Loader2 size={14} className="spin"/> : <Check size={14}/>} Save Draft
            </button>
            <button onClick={syncToRetell} disabled={syncing} style={btn()}>
              {syncing ? <Loader2 size={14} className="spin"/> : <Zap size={14}/>} Sync to Retell
            </button>
          </div>
        </div>
      </div>

      {CATEGORY_ORDER.map(cat => {
        const items = byCategory[cat] || []
        if (items.length === 0) return null
        const meta = CATEGORY_LABELS[cat]
        return (
          <div key={cat} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ padding:'4px 2px' }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:R, letterSpacing:.6 }}>{meta.label}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>{meta.desc}</div>
            </div>
            {items.map(s => {
              const isExpanded = expanded[s.id] !== false
              const isDefault = s.text === s.default_text
              return (
                <div key={s.id} style={card}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom: isExpanded ? 10 : 0 }}>
                    <div style={{ flex:1, cursor:'pointer' }} onClick={()=>setExpanded(p=>({...p, [s.id]: !isExpanded}))}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <ChevronRight size={14} style={{ transform:`rotate(${isExpanded?90:0}deg)`, transition:'transform .15s', color:'#9ca3af' }}/>
                        <h3 style={{ margin:0, fontFamily:FH, fontSize:14 }}>{s.label}</h3>
                        {!isDefault && <span style={badge('rgba(234,39,41,.1)', R)}>Edited</span>}
                      </div>
                      <p style={{ margin:'4px 0 0 22px', fontSize:12, color:'#6b7280' }}>{s.description}</p>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      {s.ai_customizable && (
                        <button onClick={(e)=>{ e.stopPropagation(); customizeSection(s) }} disabled={customizing===s.id} style={btn(PURP)}>
                          {customizing===s.id ? <Loader2 size={14} className="spin"/> : <Sparkles size={14}/>} Customize with AI
                        </button>
                      )}
                      {!isDefault && (
                        <button onClick={(e)=>{ e.stopPropagation(); resetSection(s.id) }} title="Reset to default" style={{ ...btn('#f3f4f6','#374151'), padding:'8px 10px' }}>
                          <RefreshCw size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <textarea
                      style={{ ...input, minHeight:140, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12, lineHeight:1.5, resize:'vertical', background:'#fafafa' }}
                      value={s.text||''}
                      onChange={e=>updSection(s.id, e.target.value)}
                      placeholder={s.default_text}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB — ROUTING (transfer targets with intent + hours conditions)
// ═══════════════════════════════════════════════════════════════════════════════
function RoutingTab({ agent }) {
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newT, setNewT] = useState({ label: '', phone_number: '', priority: 10, intent: 'any', hours: '' })
  const [previewIntent, setPreviewIntent] = useState('sales')
  const [previewResult, setPreviewResult] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/answering/routing-targets?agent_id=${agent.id}`)
      const d = await res.json()
      setTargets(Array.isArray(d?.targets) ? d.targets : [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [agent.id])

  async function addTarget() {
    if (!newT.label.trim() || !newT.phone_number.trim()) { toast.error('Label and phone required'); return }
    setSaving(true)
    try {
      const conditions = { intent: newT.intent || 'any' }
      if (newT.hours) conditions.hours = newT.hours
      const res = await fetch('/api/answering/routing-targets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agent.id, label: newT.label, phone_number: newT.phone_number, priority: Number(newT.priority) || 10, conditions }),
      })
      const d = await res.json()
      if (d.target) {
        setTargets(prev => [...prev, d.target].sort((a, b) => (a.priority || 99) - (b.priority || 99)))
        setNewT({ label: '', phone_number: '', priority: 10, intent: 'any', hours: '' })
        toast.success('Target added')
      } else toast.error(d.error || 'Failed')
    } catch { toast.error('Failed') }
    setSaving(false)
  }

  async function updateTarget(id, patch) {
    const res = await fetch('/api/answering/routing-targets', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    const d = await res.json()
    if (d.target) setTargets(prev => prev.map(t => t.id === id ? d.target : t).sort((a, b) => (a.priority || 99) - (b.priority || 99)))
  }

  async function deleteTarget(id) {
    if (!confirm('Remove this routing target?')) return
    const res = await fetch(`/api/answering/routing-targets?id=${id}`, { method: 'DELETE' })
    if (res.ok) setTargets(prev => prev.filter(t => t.id !== id))
  }

  async function runPreviewResolve() {
    const res = await fetch('/api/answering/routing-targets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', agent_id: agent.id, intent: previewIntent }),
    })
    const d = await res.json()
    setPreviewResult(d.route)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <h3 style={{ margin: '0 0 14px', fontFamily: FH, fontSize: 15 }}><Target size={16} style={{ marginRight: 6 }} />Routing Targets</h3>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: -8, marginBottom: 14 }}>
          The agent will scan targets in priority order and transfer to the first one that matches detected intent + current hours.
        </p>

        {loading ? <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={20} className="spin" color={R} /></div>
        : targets.length === 0 ? <p style={{ color: '#6b7280', fontSize: 13 }}>No targets yet. Add one below.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1.5fr 1.3fr 1fr 1fr 40px', gap: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
              <span>Prio</span><span>Label</span><span>Phone</span><span>Intent</span><span>Hours</span><span></span>
            </div>
            {targets.map(t => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '60px 1.5fr 1.3fr 1fr 1fr 40px', gap: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 8, alignItems: 'center' }}>
                <input type="number" style={{ ...input, padding: '4px 6px' }} value={t.priority ?? 10}
                  onBlur={e => updateTarget(t.id, { priority: Number(e.target.value) || 10 })} defaultValue={t.priority ?? 10} />
                <input style={{ ...input, padding: '4px 8px' }} defaultValue={t.label}
                  onBlur={e => e.target.value !== t.label && updateTarget(t.id, { label: e.target.value })} />
                <input style={{ ...input, padding: '4px 8px' }} defaultValue={t.phone_number}
                  onBlur={e => e.target.value !== t.phone_number && updateTarget(t.id, { phone_number: e.target.value })} />
                <select style={{ ...input, padding: '4px 6px' }} value={(t.conditions?.intent) || 'any'}
                  onChange={e => updateTarget(t.id, { conditions: { ...(t.conditions || {}), intent: e.target.value } })}>
                  {['any', 'emergency', 'sales', 'support', 'scheduling', 'billing', 'existing_client', 'new_consultation', 'urgent', 'clinical', 'general'].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <select style={{ ...input, padding: '4px 6px' }} value={t.conditions?.hours || ''}
                  onChange={e => updateTarget(t.id, { conditions: { ...(t.conditions || {}), hours: e.target.value || undefined } })}>
                  <option value="">any time</option><option value="open">when open</option><option value="closed">when closed</option>
                </select>
                <Trash2 size={14} color="#9ca3af" style={{ cursor: 'pointer' }} onClick={() => deleteTarget(t.id)} />
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, padding: 12, border: '1px dashed #d1d5db', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>Add target</div>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1.5fr 1.3fr 1fr 1fr 80px', gap: 8 }}>
            <input type="number" style={input} placeholder="Prio" value={newT.priority} onChange={e => setNewT({ ...newT, priority: e.target.value })} />
            <input style={input} placeholder="Label (e.g. On-call dispatcher)" value={newT.label} onChange={e => setNewT({ ...newT, label: e.target.value })} />
            <input style={input} placeholder="+15551234567" value={newT.phone_number} onChange={e => setNewT({ ...newT, phone_number: e.target.value })} />
            <select style={input} value={newT.intent} onChange={e => setNewT({ ...newT, intent: e.target.value })}>
              {['any', 'emergency', 'sales', 'support', 'scheduling', 'billing', 'existing_client', 'new_consultation', 'urgent', 'clinical', 'general'].map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <select style={input} value={newT.hours} onChange={e => setNewT({ ...newT, hours: e.target.value })}>
              <option value="">any time</option><option value="open">when open</option><option value="closed">when closed</option>
            </select>
            <button onClick={addTarget} disabled={saving} style={{ ...btn(), justifyContent: 'center' }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Add
            </button>
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 10px', fontFamily: FH, fontSize: 15 }}>Preview: where would a call go right now?</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Simulated intent:</label>
          <select style={{ ...input, width: 180 }} value={previewIntent} onChange={e => { setPreviewIntent(e.target.value); setPreviewResult(null) }}>
            {['any', 'emergency', 'sales', 'support', 'scheduling', 'billing', 'existing_client', 'new_consultation', 'urgent', 'clinical', 'general'].map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <button onClick={runPreviewResolve} style={btn('#374151')}><Play size={14} /> Resolve</button>
        </div>
        {previewResult ? (
          <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', border: `1px solid ${GRN}40`, borderRadius: 8, fontSize: 13 }}>
            <strong>{previewResult.label}</strong> <span style={{ color: '#6b7280' }}>{'\u2192'}</span> <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{previewResult.phoneNumber}</span>
          </div>
        ) : previewResult === null ? null : (
          <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', border: `1px solid ${R}40`, borderRadius: 8, fontSize: 13 }}>
            No target matches. Agent will take a message instead of attempting transfer.
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW AGENT WIZARD (6-step modal)
// ═══════════════════════════════════════════════════════════════════════════════
function NewAgentWizard({ agencyId, onClose, onCreated }) {
  const [step, setStep] = useState(1)
  const [creating, setCreating] = useState(false)
  const [clients, setClients] = useState([])
  const [sicSearch, setSicSearch] = useState('')
  const [sicOpen, setSicOpen] = useState(false)

  const [form, setForm] = useState({
    client_id:'', business_name:'', department:'', sic_code:'',
    phone_number:'', forward_number:'', _area_code:'212', _phone_mode:'koto',
    voice_id:'',
  })

  const upd = (k,v) => setForm(p=>({...p,[k]:v}))

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('clients').select('id,name').eq('agency_id',agencyId).order('name')
        setClients(data||[])
      } catch {}
    })()
  }, [agencyId])

  async function provisionNumber() {
    toast.loading('Provisioning...',{id:'wprov'})
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'provision_number', area_code:form._area_code, agency_id:agencyId })
      })
      const d = await res.json()
      if (d.phone_number) { upd('phone_number',d.phone_number); toast.success(`Got ${d.phone_number}`,{id:'wprov'}) }
      else toast.error(d.error||'Failed',{id:'wprov'})
    } catch { toast.error('Provision failed',{id:'wprov'}) }
  }

  async function activate() {
    if (!form.business_name.trim()) { toast.error('Business name required'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/inbound', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'create_agent', agency_id:agencyId, agent_name:form.business_name.trim(), ...form })
      })
      const d = await res.json()
      if (d.agent) { toast.success('Agent activated!'); onCreated(d.agent) }
      else toast.error(d.error||'Creation failed')
    } catch { toast.error('Creation failed') }
    setCreating(false)
  }

  const filteredSic = SIC_CODES.filter(s => {
    if (!sicSearch) return true
    const q = sicSearch.toLowerCase()
    return s.label.toLowerCase().includes(q) || s.code.includes(q) || (s.division||'').toLowerCase().includes(q)
  }).slice(0,60)

  const stepDot = (n) => ({ width:28, height:28, borderRadius:99, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, fontFamily:FH, background:step===n?R:step>n?GRN:'#e5e7eb', color:step>=n?'#fff':'#6b7280' })

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', background:'#fff' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h2 style={{ margin:0, fontFamily:FH, fontSize:20 }}>New Answering Agent</h2>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'#6b7280' }}>Provision a Retell AI agent for a client in four steps.</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#6b7280' }}>
            <X size={14}/> Cancel
          </button>
        </div>

        {/* Step indicators */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:24 }}>
          {[1,2,3,4].map(n => (
            <div key={n} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={stepDot(n)}>{step>n?<Check size={14}/>:n}</div>
              {n<4 && <div style={{ width:24, height:2, background:step>n?GRN:'#e5e7eb' }}/>}
            </div>
          ))}
          <span style={{ marginLeft:8, fontSize:12, color:'#6b7280' }}>
            {['','Business Info','Phone','Voice','Review'][step]}
          </span>
        </div>

        {/* STEP 1 — Business Info */}
        {step===1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Client (optional)</label>
              <select style={input} value={form.client_id} onChange={e=>{ upd('client_id',e.target.value); const cl=clients.find(c=>c.id===e.target.value); if(cl) upd('business_name',cl.name) }}>
                <option value="">Select client...</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Business Name *</label>
              <input style={input} value={form.business_name} onChange={e=>upd('business_name',e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Department</label>
              <select style={input} value={form.department} onChange={e=>upd('department',e.target.value)}>
                <option value="">Select...</option>
                {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ position:'relative' }}>
              <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>SIC Code</label>
              <input style={input} placeholder="Search SIC codes..." value={sicOpen?sicSearch:(form.sic_code?`${form.sic_code} — ${SIC_CODES.find(s=>s.code===form.sic_code)?.label||''}`:'')}
                onFocus={()=>{setSicOpen(true);setSicSearch('')}} onChange={e=>{setSicSearch(e.target.value);setSicOpen(true)}} />
              {sicOpen && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, maxHeight:180, overflowY:'auto', background:'#fff', border:'1px solid #d1d5db', borderRadius:8, zIndex:10, boxShadow:'0 4px 12px rgba(0,0,0,.1)' }}>
                  {filteredSic.map(s=>(
                    <div key={s.code} onClick={()=>{upd('sic_code',s.code);setSicOpen(false)}} style={{ padding:'6px 12px', cursor:'pointer', fontSize:12 }}
                      onMouseEnter={e=>e.currentTarget.style.background='#f3f4f6'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <strong>{s.code}</strong> — {s.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 — Phone */}
        {step===2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>upd('_phone_mode','koto')} style={{ ...btn(form._phone_mode==='koto'?R:'#e5e7eb', form._phone_mode==='koto'?'#fff':BLK), flex:1, justifyContent:'center' }}>
                <Zap size={14}/> Get Koto Number
              </button>
              <button onClick={()=>upd('_phone_mode','forward')} style={{ ...btn(form._phone_mode==='forward'?R:'#e5e7eb', form._phone_mode==='forward'?'#fff':BLK), flex:1, justifyContent:'center' }}>
                <Phone size={14}/> Forward Existing
              </button>
            </div>
            {form._phone_mode==='koto' ? (
              <div>
                <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Area Code</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input style={{ ...input, width:120 }} value={form._area_code} onChange={e=>upd('_area_code',e.target.value)} placeholder="212" />
                  <button onClick={provisionNumber} style={btn()}>Provision Number</button>
                </div>
                {form.phone_number && <div style={{ marginTop:12, fontSize:18, fontWeight:700, color:GRN }}>{form.phone_number} <Check size={18} color={GRN}/></div>}
              </div>
            ) : (
              <div>
                <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Forward Number</label>
                <input style={input} value={form.forward_number} onChange={e=>upd('forward_number',e.target.value)} placeholder="+1 (555) 123-4567" />
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Voice */}
        {step===3 && (
          <div>
            <p style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>Choose the voice your AI agent will use on calls.</p>
            <VoiceSelector selectedVoiceId={form.voice_id} onSelect={v=>upd('voice_id',v)} maxHeight="350px" />
          </div>
        )}

        {/* STEP 4 — Review & Activate */}
        {step===4 && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ ...card, background:'#fafafa' }}>
              <h4 style={{ margin:'0 0 10px', fontFamily:FH }}>Review Your Agent</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:13 }}>
                <div><span style={{ color:'#6b7280' }}>Business:</span> <strong>{form.business_name||'—'}</strong></div>
                <div><span style={{ color:'#6b7280' }}>Department:</span> <strong>{form.department||'—'}</strong></div>
                <div><span style={{ color:'#6b7280' }}>SIC Code:</span> <strong>{form.sic_code||'—'}</strong></div>
                <div><span style={{ color:'#6b7280' }}>Phone:</span> <strong>{form.phone_number||form.forward_number||'—'}</strong></div>
                <div><span style={{ color:'#6b7280' }}>Voice:</span> <strong>{form.voice_id||'Default'}</strong></div>
              </div>
              <p style={{ margin:'12px 0 0', fontSize:12, color:'#6b7280' }}>Notifications and intake questions can be configured on the agent detail page after activation.</p>
            </div>
            <button onClick={activate} disabled={creating||!form.business_name} style={{ ...btn(GRN), width:'100%', justifyContent:'center', padding:'14px 0', fontSize:16 }}>
              {creating ? <Loader2 size={18} className="spin"/> : <Zap size={18}/>} {creating ? 'Activating...' : 'Activate Agent'}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:16, borderTop:'1px solid #e5e7eb' }}>
          <button onClick={()=>step>1?setStep(step-1):onClose()} style={btn('#e5e7eb',BLK)}>
            {step===1?'Cancel':'Back'}
          </button>
          {step<4 && (
            <button onClick={()=>setStep(step+1)} disabled={step===1&&!form.business_name} style={{ ...btn(), opacity:(step===1&&!form.business_name)?.5:1 }}>
              Next <ChevronRight size={14}/>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
