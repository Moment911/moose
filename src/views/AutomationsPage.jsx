"use client"
import { useState, useEffect } from 'react'
import {
  Zap, Plus, Play, Pause, Trash2, Mail, Clock, Users,
  Star, MessageSquare, ArrowRight, X, CheckCircle,
  Loader2, RefreshCw, ChevronDown, ChevronRight,
  Bell, FileText, Brain, Target
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, W, GRN, AMB, FH, FB } from '../lib/theme'
const RED = R, TEAL = T, GREEN = GRN, AMBER = AMB

const TRIGGERS = [
  { key:'review_new',       label:'New Review Received',     icon:Star,          color:AMBER, desc:'Fires when a new Google review comes in' },
  { key:'review_negative',  label:'Negative Review (<3 ★)',  icon:Star,          color:RED,   desc:'Fires when a review is 1 or 2 stars' },
  { key:'ticket_new',       label:'New Support Ticket',      icon:MessageSquare, color:TEAL,  desc:'Fires when a client submits a new ticket' },
  { key:'sla_breach',       label:'SLA Breached',            icon:Bell,          color:RED,   desc:'Fires when a ticket exceeds SLA time' },
  { key:'client_added',     label:'New Client Added',        icon:Users,         color:GREEN, desc:'Fires when a new client is created' },
  { key:'onboarding_done',  label:'Client Onboarding Done',  icon:CheckCircle,   color:GREEN, desc:'Fires when a client completes onboarding' },
  { key:'project_created',  label:'Project Created',         icon:FileText,      color:TEAL,  desc:'Fires when a new project is started' },
  { key:'agent_alert',      label:'CMO Agent Alert',         icon:Brain,         color:RED,   desc:'Fires when the agent raises a critical alert' },
  { key:'schedule',         label:'Scheduled (Recurring)',   icon:Clock,         color:'#7c3aed', desc:'Run at a specific time and frequency' },
]

const ACTIONS = [
  { key:'send_email',       label:'Send Email',              icon:Mail,          desc:'Send an email to the client or team' },
  { key:'send_digest',      label:'Send Weekly Digest',      icon:Brain,         desc:'Trigger the CMO digest email now' },
  { key:'run_agent',        label:'Run CMO Analysis',        icon:Brain,         desc:'Trigger a CMO agent analysis for the client' },
  { key:'create_task',      label:'Create Task',             icon:CheckCircle,   desc:'Auto-create a task in the task board' },
  { key:'notify_team',      label:'Notify Team',             icon:Bell,          desc:'Send a Slack or internal notification' },
  { key:'wait',             label:'Wait / Delay',            icon:Clock,         desc:'Wait before running the next action' },
  { key:'send_review_request', label:'Send Review Request', icon:Star,          desc:'Send review request to the client contact' },
]

