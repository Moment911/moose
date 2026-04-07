"use client";
import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import {
  Phone, PhoneCall, PhoneOff, Mic, Plus, Play, Pause, Trash2, Edit2,
  Upload, Download, Search, ChevronRight, ChevronDown, Clock, Users,
  Target, Check, X, Loader2, BarChart2, Globe, AlertCircle, Volume2,
  FileText, Sparkles, RefreshCw, Send, Star
} from 'lucide-react'

const R='#ea2729',T='#5bc6d0',BLK='#0a0a0a',GRY='#f2f2f0',GRN='#16a34a',AMB='#f59e0b'
const FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB="'Raleway','Helvetica Neue',sans-serif"

const API = '/api/voice'

async function api(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

/* ── tiny reusable pieces ── */
const Badge = ({ label, color, bg }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: '2px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</span>
)

const statusColor = s => {
  const map = { active: { c: '#fff', bg: GRN }, inactive: { c: '#fff', bg: '#6b7280' }, draft: { c: BLK, bg: '#e5e7eb' }, paused: { c: BLK, bg: AMB }, completed: { c: '#fff', bg: T }, pending: { c: '#555', bg: '#e5e7eb' }, calling: { c: '#fff', bg: AMB }, answered: { c: '#fff', bg: GRN }, appointment_set: { c: '#fff', bg: T }, no_answer: { c: '#fff', bg: R }, callback: { c: '#fff', bg: AMB }, failed: { c: '#fff', bg: R } }
  return map[s] || { c: '#555', bg: '#e5e7eb' }
}

const StatPill = ({ label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${color}18`, padding: '3px 10px', borderRadius: 999, fontSize: 12 }}>
    <span style={{ fontWeight: 700, color }}>{value}</span>
    <span style={{ color: '#666' }}>{label}</span>
  </div>
)

const Btn = ({ children, onClick, bg = R, color = '#fff', small, disabled, style: sx }) => (
  <button disabled={disabled} onClick={onClick} style={{ fontFamily: FH, fontSize: small ? 12 : 13, fontWeight: 600, padding: small ? '5px 12px' : '8px 18px', background: disabled ? '#ccc' : bg, color, border: 'none', borderRadius: 8, cursor: disabled ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, ...sx }}>{children}</button>
)

const Input = ({ label, value, onChange, placeholder, textarea, type = 'text', style: sx }) => (
  <div style={{ marginBottom: 12, ...sx }}>
    {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#333', fontFamily: FH }}>{label}</label>}
    {textarea
      ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: FB, resize: 'vertical' }} />
      : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: FB }} />
    }
  </div>
)

const Select = ({ label, value, onChange, options, placeholder }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#333', fontFamily: FH }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: FB, background: '#fff' }}>
      <option value="">{placeholder || 'Select...'}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

/* ── Modal overlay ── */
const Modal = ({ title, onClose, children, width = 560 }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)' }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width, maxHeight: '85vh', overflow: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
)

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function VoiceAgentPage() {
  const { agencyId: authAgencyId } = useAuth()
  const agencyId = authAgencyId || '00000000-0000-0000-0000-000000000099'

  const [tab, setTab] = useState('agents')
  const [loading, setLoading] = useState(true)

  /* data */
  const [agents, setAgents] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [leads, setLeads] = useState([])
  const [calls, setCalls] = useState([])
  const [clients, setClients] = useState([])

  /* filters */
  const [searchQ, setSearchQ] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [callFilterCampaign, setCallFilterCampaign] = useState('')
  const [callFilterStatus, setCallFilterStatus] = useState('')
  const [callFilterAppt, setCallFilterAppt] = useState('')

  /* modals */
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)
  const [showCampaignModal, setShowCampaignModal] = useState(false)

  /* expanded call */
  const [expandedCall, setExpandedCall] = useState(null)

  /* bulk select */
  const [selectedLeads, setSelectedLeads] = useState(new Set())

  const csvRef = useRef(null)

  /* ── load everything ── */
  useEffect(() => { loadAll() }, [agencyId])

  async function loadAll() {
    setLoading(true)
    try {
      const [agRes, campRes, leadRes, callRes, clRes] = await Promise.all([
        api({ action: 'list_agents', agency_id: agencyId }),
        api({ action: 'list_campaigns', agency_id: agencyId }),
        api({ action: 'list_leads', agency_id: agencyId }),
        api({ action: 'list_calls', agency_id: agencyId }),
        api({ action: 'list_clients', agency_id: agencyId }),
      ])
      setAgents(agRes.data || agRes.agents || [])
      setCampaigns(campRes.data || campRes.campaigns || [])
      setLeads(leadRes.data || leadRes.leads || [])
      setCalls(callRes.data || callRes.calls || [])
      setClients(clRes.data || clRes.clients || [])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load voice data')
    }
    setLoading(false)
  }

  /* ── header stats ── */
  const totalAgents = agents.length
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length
  const callsToday = calls.filter(c => {
    if (!c.created_at) return false
    const d = new Date(c.created_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  const tabs = [
    { key: 'agents', label: 'Agents', icon: <Mic size={15} /> },
    { key: 'campaigns', label: 'Campaigns', icon: <Target size={15} /> },
    { key: 'leads', label: 'Leads', icon: <Users size={15} /> },
    { key: 'history', label: 'Call History', icon: <Clock size={15} /> },
  ]

  /* ═══════════════════════════════════════════════
     AGENTS TAB
     ═══════════════════════════════════════════════ */
  function AgentsTab() {
    const filtered = agents.filter(a => !searchQ || (a.name || '').toLowerCase().includes(searchQ.toLowerCase()))

    async function deleteAgent(id) {
      if (!confirm('Delete this agent?')) return
      try {
        await api({ action: 'delete_agent', agent_id: id, agency_id: agencyId })
        toast.success('Agent deleted')
        loadAll()
      } catch { toast.error('Delete failed') }
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#aaa' }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search agents..." style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: FB }} />
          </div>
          <Btn onClick={() => { setEditingAgent(null); setShowAgentModal(true) }}><Plus size={14} /> Create Agent</Btn>
        </div>

        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <Mic size={40} style={{ marginBottom: 12, opacity: .3 }} />
            <p style={{ fontFamily: FH, fontWeight: 600 }}>No voice agents yet</p>
            <p style={{ fontSize: 13 }}>Create your first AI voice agent to start making calls.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
          {filtered.map(a => (
            <div key={a.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, transition: 'box-shadow .15s', cursor: 'default' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <h4 style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, margin: 0 }}>{a.name}</h4>
                  <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>{a.voice_name || 'Default Voice'} &middot; {a.gender || 'N/A'} &middot; {a.language || 'en'}</p>
                </div>
                <Badge label={a.status || 'active'} {...statusColor(a.status || 'active')} />
              </div>
              {a.goal && <p style={{ fontSize: 12, color: '#666', margin: '8px 0', lineHeight: 1.5 }}>{a.goal.length > 120 ? a.goal.slice(0, 120) + '...' : a.goal}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Btn small bg="#f3f4f6" color="#333" onClick={() => { setEditingAgent(a); setShowAgentModal(true) }}><Edit2 size={12} /> Edit</Btn>
                <Btn small bg="#fef2f2" color={R} onClick={() => deleteAgent(a.id)}><Trash2 size={12} /> Delete</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════
     AGENT MODAL
     ═══════════════════════════════════════════════ */
  function AgentModal() {
    const [form, setForm] = useState({
      name: editingAgent?.name || '',
      voice_name: editingAgent?.voice_name || '',
      gender: editingAgent?.gender || 'female',
      language: editingAgent?.language || 'en',
      personality: editingAgent?.personality || '',
      goal: editingAgent?.goal || '',
      script_intro: editingAgent?.script_intro || '',
      script_questions: editingAgent?.script_questions || [''],
      script_objections: editingAgent?.script_objections || [{ objection: '', response: '' }],
      script_closing: editingAgent?.script_closing || '',
      business_context: editingAgent?.business_context || '',
    })
    const [saving, setSaving] = useState(false)

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function save() {
      if (!form.name.trim()) { toast.error('Name is required'); return }
      setSaving(true)
      try {
        const action = editingAgent ? 'update_agent' : 'create_agent'
        const payload = { action, agency_id: agencyId, ...form }
        if (editingAgent) payload.agent_id = editingAgent.id
        // clean empty questions/objections
        payload.script_questions = form.script_questions.filter(q => q.trim())
        payload.script_objections = form.script_objections.filter(o => o.objection.trim() || o.response.trim())
        await api(payload)
        toast.success(editingAgent ? 'Agent updated' : 'Agent created')
        setShowAgentModal(false)
        loadAll()
      } catch { toast.error('Failed to save agent') }
      setSaving(false)
    }

    const voices = [
      { value: 'sarah', label: 'Sarah (Female, Warm)' },
      { value: 'james', label: 'James (Male, Professional)' },
      { value: 'emma', label: 'Emma (Female, Energetic)' },
      { value: 'michael', label: 'Michael (Male, Authoritative)' },
      { value: 'sophia', label: 'Sophia (Female, Friendly)' },
      { value: 'david', label: 'David (Male, Casual)' },
      { value: 'olivia', label: 'Olivia (Female, Confident)' },
      { value: 'daniel', label: 'Daniel (Male, Calm)' },
    ]

    return (
      <Modal title={editingAgent ? 'Edit Agent' : 'Create Voice Agent'} onClose={() => setShowAgentModal(false)} width={620}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Input label="Agent Name" value={form.name} onChange={v => set('name', v)} placeholder="e.g. Sales Outreach Bot" />
          <Select label="Voice" value={form.voice_name} onChange={v => set('voice_name', v)} options={voices} placeholder="Select voice..." />
          <Select label="Gender" value={form.gender} onChange={v => set('gender', v)} options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} />
          <Select label="Language" value={form.language} onChange={v => set('language', v)} options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' }, { value: 'fr', label: 'French' }, { value: 'de', label: 'German' }, { value: 'pt', label: 'Portuguese' }]} />
        </div>
        <Input label="Personality" value={form.personality} onChange={v => set('personality', v)} placeholder="Friendly, professional, persuasive..." textarea />
        <Input label="Goal" value={form.goal} onChange={v => set('goal', v)} placeholder="Book a demo call with qualified leads..." textarea />
        <Input label="Script - Introduction" value={form.script_intro} onChange={v => set('script_intro', v)} placeholder="Hi, this is [name] from [company]..." textarea />

        {/* Questions */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#333', fontFamily: FH }}>Script - Questions</label>
          {form.script_questions.map((q, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={q} onChange={e => { const qs = [...form.script_questions]; qs[i] = e.target.value; set('script_questions', qs) }}
                placeholder={`Question ${i + 1}`} style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontFamily: FB }} />
              {form.script_questions.length > 1 && (
                <button onClick={() => set('script_questions', form.script_questions.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: R }}><X size={14} /></button>
              )}
            </div>
          ))}
          <Btn small bg="#f3f4f6" color="#333" onClick={() => set('script_questions', [...form.script_questions, ''])}><Plus size={12} /> Add Question</Btn>
        </div>

        {/* Objections */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#333', fontFamily: FH }}>Script - Objection Handling</label>
          {form.script_objections.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={o.objection} onChange={e => { const obs = [...form.script_objections]; obs[i] = { ...obs[i], objection: e.target.value }; set('script_objections', obs) }}
                placeholder="Objection..." style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontFamily: FB }} />
              <input value={o.response} onChange={e => { const obs = [...form.script_objections]; obs[i] = { ...obs[i], response: e.target.value }; set('script_objections', obs) }}
                placeholder="Response..." style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontFamily: FB }} />
              {form.script_objections.length > 1 && (
                <button onClick={() => set('script_objections', form.script_objections.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: R }}><X size={14} /></button>
              )}
            </div>
          ))}
          <Btn small bg="#f3f4f6" color="#333" onClick={() => set('script_objections', [...form.script_objections, { objection: '', response: '' }])}><Plus size={12} /> Add Objection</Btn>
        </div>

        <Input label="Script - Closing" value={form.script_closing} onChange={v => set('script_closing', v)} placeholder="Thank you for your time..." textarea />
        <Input label="Business Context" value={form.business_context} onChange={v => set('business_context', v)} placeholder="Company sells SaaS tools for agencies..." textarea />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <Btn bg="#f3f4f6" color="#333" onClick={() => setShowAgentModal(false)}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />} {editingAgent ? 'Update' : 'Create'} Agent</Btn>
        </div>
      </Modal>
    )
  }

  /* ═══════════════════════════════════════════════
     CAMPAIGNS TAB
     ═══════════════════════════════════════════════ */
  function CampaignsTab() {
    const filtered = campaigns.filter(c => !searchQ || (c.name || '').toLowerCase().includes(searchQ.toLowerCase()))

    async function startCampaign(id) {
      try {
        await api({ action: 'start_campaign', campaign_id: id, agency_id: agencyId })
        toast.success('Campaign started - calls beginning...')
        loadAll()
      } catch { toast.error('Failed to start campaign') }
    }

    async function pauseCampaign(id) {
      try {
        await api({ action: 'pause_campaign', campaign_id: id, agency_id: agencyId })
        toast.success('Campaign paused')
        loadAll()
      } catch { toast.error('Failed to pause campaign') }
    }

    async function deleteCampaign(id) {
      if (!confirm('Delete this campaign and all its data?')) return
      try {
        await api({ action: 'delete_campaign', campaign_id: id, agency_id: agencyId })
        toast.success('Campaign deleted')
        loadAll()
      } catch { toast.error('Delete failed') }
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#aaa' }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search campaigns..." style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: FB }} />
          </div>
          <Btn onClick={() => setShowCampaignModal(true)}><Plus size={14} /> New Campaign</Btn>
        </div>

        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <Target size={40} style={{ marginBottom: 12, opacity: .3 }} />
            <p style={{ fontFamily: FH, fontWeight: 600 }}>No campaigns yet</p>
            <p style={{ fontSize: 13 }}>Create a campaign to start making automated calls.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(c => {
            const agent = agents.find(a => a.id === c.agent_id)
            const total = c.total_leads || 0
            const called = c.called || 0
            const pct = total > 0 ? Math.round((called / total) * 100) : 0
            const sc = statusColor(c.status || 'draft')

            return (
              <div key={c.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <h4 style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, margin: 0 }}>{c.name}</h4>
                    <p style={{ fontSize: 12, color: '#888', margin: '3px 0 0' }}>Agent: {agent?.name || 'Unknown'} {c.scheduled_start ? ` | Start: ${new Date(c.scheduled_start).toLocaleDateString()}` : ''}</p>
                  </div>
                  <Badge label={c.status || 'draft'} color={sc.c} bg={sc.bg} />
                </div>

                {/* Stats pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <StatPill label="Total" value={total} color="#6b7280" />
                  <StatPill label="Called" value={called} color={T} />
                  <StatPill label="Answered" value={c.answered || 0} color={GRN} />
                  <StatPill label="Appointments" value={c.appointments || 0} color={T} />
                  <StatPill label="No Answer" value={c.no_answer || 0} color={R} />
                </div>

                {/* Progress bar */}
                <div style={{ background: '#f3f4f6', borderRadius: 999, height: 6, marginBottom: 14, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${T}, ${GRN})`, borderRadius: 999, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>{called}/{total} called ({pct}%)</div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {(c.status === 'draft' || c.status === 'paused') && (
                    <Btn small bg={GRN} onClick={() => startCampaign(c.id)}><Play size={12} /> Start Calling</Btn>
                  )}
                  {c.status === 'active' && (
                    <Btn small bg={AMB} onClick={() => pauseCampaign(c.id)}><Pause size={12} /> Pause</Btn>
                  )}
                  <Btn small bg="#fef2f2" color={R} onClick={() => deleteCampaign(c.id)}><Trash2 size={12} /> Delete</Btn>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════
     CAMPAIGN MODAL
     ═══════════════════════════════════════════════ */
  function CampaignModal() {
    const [form, setForm] = useState({ name: '', agent_id: '', client_id: '', scheduled_start: '', scheduled_end: '' })
    const [saving, setSaving] = useState(false)
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function save() {
      if (!form.name.trim()) { toast.error('Name is required'); return }
      if (!form.agent_id) { toast.error('Select an agent'); return }
      setSaving(true)
      try {
        await api({ action: 'create_campaign', agency_id: agencyId, ...form })
        toast.success('Campaign created')
        setShowCampaignModal(false)
        loadAll()
      } catch { toast.error('Failed to create campaign') }
      setSaving(false)
    }

    return (
      <Modal title="New Campaign" onClose={() => setShowCampaignModal(false)}>
        <Input label="Campaign Name" value={form.name} onChange={v => set('name', v)} placeholder="e.g. Q1 Lead Outreach" />
        <Select label="Voice Agent" value={form.agent_id} onChange={v => set('agent_id', v)}
          options={agents.map(a => ({ value: a.id, label: a.name }))} placeholder="Select agent..." />
        <Select label="Client (optional)" value={form.client_id} onChange={v => set('client_id', v)}
          options={clients.map(c => ({ value: c.id, label: c.name }))} placeholder="Select client..." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Input label="Scheduled Start" value={form.scheduled_start} onChange={v => set('scheduled_start', v)} type="datetime-local" />
          <Input label="Scheduled End" value={form.scheduled_end} onChange={v => set('scheduled_end', v)} type="datetime-local" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <Btn bg="#f3f4f6" color="#333" onClick={() => setShowCampaignModal(false)}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? <Loader2 size={14} /> : <Check size={14} />} Create Campaign</Btn>
        </div>
      </Modal>
    )
  }

  /* ═══════════════════════════════════════════════
     LEADS TAB
     ═══════════════════════════════════════════════ */
  function LeadsTab() {
    const campaignLeads = selectedCampaign ? leads.filter(l => l.campaign_id === selectedCampaign) : leads
    const filtered = campaignLeads.filter(l => !searchQ || (l.name || '').toLowerCase().includes(searchQ.toLowerCase()) || (l.business || '').toLowerCase().includes(searchQ.toLowerCase()))

    function toggleSelect(id) {
      const s = new Set(selectedLeads)
      s.has(id) ? s.delete(id) : s.add(id)
      setSelectedLeads(s)
    }

    function toggleAll() {
      if (selectedLeads.size === filtered.length) setSelectedLeads(new Set())
      else setSelectedLeads(new Set(filtered.map(l => l.id)))
    }

    async function bulkDelete() {
      if (selectedLeads.size === 0) return
      if (!confirm(`Delete ${selectedLeads.size} lead(s)?`)) return
      try {
        await api({ action: 'delete_leads', lead_ids: [...selectedLeads], agency_id: agencyId })
        toast.success(`${selectedLeads.size} leads deleted`)
        setSelectedLeads(new Set())
        loadAll()
      } catch { toast.error('Delete failed') }
    }

    function handleCSV(e) {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const text = ev.target.result
          const lines = text.split('\n').filter(l => l.trim())
          if (lines.length < 2) { toast.error('CSV must have header row + data'); return }
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
          const rows = lines.slice(1).map(line => {
            const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
            const obj = {}
            headers.forEach((h, i) => { obj[h] = vals[i] || '' })
            return obj
          })
          if (!selectedCampaign) { toast.error('Select a campaign first'); return }
          await api({ action: 'add_leads', campaign_id: selectedCampaign, leads: rows, agency_id: agencyId })
          toast.success(`${rows.length} leads imported`)
          loadAll()
        } catch { toast.error('CSV parse error') }
      }
      reader.readAsText(file)
      e.target.value = ''
    }

    async function importFromScout() {
      if (!selectedCampaign) { toast.error('Select a campaign first'); return }
      try {
        const res = await api({ action: 'import_scout_leads', campaign_id: selectedCampaign, agency_id: agencyId })
        toast.success(`${res.count || 0} leads imported from Scout`)
        loadAll()
      } catch { toast.error('Import failed') }
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Select label="" value={selectedCampaign} onChange={setSelectedCampaign}
              options={campaigns.map(c => ({ value: c.id, label: c.name }))} placeholder="All Campaigns" />
            <div style={{ position: 'relative', width: 220 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#aaa' }} />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search leads..." style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: FB }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedLeads.size > 0 && (
              <Btn small bg="#fef2f2" color={R} onClick={bulkDelete}><Trash2 size={12} /> Delete ({selectedLeads.size})</Btn>
            )}
            <Btn small bg={T} onClick={importFromScout}><Sparkles size={12} /> Import from Scout</Btn>
            <Btn small onClick={() => csvRef.current?.click()}><Upload size={12} /> Import CSV</Btn>
            <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSV} />
          </div>
        </div>

        {filtered.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <Users size={40} style={{ marginBottom: 12, opacity: .3 }} />
            <p style={{ fontFamily: FH, fontWeight: 600 }}>No leads found</p>
            <p style={{ fontSize: 13 }}>Import leads via CSV or from Scout to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FB }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>
                    <input type="checkbox" checked={selectedLeads.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                  </th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontFamily: FH, fontWeight: 600, fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Name</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontFamily: FH, fontWeight: 600, fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Phone</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontFamily: FH, fontWeight: 600, fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Business</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontFamily: FH, fontWeight: 600, fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Location</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontFamily: FH, fontWeight: 600, fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Source</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontFamily: FH, fontWeight: 600, fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontFamily: FH, fontWeight: 600, fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Duration</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontFamily: FH, fontWeight: 600, fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const sc = statusColor(l.status || 'pending')
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px' }}>
                        <input type="checkbox" checked={selectedLeads.has(l.id)} onChange={() => toggleSelect(l.id)} />
                      </td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{l.name || '-'}</td>
                      <td style={{ padding: '8px', color: '#666' }}>{l.phone || '-'}</td>
                      <td style={{ padding: '8px', color: '#666' }}>{l.business || '-'}</td>
                      <td style={{ padding: '8px', color: '#666' }}>{[l.city, l.state].filter(Boolean).join(', ') || '-'}</td>
                      <td style={{ padding: '8px', color: '#888', fontSize: 12 }}>{l.source || '-'}</td>
                      <td style={{ padding: '8px' }}><Badge label={l.status || 'pending'} color={sc.c} bg={sc.bg} /></td>
                      <td style={{ padding: '8px', color: '#666' }}>{l.call_duration ? `${l.call_duration}s` : '-'}</td>
                      <td style={{ padding: '8px' }}>
                        <button onClick={async () => {
                          if (!confirm('Delete this lead?')) return
                          await api({ action: 'delete_leads', lead_ids: [l.id], agency_id: agencyId })
                          toast.success('Lead deleted')
                          loadAll()
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: R }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  /* ═══════════════════════════════════════════════
     CALL HISTORY TAB
     ═══════════════════════════════════════════════ */
  function CallHistoryTab() {
    let filtered = [...calls]
    if (callFilterCampaign) filtered = filtered.filter(c => c.campaign_id === callFilterCampaign)
    if (callFilterStatus) filtered = filtered.filter(c => c.status === callFilterStatus)
    if (callFilterAppt === 'yes') filtered = filtered.filter(c => c.has_appointment)
    if (callFilterAppt === 'no') filtered = filtered.filter(c => !c.has_appointment)
    if (searchQ) filtered = filtered.filter(c => (c.lead_name || '').toLowerCase().includes(searchQ.toLowerCase()))

    const sentimentColor = s => {
      if (s === 'positive') return { c: '#fff', bg: GRN }
      if (s === 'negative') return { c: '#fff', bg: R }
      if (s === 'neutral') return { c: '#555', bg: '#e5e7eb' }
      return { c: '#555', bg: '#e5e7eb' }
    }

    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#aaa' }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search calls..." style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: FB }} />
          </div>
          <Select label="" value={callFilterCampaign} onChange={setCallFilterCampaign}
            options={campaigns.map(c => ({ value: c.id, label: c.name }))} placeholder="All Campaigns" />
          <Select label="" value={callFilterStatus} onChange={setCallFilterStatus}
            options={[{ value: 'answered', label: 'Answered' }, { value: 'no_answer', label: 'No Answer' }, { value: 'failed', label: 'Failed' }, { value: 'voicemail', label: 'Voicemail' }]} placeholder="All Statuses" />
          <Select label="" value={callFilterAppt} onChange={setCallFilterAppt}
            options={[{ value: 'yes', label: 'Has Appointment' }, { value: 'no', label: 'No Appointment' }]} placeholder="Appointments" />
          {(callFilterCampaign || callFilterStatus || callFilterAppt) && (
            <Btn small bg="#f3f4f6" color="#333" onClick={() => { setCallFilterCampaign(''); setCallFilterStatus(''); setCallFilterAppt('') }}><X size={12} /> Clear</Btn>
          )}
        </div>

        {filtered.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <PhoneOff size={40} style={{ marginBottom: 12, opacity: .3 }} />
            <p style={{ fontFamily: FH, fontWeight: 600 }}>No calls found</p>
            <p style={{ fontSize: 13 }}>Call history will appear here once campaigns start running.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(c => {
              const sc = statusColor(c.status || 'pending')
              const sentC = sentimentColor(c.sentiment)
              const isExpanded = expandedCall === c.id

              return (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  <div onClick={() => setExpandedCall(isExpanded ? null : c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}>
                    {isExpanded ? <ChevronDown size={14} color="#999" /> : <ChevronRight size={14} color="#999" />}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: FH, fontWeight: 600, fontSize: 14 }}>{c.lead_name || 'Unknown'}</span>
                        <span style={{ fontSize: 12, color: '#999' }}>{c.phone || ''}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {c.duration && <span style={{ fontSize: 12, color: '#888' }}><Clock size={11} style={{ marginRight: 3 }} />{c.duration}s</span>}
                      <Badge label={c.status || 'unknown'} color={sc.c} bg={sc.bg} />
                      {c.sentiment && <Badge label={c.sentiment} color={sentC.c} bg={sentC.bg} />}
                      {c.has_appointment && <Badge label="Appt Set" color="#fff" bg={T} />}
                      <span style={{ fontSize: 11, color: '#aaa' }}>{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '16px 18px', background: '#fafafa' }}>
                      {c.summary && (
                        <div style={{ marginBottom: 14 }}>
                          <h5 style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: '#555', margin: '0 0 6px', textTransform: 'uppercase' }}>AI Summary</h5>
                          <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6, margin: 0 }}>{c.summary}</p>
                        </div>
                      )}
                      {c.transcript && (
                        <div style={{ marginBottom: 14 }}>
                          <h5 style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: '#555', margin: '0 0 6px', textTransform: 'uppercase' }}>Transcript</h5>
                          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, maxHeight: 300, overflow: 'auto', fontSize: 13, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: FB }}>
                            {c.transcript}
                          </div>
                        </div>
                      )}
                      {c.recording_url && (
                        <div>
                          <h5 style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: '#555', margin: '0 0 6px', textTransform: 'uppercase' }}>Recording</h5>
                          <audio controls src={c.recording_url} style={{ width: '100%', borderRadius: 8 }} />
                        </div>
                      )}
                      {!c.summary && !c.transcript && !c.recording_url && (
                        <p style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>No additional details available for this call.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{ background: BLK, padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Phone size={22} color={T} />
            <h1 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>Voice Agent</h1>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: FH }}>{totalAgents}</div>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: .5 }}>Agents</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T, fontFamily: FH }}>{activeCampaigns}</div>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: .5 }}>Active</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: GRN, fontFamily: FH }}>{callsToday}</div>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: .5 }}>Calls Today</div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 28px', display: 'flex', gap: 0 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearchQ('') }}
              style={{
                fontFamily: FH, fontSize: 13, fontWeight: 600, padding: '14px 20px',
                background: 'none', border: 'none', borderBottom: tab === t.key ? `3px solid ${R}` : '3px solid transparent',
                color: tab === t.key ? BLK : '#999', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all .15s'
              }}>
              {t.icon} {t.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={loadAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 10, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: FH }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
              <Loader2 size={28} color={T} style={{ animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            </div>
          ) : (
            <>
              {tab === 'agents' && <AgentsTab />}
              {tab === 'campaigns' && <CampaignsTab />}
              {tab === 'leads' && <LeadsTab />}
              {tab === 'history' && <CallHistoryTab />}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {showAgentModal && <AgentModal />}
      {showCampaignModal && <CampaignModal />}
    </div>
  )
}
