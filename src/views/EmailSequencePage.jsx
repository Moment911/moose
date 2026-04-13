"use client"
import { useState, useEffect } from 'react'
import {
  Mail, Phone, MessageSquare, Plus, Check, X, ChevronRight, ChevronDown,
  Loader2, Zap, RefreshCw, Play, Pause, Copy, Trash2, Edit2, Clock,
  Sparkles, Send, Inbox, Target, BarChart2, ArrowRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

import { R, T, BLK, GRY, GRN, AMB, W, FH, FB } from '../lib/theme'

const API = '/api/sequences'
async function apiGet(action, params={}) {
  const url = new URL(API, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k,v] of Object.entries(params)) if (v) url.searchParams.set(k, String(v))
  return (await fetch(url)).json()
}
async function apiPost(body) {
  return (await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })).json()
}

const CHANNEL_ICONS = { email: Mail, sms: MessageSquare, call: Phone }
const CHANNEL_COLORS = { email: T, sms: GRN, call: AMB }

export default function EmailSequencePage() {
  const { agencyId } = useAuth()
  const [sequences, setSequences] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [editingSeq, setEditingSeq] = useState(null) // sequence being edited
  const [editSteps, setEditSteps] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [newSeq, setNewSeq] = useState({ sequence_name:'', sequence_type:'outbound', trigger_type:'manual' })
  const [generating, setGenerating] = useState(false)
  const [aiConfig, setAiConfig] = useState({ industry:'', pain_point:'', tone:'professional', num_steps:5, closer_name:'', agency_name:'Momenta Marketing' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [seqRes, statRes] = await Promise.all([
      apiGet('list_sequences', { agency_id: agencyId }),
      apiGet('get_stats', { agency_id: agencyId }),
    ])
    setSequences(seqRes.data || [])
    setStats(statRes)
    setLoading(false)
  }

  async function createSequence() {
    if (!newSeq.sequence_name) { toast.error('Name required'); return }
    const res = await apiPost({ action:'create_sequence', agency_id:agencyId, ...newSeq })
    if (res.success) { toast.success('Sequence created'); setShowCreate(false); loadAll(); openEditor(res.sequence) }
    else toast.error(res.error || 'Failed')
  }

  async function openEditor(seq) {
    const res = await apiGet('get_sequence', { id: seq.id })
    setEditingSeq(res.sequence)
    setEditSteps(res.steps || [])
  }

  async function addStep() {
    if (!editingSeq) return
    const stepNum = editSteps.length + 1
    const res = await apiPost({ action:'add_step', sequence_id:editingSeq.id, agency_id:agencyId, step_number:stepNum, channel:'email', delay_days:stepNum===1?0:2, send_hour:9, subject_line:'', body_template:'', sms_template:'' })
    if (res.success) { setEditSteps([...editSteps, res.step]); toast.success('Step added') }
  }

  async function updateStep(stepId, updates) {
    await apiPost({ action:'update_step', id:stepId, ...updates })
    setEditSteps(editSteps.map(s => s.id === stepId ? { ...s, ...updates } : s))
  }

  async function deleteStep(stepId) {
    await apiPost({ action:'delete_step', step_id:stepId })
    setEditSteps(editSteps.filter(s => s.id !== stepId))
    toast.success('Step removed')
  }

  async function generateWithAI() {
    setGenerating(true)
    const res = await apiPost({ action:'generate_with_ai', ...aiConfig, sequence_type:newSeq.sequence_type || 'outbound' })
    if (res.steps?.length && editingSeq) {
      for (const step of res.steps) {
        await apiPost({ action:'add_step', sequence_id:editingSeq.id, agency_id:agencyId, ...step })
      }
      const refreshed = await apiGet('get_sequence', { id: editingSeq.id })
      setEditSteps(refreshed.steps || [])
      toast.success(`Generated ${res.steps.length} steps`)
    } else toast.error('AI generation returned no steps')
    setGenerating(false)
  }

  async function cloneSequence(id) {
    const res = await apiPost({ action:'clone_sequence', sequence_id:id, agency_id:agencyId })
    if (res.success) { toast.success('Sequence cloned'); loadAll() }
  }

  async function toggleActive(seq) {
    await apiPost({ action:'update_sequence', id:seq.id, is_active:!seq.is_active })
    loadAll()
  }

  async function processQueue() {
    toast.success('Processing queue...')
    const res = await apiPost({ action:'process_queue' })
    toast.success(`Processed: ${res.sent} sent, ${res.skipped} skipped`)
  }

  // ── List View ──
  if (!editingSeq) return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, overflow:'auto' }}>
        <div style={{ background: W, padding: '24px 32px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background: R, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Mail size={20} color={W} />
              </div>
              <div>
                <h1 style={{ fontFamily:FH, fontSize:20, fontWeight: 700, color: BLK, margin:0 }}>Multi-Channel Sequences</h1>
                <p style={{ fontFamily:FB, fontSize:13, color: '#6b7280', margin:0 }}>Call, voicemail, SMS, email. Response rates from 8% to 25%+</p>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={processQueue} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border: '1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, fontFamily:FB, cursor:'pointer' }}>
                <RefreshCw size={14} /> Process Queue
              </button>
              <button onClick={() => setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
                <Plus size={14} /> Create Sequence
              </button>
            </div>
          </div>
          <div style={{ display:'flex', gap:14, marginTop:16 }}>
            {[
              { label:'Active', value:stats.active_sequences||0, accent:T },
              { label:'Enrolled', value:stats.total_enrolled||0, accent:AMB },
              { label:'Replied', value:stats.total_replied||0, accent:GRN },
            ].map(s => (
              <div key={s.label} style={{ padding:'8px 16px', background: '#f9fafb', borderRadius:8, borderLeft:`3px solid ${s.accent}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#6b7280', fontFamily:FB, textTransform:'uppercase' }}>{s.label}</div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:FH, color:BLK }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:'24px 32px' }}>
          {loading && <div style={{ textAlign:'center', padding:40 }}><Loader2 size={24} color={R} style={{ animation:'spin 1s linear infinite' }} /></div>}

          {!loading && sequences.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 20px' }}>
              <Mail size={48} color="#d1d5db" style={{ marginBottom:16 }} />
              <h3 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 8px' }}>No Sequences Yet</h3>
              <p style={{ fontSize:13, color:'#6b7280', fontFamily:FB, marginBottom:16 }}>Create your first multi-channel sequence to start automated outreach.</p>
              <button onClick={() => setShowCreate(true)} style={{ padding:'10px 24px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
                <Plus size={14} style={{ verticalAlign:'middle', marginRight:6 }} /> Create Sequence
              </button>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {sequences.map(seq => (
              <div key={seq.id} style={{ padding:'18px 22px', borderRadius:12, background:W, border:'1px solid #e5e7eb', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, fontFamily:FH, color:BLK }}>{seq.sequence_name}</div>
                    <div style={{ display:'flex', gap:8, marginTop:4 }}>
                      <span style={{ padding:'2px 8px', borderRadius:99, fontSize:12, fontWeight:700, fontFamily:FB, background:`${T}15`, color:T, textTransform:'capitalize' }}>{seq.sequence_type}</span>
                      {seq.trigger_type && <span style={{ padding:'2px 8px', borderRadius:99, fontSize:12, fontWeight:600, fontFamily:FB, background:'#f3f4f6', color:'#6b7280' }}>{seq.trigger_type}</span>}
                      {seq.use_ghl && <span style={{ padding:'2px 8px', borderRadius:99, fontSize:12, fontWeight:700, fontFamily:FB, background:'#ff6a0020', color:'#ff6a00' }}>GHL</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={() => toggleActive(seq)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:seq.is_active?GRN+'15':W, fontSize:12, fontWeight:700, fontFamily:FB, cursor:'pointer', color:seq.is_active?GRN:'#6b7280' }}>
                      {seq.is_active ? 'Active' : 'Paused'}
                    </button>
                  </div>
                </div>

                <div style={{ display:'flex', gap:16, fontSize:11, color:'#6b7280', fontFamily:FB, marginBottom:10 }}>
                  <span>Enrolled: {seq.total_enrolled||0}</span>
                  <span>Replied: {seq.total_replied||0}</span>
                  <span>Appointments: {seq.total_appointments||0}</span>
                  {seq.reply_rate > 0 && <span style={{ color:GRN, fontWeight:700 }}>{Number(seq.reply_rate).toFixed(1)}% reply rate</span>}
                </div>

                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => openEditor(seq)} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:`${T}15`, color:T, fontSize:11, fontWeight:700, fontFamily:FB, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                    <Edit2 size={12} /> Edit Steps
                  </button>
                  <button onClick={() => cloneSequence(seq.id)} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #e5e7eb', background:W, color:'#6b7280', fontSize:11, fontWeight:600, fontFamily:FB, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                    <Copy size={12} /> Clone
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:W, borderRadius:16, padding:28, width:480, maxWidth:'95vw' }}>
              <h3 style={{ fontFamily:FH, fontSize:18, fontWeight:800, color:BLK, margin:'0 0 16px' }}>Create Sequence</h3>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#6b7280', fontFamily:FB, textTransform:'uppercase', marginBottom:4 }}>Sequence Name</label>
                <input value={newSeq.sequence_name} onChange={e => setNewSeq(s => ({...s, sequence_name:e.target.value}))} placeholder="e.g. After No Answer - 5 Touch" style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#6b7280', fontFamily:FB, textTransform:'uppercase', marginBottom:4 }}>Type</label>
                  <select value={newSeq.sequence_type} onChange={e => setNewSeq(s => ({...s, sequence_type:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, cursor:'pointer', boxSizing:'border-box' }}>
                    <option value="outbound">Outbound</option>
                    <option value="nurture">Nurture</option>
                    <option value="reactivation">Reactivation</option>
                    <option value="appointment_followup">Appointment Follow-up</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#6b7280', fontFamily:FB, textTransform:'uppercase', marginBottom:4 }}>Trigger</label>
                  <select value={newSeq.trigger_type} onChange={e => setNewSeq(s => ({...s, trigger_type:e.target.value}))} style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, cursor:'pointer', boxSizing:'border-box' }}>
                    <option value="manual">Manual enrollment</option>
                    <option value="call_outcome">After call outcome</option>
                    <option value="lead_imported">When lead imported</option>
                    <option value="website_visitor">Website visitor identified</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{ padding:'10px 20px', borderRadius:8, border:'1px solid #e5e7eb', background:W, fontSize:13, fontWeight:600, fontFamily:FB, cursor:'pointer', color:'#6b7280' }}>Cancel</button>
                <button onClick={createSequence} style={{ padding:'10px 20px', borderRadius:8, border:'none', background:R, color:W, fontSize:13, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>Create</button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  // ── Step Editor View ──
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:GRY }}>
      <Sidebar />
      <div style={{ flex:1, overflow:'auto' }}>
        <div style={{ background:W, padding:'16px 32px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => { setEditingSeq(null); loadAll() }} style={{ background:'none', border:'none', color:'#374151', cursor:'pointer', fontSize:14, fontFamily:FH }}>
              <ArrowRight size={16} style={{ transform:'rotate(180deg)', verticalAlign:'middle', marginRight:6 }} /> Back
            </button>
            <h2 style={{ fontFamily:FH, fontSize:18, fontWeight: 700, color: BLK, margin:0 }}>{editingSeq.sequence_name}</h2>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={generateWithAI} disabled={generating} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border: '1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, fontFamily:FB, cursor:'pointer' }}>
              {generating ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              Generate Steps with AI
            </button>
            <button onClick={addStep} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:R, color:W, fontSize:12, fontWeight:700, fontFamily:FB, cursor:'pointer' }}>
              <Plus size={14} /> Add Step
            </button>
          </div>
        </div>

        <div style={{ padding:'24px 32px' }}>
          {/* AI Config (inline) */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:20, padding:'14px 18px', background:W, borderRadius:10, border:'1px solid #e5e7eb' }}>
            <input value={aiConfig.industry} onChange={e => setAiConfig(c => ({...c, industry:e.target.value}))} placeholder="Industry (e.g. Plumbing)" style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB }} />
            <input value={aiConfig.pain_point} onChange={e => setAiConfig(c => ({...c, pain_point:e.target.value}))} placeholder="Main pain point" style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB }} />
            <input value={aiConfig.closer_name} onChange={e => setAiConfig(c => ({...c, closer_name:e.target.value}))} placeholder="Closer name" style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB }} />
            <select value={aiConfig.tone} onChange={e => setAiConfig(c => ({...c, tone:e.target.value}))} style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB, cursor:'pointer' }}>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="urgent">Urgent</option>
              <option value="empathetic">Empathetic</option>
            </select>
          </div>

          {/* Steps Timeline */}
          {editSteps.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', background:W, borderRadius:12, border:'1px solid #e5e7eb' }}>
              <p style={{ fontSize:13, color:'#6b7280', fontFamily:FB }}>No steps yet. Click "Add Step" or "Generate Steps with AI" to begin.</p>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {editSteps.map((step, i) => {
              const Icon = CHANNEL_ICONS[step.channel] || Mail
              const color = CHANNEL_COLORS[step.channel] || T
              return (
                <div key={step.id}>
                  {/* Timeline connector */}
                  {i > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0 8px 18px' }}>
                      <div style={{ width:2, height:20, background:'#e5e7eb' }} />
                      <span style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>
                        {step.delay_days > 0 ? `${step.delay_days} day${step.delay_days>1?'s':''} later` : 'Same day'} at {step.send_hour || 9}:00
                      </span>
                    </div>
                  )}

                  <div style={{ padding:'16px 20px', borderRadius:12, background:W, border:`1px solid ${color}30`, borderLeft:`4px solid ${color}`, marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:8, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <Icon size={14} color={color} />
                        </div>
                        <span style={{ fontSize:14, fontWeight:700, fontFamily:FH, color:BLK }}>Step {step.step_number}</span>
                        <select value={step.channel} onChange={e => updateStep(step.id, { channel: e.target.value })} style={{ padding:'3px 8px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:11, fontFamily:FB, cursor:'pointer' }}>
                          <option value="email">Email</option>
                          <option value="sms">SMS</option>
                          <option value="call">Call</option>
                        </select>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>Day</span>
                          <input type="number" min={0} value={step.delay_days||0} onChange={e => updateStep(step.id, { delay_days: parseInt(e.target.value)||0 })} style={{ width:40, padding:'3px 6px', borderRadius:4, border:'1px solid #e5e7eb', fontSize:11, fontFamily:FB, textAlign:'center' }} />
                          <span style={{ fontSize:12, color:'#6b7280', fontFamily:FB }}>at</span>
                          <input type="number" min={0} max={23} value={step.send_hour||9} onChange={e => updateStep(step.id, { send_hour: parseInt(e.target.value)||9 })} style={{ width:40, padding:'3px 6px', borderRadius:4, border:'1px solid #e5e7eb', fontSize:11, fontFamily:FB, textAlign:'center' }} />
                        </div>
                        <button onClick={() => deleteStep(step.id)} style={{ width:28, height:28, borderRadius:6, border:'1px solid #e5e7eb', background:W, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                          <Trash2 size={12} color="#9ca3af" />
                        </button>
                      </div>
                    </div>

                    {step.channel === 'email' && (
                      <>
                        <input value={step.subject_line||''} onChange={e => updateStep(step.id, { subject_line: e.target.value })} placeholder="Subject line... Use {{first_name}}, {{business_name}}" style={{ width:'100%', padding:'8px 12px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:13, fontFamily:FB, marginBottom:6, boxSizing:'border-box', fontWeight:600 }} />
                        <textarea value={step.body_template||''} onChange={e => updateStep(step.id, { body_template: e.target.value })} placeholder="Email body... Use {{first_name}}, {{business_name}}, {{city}}, {{pain_point}}, {{closer_name}}" rows={4} style={{ width:'100%', padding:'8px 12px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB, resize:'vertical', boxSizing:'border-box' }} />
                      </>
                    )}

                    {step.channel === 'sms' && (
                      <div>
                        <textarea value={step.sms_template||''} onChange={e => updateStep(step.id, { sms_template: e.target.value })} placeholder="SMS message... Use {{first_name}}, {{business_name}}. Keep under 160 chars." rows={2} style={{ width:'100%', padding:'8px 12px', borderRadius:6, border:'1px solid #e5e7eb', fontSize:12, fontFamily:FB, resize:'vertical', boxSizing:'border-box' }} />
                        <div style={{ fontSize:10, color:(step.sms_template||'').length > 160 ? R : '#6b7280', fontFamily:FB, textAlign:'right', marginTop:2 }}>{(step.sms_template||'').length}/160</div>
                      </div>
                    )}

                    {step.channel === 'call' && (
                      <div style={{ fontSize:12, color:'#6b7280', fontFamily:FB, padding:'8px 12px', background:'#f9fafb', borderRadius:6 }}>
                        AI voice agent will call the contact. Configure agent scripts in Voice Agent settings.
                      </div>
                    )}

                    {step.total_sent > 0 && (
                      <div style={{ display:'flex', gap:12, marginTop:8, fontSize:12, color:'#6b7280', fontFamily:FB }}>
                        <span>Sent: {step.total_sent}</span>
                        <span>Opened: {step.total_opened||0}</span>
                        <span>Clicked: {step.total_clicked||0}</span>
                        <span>Replied: {step.total_replied||0}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {editSteps.length > 0 && (
            <button onClick={addStep} style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', borderRadius:8, border:'2px dashed #d1d5db', background:'none', color:'#6b7280', fontSize:12, fontWeight:600, fontFamily:FB, cursor:'pointer', marginTop:8, width:'100%', justifyContent:'center' }}>
              <Plus size={14} /> Add Another Step
            </button>
          )}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