function TriggerIcon({ triggerKey }) {
  const t = TRIGGERS.find(x => x.key === triggerKey) || TRIGGERS[0]
  const Icon = t.icon
  return <div style={{ width:36,height:36,borderRadius:10,background:t.color+'20',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><Icon size={17} color={t.color}/></div>
}

export default function AutomationsPage() {
  const { agencyId } = useAuth()
  const [automations, setAutomations] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showCreate,  setShowCreate]  = useState(false)
  const [toggling,    setToggling]    = useState(null)
  const [expanded,    setExpanded]    = useState(null)

  const [form, setForm] = useState({
    name: '', trigger: '', description: '',
    trigger_config: { schedule: 'daily', time: '09:00', days: ['Monday'] },
    actions: [],
  })

  useEffect(() => { if (agencyId) load() }, [agencyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('automations').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false })
    setAutomations(data || [])
    setLoading(false)
  }

  async function create() {
    if (!form.name.trim() || !form.trigger) { toast.error('Name and trigger required'); return }
    if (form.actions.length === 0) { toast.error('Add at least one action'); return }
    const { error } = await supabase.from('automations').insert({
      agency_id: agencyId,
      name: form.name.trim(),
      description: form.description,
      trigger_type: form.trigger,
      trigger_config: form.trigger_config,
      actions: form.actions,
      status: 'paused',
    })
    if (error) { toast.error(error.message); return }
    toast.success('Automation created ✓')
    setShowCreate(false)
    setForm({ name:'', trigger:'', description:'', trigger_config:{schedule:'daily',time:'09:00',days:['Monday']}, actions:[] })
    load()
  }

  async function toggle(auto) {
    const next = auto.status === 'active' ? 'paused' : 'active'
    setToggling(auto.id)
    await supabase.from('automations').update({ status: next }).eq('id', auto.id)
    setAutomations(prev => prev.map(a => a.id === auto.id ? { ...a, status: next } : a))
    toast.success(next === 'active' ? '▶ Automation activated' : '⏸ Automation paused')
    setToggling(null)
  }

  async function remove(id) {
    if (!confirm('Delete this automation?')) return
    await supabase.from('automations').delete().eq('id', id)
    setAutomations(prev => prev.filter(a => a.id !== id))
    toast.success('Deleted')
  }

  function addAction(key) {
    setForm(f => ({ ...f, actions: [...f.actions, { type: key, config: {} }] }))
  }

  function removeAction(i) {
    setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }))
  }

  const activeCount  = automations.filter(a => a.status === 'active').length
  const totalRuns    = automations.reduce((s, a) => s + (a.run_count || 0), 0)

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#F9F9F9' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding:'20px 28px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:FH, fontSize:20, fontWeight:800, color:BLK, letterSpacing:'-.03em', display:'flex', alignItems:'center', gap:9 }}>
              <Zap size={18} color={AMBER}/> Automations
            </div>
            <div style={{ fontSize:12, color:'#999999', margin:'3px 0 0', fontFamily:FB }}>
              {activeCount} active · {totalRuns} total runs
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:FH, boxShadow:`0 2px 12px ${RED}40` }}>
            <Plus size={14}/> New Automation
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>

          {loading && (
            <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
              <Loader2 size={24} color={TEAL} style={{ animation:'spin 1s linear infinite' }}/>
            </div>
          )}

          {!loading && automations.length === 0 && !showCreate && (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'60px 24px', textAlign:'center' }}>
              <Zap size={40} color="#e5e7eb" style={{ margin:'0 auto 14px', display:'block' }}/>
              <div style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, marginBottom:8 }}>No automations yet</div>
              <div style={{ fontSize:14, color:'#6b7280', fontFamily:FB, maxWidth:440, margin:'0 auto 24px', lineHeight:1.7 }}>
                Automate repetitive tasks — send review requests when jobs complete, alert the team on negative reviews, run the CMO agent on a schedule.
              </div>
              <button onClick={() => setShowCreate(true)}
                style={{ padding:'11px 28px', borderRadius:11, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                Create Your First Automation →
              </button>
            </div>
          )}

          {/* Automation list */}
          {automations.map(auto => {
            const trigger = TRIGGERS.find(t => t.key === auto.trigger_type) || TRIGGERS[0]
            const actions = Array.isArray(auto.actions) ? auto.actions : []
            const isExpanded = expanded === auto.id
            return (
              <div key={auto.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', marginBottom:10, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
                  <TriggerIcon triggerKey={auto.trigger_type}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>{auto.name}</div>
                    <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ color:trigger.color, fontWeight:600 }}>{trigger.label}</span>
                      <ArrowRight size={10} color="#d1d5db"/>
                      <span>{actions.length} action{actions.length !== 1 ? 's' : ''}</span>
                      {auto.run_count > 0 && <span>· ran {auto.run_count}×</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:auto.status==='active'?GREEN+'15':'#f3f4f6', color:auto.status==='active'?GREEN:'#6b7280', fontFamily:FH }}>
                      {auto.status}
                    </span>
                    <button onClick={() => toggle(auto)} disabled={toggling === auto.id}
                      style={{ padding:'6px 12px', borderRadius:8, border:'none', background:auto.status==='active'?'#fef2f2':'#f0fdf4', color:auto.status==='active'?RED:GREEN, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                      {toggling===auto.id?<Loader2 size={10} style={{animation:'spin 1s linear infinite'}}/>:auto.status==='active'?<Pause size={10}/>:<Play size={10}/>}
                      {auto.status==='active'?'Pause':'Activate'}
                    </button>
                    <button onClick={() => setExpanded(isExpanded ? null : auto.id)}
                      style={{ padding:'6px 8px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#9ca3af', cursor:'pointer' }}>
                      {isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    </button>
                    <button onClick={() => remove(auto.id)}
                      style={{ padding:'6px 8px', borderRadius:8, border:'1px solid #fecaca', background:'#fef2f2', color:RED, cursor:'pointer' }}>
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding:'0 18px 14px', borderTop:'1px solid #f9fafb' }}>
                    {auto.description && <div style={{ fontSize:13, color:'#6b7280', fontFamily:FB, marginBottom:10, marginTop:10 }}>{auto.description}</div>}
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <div style={{ padding:'6px 12px', borderRadius:9, background:trigger.color+'15', color:trigger.color, fontSize:12, fontWeight:700, fontFamily:FH }}>
                        ⚡ {trigger.label}
                      </div>
                      <ArrowRight size={14} color="#d1d5db"/>
                      {actions.map((act, i) => {
                        const actionDef = ACTIONS.find(a => a.key === act.type)
                        return (
                          <div key={i} style={{ padding:'6px 12px', borderRadius:9, background:'#f3f4f6', color:'#374151', fontSize:12, fontWeight:600, fontFamily:FH, display:'flex', alignItems:'center', gap:5 }}>
                            {i > 0 && <ArrowRight size={10} color="#9ca3af"/>}
                            {actionDef?.label || act.type}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Create form */}
          {showCreate && (
            <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${RED}30`, padding:'22px 24px', marginTop: automations.length > 0 ? 16 : 0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                <div style={{ fontFamily:FH, fontSize:16, fontWeight:800, color:BLK }}>New Automation</div>
                <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={16}/></button>
              </div>

              {/* Name */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:5 }}>Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))}
                  placeholder="e.g. Review Request After Job"
                  style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
              </div>

              {/* Description */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:5 }}>Description (optional)</label>
                <input value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))}
                  placeholder="What does this automation do?"
                  style={{ width:'100%', padding:'9px 13px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', boxSizing:'border-box' }}/>
              </div>

              {/* Trigger selector */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:8 }}>Trigger *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {TRIGGERS.map(t => {
                    const Icon = t.icon
                    const sel  = form.trigger === t.key
                    return (
                      <button key={t.key} onClick={() => setForm(f => ({...f, trigger:t.key}))}
                        style={{ padding:'10px 12px', borderRadius:10, border:`2px solid ${sel?t.color:'#e5e7eb'}`, background:sel?t.color+'12':'#fff', cursor:'pointer', textAlign:'left' }}>
                        <Icon size={14} color={t.color} style={{ marginBottom:4 }}/>
                        <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:sel?t.color:BLK, marginBottom:2 }}>{t.label}</div>
                        <div style={{ fontSize:12, color:'#9ca3af', fontFamily:FB }}>{t.desc}</div>
                      </button>
                    )
                  })}
                </div>

                {/* Schedule config */}
                {form.trigger === 'schedule' && (
                  <div style={{ display:'flex', gap:10, marginTop:10 }}>
                    <select value={form.trigger_config.schedule} onChange={e => setForm(f => ({...f, trigger_config:{...f.trigger_config, schedule:e.target.value}}))}
                      style={{ flex:1, padding:'8px 11px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none', background:'#fff' }}>
                      {['daily','weekly','monthly'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                    </select>
                    <input type="time" value={form.trigger_config.time} onChange={e => setForm(f => ({...f, trigger_config:{...f.trigger_config, time:e.target.value}}))}
                      style={{ flex:1, padding:'8px 11px', borderRadius:9, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, outline:'none' }}/>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontFamily:FH, fontSize:12, fontWeight:700, color:BLK, display:'block', marginBottom:8 }}>Actions *</label>
                {form.actions.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
                    {form.actions.map((act, i) => {
                      const def = ACTIONS.find(a => a.key === act.type)
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'#f9fafb', borderRadius:9, border:'1px solid #e5e7eb' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:TEAL+'15', color:TEAL, fontFamily:FH }}>Step {i+1}</span>
                          <span style={{ fontFamily:FH, fontSize:12, fontWeight:600, color:BLK, flex:1 }}>{def?.label || act.type}</span>
                          <button onClick={() => removeAction(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#d1d5db' }}><X size={12}/></button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>
                  {ACTIONS.map(a => {
                    const Icon = a.icon
                    const alreadyAdded = form.actions.some(x => x.type === a.key)
                    return (
                      <button key={a.key} onClick={() => addAction(a.key)} disabled={alreadyAdded}
                        style={{ padding:'8px 10px', borderRadius:9, border:'1px solid #e5e7eb', background: alreadyAdded ? '#f9fafb' : '#fff', cursor:alreadyAdded?'default':'pointer', textAlign:'left', opacity:alreadyAdded?.5:1 }}>
                        <Icon size={12} color={TEAL} style={{ marginBottom:3 }}/>
                        <div style={{ fontFamily:FH, fontSize:11, fontWeight:700, color:BLK }}>{a.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={create}
                style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:RED, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:FH }}>
                Create Automation →
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
