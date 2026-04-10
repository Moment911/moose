"use client";
import React, { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import {
  Phone, PhoneCall, PhoneOff, PhoneIncoming, Mic, MicOff, Plus, Play, Pause, Square,
  Trash2, Edit2, Upload, Download, Search, ChevronRight, ChevronDown, Clock, Users,
  Target, Check, X, Loader2, BarChart2, Globe, AlertCircle, Volume2, FileText,
  Sparkles, RefreshCw, Send, Star, Shield, Calendar, Brain, TrendingUp,
  AlertTriangle, Copy, ExternalLink, Settings, Zap
} from 'lucide-react'

const R   = '#E6007E',T='#00C2CB',BLK='#111111',GRY='#F9F9F9',GRN='#16a34a',AMB='#f59e0b',PURP='#7c3aed'
const W='#ffffff'
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

/* ── RETELL VOICES ── */
const RETELL_VOICES = [
  { id:'11labs-Marissa', name:'Marissa', provider:'ElevenLabs', gender:'Female', accent:'American', tone:'Professional', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/marissa.mp3' },
  { id:'11labs-Lily', name:'Lily', provider:'ElevenLabs', gender:'Female', accent:'American', tone:'Friendly', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/lily.mp3' },
  { id:'11labs-Billy', name:'Billy', provider:'ElevenLabs', gender:'Male', accent:'American', tone:'Casual', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/billy.mp3' },
  { id:'11labs-Anthony', name:'Anthony', provider:'ElevenLabs', gender:'Male', accent:'British', tone:'Professional', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/anthony.mp3' },
  { id:'11labs-Merritt', name:'Merritt', provider:'ElevenLabs', gender:'Female', accent:'American', tone:'Warm', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/11labs-Merritt.mp3' },
  { id:'11labs-Dorothy', name:'Dorothy', provider:'ElevenLabs', gender:'Female', accent:'British', tone:'Authoritative', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/Dorothy.mp3' },
  { id:'openai-Nova', name:'Nova', provider:'OpenAI', gender:'Female', accent:'American', tone:'Energetic', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/nova_.wav' },
  { id:'cartesia-Brian', name:'Brian', provider:'Cartesia', gender:'Male', accent:'American', tone:'Trustworthy', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/cartesia-ccb4cea5-13c8-4559-a9c8-e83bc8171c4d.mp3' },
  { id:'cartesia-Cleo', name:'Cleo', provider:'Cartesia', gender:'Female', accent:'American', tone:'Confident', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/cartesia-cc444464-5920-438d-ac33-e6a6dd34a955.mp3' },
  { id:'cartesia-Emily', name:'Emily', provider:'Cartesia', gender:'Female', accent:'American', tone:'Empathetic', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/cartesia-9b63a859-58b7-4388-a5ff-eeb3cbb701ed.mp3' },
  { id:'cartesia-Victoria', name:'Victoria', provider:'Cartesia', gender:'Female', accent:'American', tone:'Executive', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/cartesia-10389723-cc73-4d94-a4ba-9fe7eccd98d3.mp3' },
  { id:'cartesia-Andrew', name:'Andrew', provider:'Cartesia', gender:'Male', accent:'American', tone:'Consultative', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/cartesia-57b18927-80da-4929-a185-517ccc549976.mp3' },
  { id:'minimax-Daniel', name:'Daniel', provider:'Minimax', gender:'Male', accent:'American', tone:'Persuasive', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/daniel.mp3' },
  { id:'minimax-Ashley', name:'Ashley', provider:'Minimax', gender:'Female', accent:'American', tone:'Upbeat', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/ashley.mp3' },
  { id:'retell-Nico', name:'Nico', provider:'Retell', gender:'Male', accent:'American', tone:'Natural', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/minimax_nico.mp3' },
  { id:'retell-Della', name:'Della', provider:'Retell', gender:'Female', accent:'American', tone:'Conversational', preview:'https://retell-utils-public.s3.us-west-2.amazonaws.com/minimax-Della.mp3' },
]

/* ── SIC CODES ── */
import { SIC_CODES, INDUSTRY_KNOWLEDGE } from '../data/sicCodes'

/* ── tiny reusable pieces ── */
const Badge = ({ label, color, bg }) => (
  <span style={{ fontSize:11, fontWeight:700, color, background:bg, padding:'2px 10px', borderRadius:999, textTransform:'uppercase', letterSpacing:.5 }}>{label}</span>
)

const statusColor = s => {
  const map = { active:{c:W,bg:GRN}, inactive:{c:W,bg:'#6b7280'}, draft:{c:BLK,bg:'#e5e7eb'}, paused:{c:BLK,bg:AMB}, completed:{c:W,bg:T}, running:{c:W,bg:GRN}, pending:{c:'#555',bg:'#e5e7eb'}, calling:{c:W,bg:AMB}, answered:{c:W,bg:GRN}, appointment_set:{c:W,bg:T}, no_answer:{c:W,bg:R}, callback:{c:W,bg:AMB}, failed:{c:W,bg:R} }
  return map[s] || { c:'#555', bg:'#e5e7eb' }
}

const StatPill = ({ label, value, color }) => (
  <div style={{ display:'flex', alignItems:'center', gap:6, background:`${color}18`, padding:'3px 10px', borderRadius:999, fontSize:12 }}>
    <span style={{ fontWeight:700, color }}>{value}</span>
    <span style={{ color:'#666' }}>{label}</span>
  </div>
)

const Btn = ({ children, onClick, bg=R, color=W, small, disabled, style:sx }) => (
  <button disabled={disabled} onClick={onClick} style={{ fontFamily:FH, fontSize:small?12:13, fontWeight:600, padding:small?'5px 12px':'8px 18px', background:disabled?'#ccc':bg, color, border:'none', borderRadius:8, cursor:disabled?'default':'pointer', display:'inline-flex', alignItems:'center', gap:6, transition:'opacity .15s', ...sx }}>{children}</button>
)

const Input = ({ label, value, onChange, placeholder, textarea, type='text', style:sx }) => (
  <div style={{ marginBottom:12, ...sx }}>
    {label && <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4, fontFamily:FH }}>{label}</label>}
    {textarea
      ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, resize:'vertical', boxSizing:'border-box' }} />
      : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />}
  </div>
)

const Select = ({ label, value, onChange, options, placeholder, style:sx }) => (
  <div style={{ marginBottom:12, ...sx }}>
    {label && <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4, fontFamily:FH }}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, background:W, boxSizing:'border-box' }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

const Card = ({ children, style:sx }) => (
  <div style={{ background:W, borderRadius:12, border:'1px solid #e5e7eb', padding:20, ...sx }}>{children}</div>
)

const StatCard = ({ icon:Icon, label, value, color=T, sub }) => (
  <Card style={{ flex:1, minWidth:160 }}>
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
      <div style={{ width:32, height:32, borderRadius:8, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon size={16} color={color} /></div>
      <span style={{ fontSize:11, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:.5, fontFamily:FH }}>{label}</span>
    </div>
    <div style={{ fontSize:24, fontWeight:700, color:BLK, fontFamily:FH }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{sub}</div>}
  </Card>
)

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{ background:W, borderRadius:16, width:wide?720:520, maxHeight:'85vh', overflow:'auto', padding:28 }}>
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
  { key:'agents', label:'Agents', icon:Users },
  { key:'campaigns', label:'Campaigns', icon:Target },
  { key:'leads', label:'Leads', icon:PhoneIncoming },
  { key:'history', label:'Call History', icon:Phone },
  { key:'analytics', label:'Analytics', icon:BarChart2 },
  { key:'tcpa', label:'TCPA', icon:Shield },
  { key:'calendar', label:'Calendar', icon:Calendar },
  { key:'training', label:'Training Data', icon:Brain },
]

/* ──────────────────────────────────────────────────────────────────────────── */
/*  MAIN COMPONENT                                                            */
/* ──────────────────────────────────────────────────────────────────────────── */
export default function VoiceAgentPage() {
  const { agencyId: authAgencyId } = useAuth()
  const aid = authAgencyId || '00000000-0000-0000-0000-000000000099'
  const navigate = useNavigate()

  const [tab, setTab] = useState('agents')
  const [loading, setLoading] = useState(false)

  // Data
  const [agents, setAgents] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [leads, setLeads] = useState([])
  const [calls, setCalls] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [tcpaData, setTcpaData] = useState([])
  const [appointments, setAppointments] = useState([])
  const [availability, setAvailability] = useState({})

  // UI state
  const [showAgentWizard, setShowAgentWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState({ business_name:'', sic_code:'', description:'', service:'', target:'', differentiator:'', service_area:'', deal_size:'', voice_id:'', agent_name:'', personality:'professional', script:{} })
  const [sicSearch, setSicSearch] = useState('')
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [campaignForm, setCampaignForm] = useState({ name:'', agent_id:'', is_test_mode:false })
  const [campaignLeadFile, setCampaignLeadFile] = useState(null)
  const [campaignFilter, setCampaignFilter] = useState('')
  const [leadSearch, setLeadSearch] = useState('')
  const [callExpanded, setCallExpanded] = useState(null)
  const [callFilter, setCallFilter] = useState({ campaign:'', outcome:'', sentiment:'' })
  const [editAgent, setEditAgent] = useState(null)
  const [generatingSection, setGeneratingSection] = useState(null)
  const [calendarTimezone, setCalendarTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)

  const fileRef = useRef(null)
  const csvRef = useRef(null)

  /* ── DATA LOADING ── */
  useEffect(() => { loadAll() }, [aid])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [agRes, campRes, leadRes, callRes] = await Promise.all([
        api({ action:'list_agents', agency_id:aid }),
        api({ action:'list_campaigns', agency_id:aid }),
        api({ action:'list_leads', agency_id:aid }),
        api({ action:'list_calls', agency_id:aid }),
      ])
      if (agRes.agents) setAgents(agRes.agents)
      if (campRes.campaigns) setCampaigns(campRes.campaigns)
      if (leadRes.leads) setLeads(leadRes.leads)
      if (callRes.calls) setCalls(callRes.calls)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const loadAnalytics = async () => {
    try {
      const res = await api({ action:'get_analytics', agency_id:aid })
      if (res) setAnalytics(res)
    } catch(e) { console.error(e) }
  }

  const loadTcpa = async () => {
    try {
      const res = await api({ action:'list_tcpa', agency_id:aid })
      if (res.records) setTcpaData(res.records)
    } catch(e) { console.error(e) }
  }

  const loadAppointments = async () => {
    try {
      const res = await api({ action:'list_appointments', agency_id:aid })
      if (res.appointments) setAppointments(res.appointments)
      if (res.availability) setAvailability(res.availability)
    } catch(e) { console.error(e) }
  }

  useEffect(() => {
    if (tab === 'analytics') loadAnalytics()
    if (tab === 'tcpa') loadTcpa()
    if (tab === 'calendar') loadAppointments()
  }, [tab])

  /* ── AGENT CRUD ── */
  const saveAgent = async () => {
    try {
      const payload = { action: editAgent ? 'update_agent' : 'create_agent', agency_id:aid, ...wizardData }
      if (editAgent) payload.agent_id = editAgent.id
      const res = await api(payload)
      if (res.error) { toast.error(res.error); return }
      toast.success(editAgent ? 'Agent updated' : 'Agent created')
      setShowAgentWizard(false)
      setEditAgent(null)
      setWizardStep(1)
      setWizardData({ business_name:'', sic_code:'', description:'', service:'', target:'', differentiator:'', service_area:'', deal_size:'', voice_id:'', agent_name:'', personality:'professional', script:{} })
      loadAll()
    } catch(e) { toast.error('Failed to save agent') }
  }

  const deleteAgent = async (id) => {
    if (!confirm('Delete this agent?')) return
    await api({ action:'delete_agent', agency_id:aid, agent_id:id })
    toast.success('Agent deleted')
    loadAll()
  }

  const openEditAgent = (ag) => {
    setEditAgent(ag)
    setWizardData({
      business_name:ag.business_name||'', sic_code:ag.sic_code||'', description:ag.description||'',
      service:ag.service||'', target:ag.target||'', differentiator:ag.differentiator||'',
      service_area:ag.service_area||'', deal_size:ag.deal_size||'', voice_id:ag.voice_id||'',
      agent_name:ag.name||'', personality:ag.personality||'professional', script:ag.script||{},
      closer_name:ag.closer_name||'', closer_title:ag.closer_title||'', closer_phone:ag.closer_phone||'',
      closer_calendar:ag.closer_calendar||'', closer_bio:ag.closer_bio||'', closer_expertise:ag.closer_expertise||'',
      closer_experience:ag.closer_experience||'', closer_proof:ag.closer_proof||'',
      meeting_duration:ag.meeting_duration||'15',
      max_call_duration:ag.max_call_duration||5, silence_timeout:ag.silence_timeout||10,
      interruption_sensitivity:ag.interruption_sensitivity||'medium',
      enable_backchannel:ag.enable_backchannel!==false, amd_enabled:ag.amd_enabled!==false,
      dnc_check:ag.dnc_check!==false, timezone_enforce:ag.timezone_enforce!==false,
      tcpa_required:ag.tcpa_required!==false, recording_enabled:ag.recording_enabled!==false,
      transfer_phone:ag.transfer_phone||'', transfer_phrases:ag.transfer_phrases||'',
      agent_purpose:ag.agent_purpose||'outbound',
    })
    setWizardStep(1)
    setShowAgentWizard(true)
  }

  /* ── CAMPAIGN CRUD ── */
  const createCampaign = async () => {
    if (!campaignForm.name || !campaignForm.agent_id) { toast.error('Name and agent required'); return }
    try {
      const payload = { action:'create_campaign', agency_id:aid, ...campaignForm }
      if (campaignLeadFile) {
        const text = await campaignLeadFile.text()
        payload.csv_data = text
      }
      const res = await api(payload)
      if (res.error) { toast.error(res.error); return }
      toast.success('Campaign created')
      setShowCampaignModal(false)
      setCampaignForm({ name:'', agent_id:'', is_test_mode:false })
      setCampaignLeadFile(null)
      loadAll()
    } catch(e) { toast.error('Failed to create campaign') }
  }

  const campaignAction = async (id, action) => {
    await api({ action:`campaign_${action}`, agency_id:aid, campaign_id:id })
    toast.success(`Campaign ${action}`)
    loadAll()
  }

  /* ── LEADS ── */
  const importCSV = async (file, campId) => {
    const text = await file.text()
    const res = await api({ action:'import_leads', agency_id:aid, campaign_id:campId, csv_data:text })
    if (res.error) { toast.error(res.error); return }
    toast.success(`Imported ${res.count || 0} leads`)
    loadAll()
  }

  const useScoutLeads = async () => {
    const res = await api({ action:'use_scout_leads', agency_id:aid })
    if (res.error) { toast.error(res.error); return }
    toast.success(`Imported ${res.count || 0} scout leads`)
    loadAll()
  }

  /* ── SCRIPT AI GENERATION ── */
  const generateSection = async (section) => {
    setGeneratingSection(section)
    try {
      const res = await api({ action:'generate_script', section, business_context:{ business_name:wizardData.business_name, sic_code:wizardData.sic_code, description:wizardData.description, service:wizardData.service, target:wizardData.target, differentiator:wizardData.differentiator, service_area:wizardData.service_area } })
      if (res.content) {
        setWizardData(prev => ({ ...prev, script:{ ...prev.script, [section]:res.content } }))
        toast.success(`Generated ${section}`)
      }
    } catch(e) { toast.error('Generation failed') }
    setGeneratingSection(null)
  }

  /* ── VOICE PREVIEW — plays real Retell AI voice sample ── */
  const audioRef = useRef(null)
  const [playingVoice, setPlayingVoice] = useState(null)
  const previewVoice = (voice) => {
    if (!voice.preview) { toast.error('No preview available'); return }
    // Stop any currently playing preview
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (playingVoice === voice.id) { setPlayingVoice(null); return }
    const audio = new Audio(voice.preview)
    audio.onended = () => setPlayingVoice(null)
    audio.onerror = () => { setPlayingVoice(null); toast.error('Failed to load preview') }
    audio.play().catch(() => toast.error('Browser blocked audio playback'))
    audioRef.current = audio
    setPlayingVoice(voice.id)
  }

  /* ── TCPA EXPORT ── */
  const exportTcpaCsv = () => {
    const header = 'Phone,Consent Phone,Consent SMS,Consent Email,Method,Timestamp\n'
    const rows = tcpaData.map(r => `${r.phone},${r.consent_phone?'Yes':'No'},${r.consent_sms?'Yes':'No'},${r.consent_email?'Yes':'No'},${r.method||''},${r.timestamp||''}`).join('\n')
    const blob = new Blob([header+rows], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='tcpa_export.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  /* ── CALENDAR ── */
  const saveAvailability = async (dayData) => {
    try {
      await api({ action:'save_availability', agency_id:aid, availability:dayData, timezone:calendarTimezone })
      toast.success('Availability saved')
      loadAppointments()
    } catch(e) { toast.error('Failed to save') }
  }

  /* ── FILTERED DATA ── */
  const filteredLeads = leads.filter(l => {
    if (campaignFilter && l.campaign_id !== campaignFilter) return false
    if (leadSearch) {
      const q = leadSearch.toLowerCase()
      return (l.name||'').toLowerCase().includes(q) || (l.phone||'').includes(q) || (l.business||'').toLowerCase().includes(q)
    }
    return true
  })

  const filteredCalls = calls.filter(c => {
    if (callFilter.campaign && c.campaign_id !== callFilter.campaign) return false
    if (callFilter.outcome && c.outcome !== callFilter.outcome) return false
    if (callFilter.sentiment && c.sentiment !== callFilter.sentiment) return false
    return true
  })

  const filteredSic = SIC_CODES.filter(s => {
    if (!sicSearch) return true
    return s.code.includes(sicSearch) || s.label.toLowerCase().includes(sicSearch.toLowerCase())
  })

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  AGENTS TAB                                                            */
  /* ════════════════════════════════════════════════════════════════════════ */
  // Voice preview with waveform on agent cards
  const previewAgentVoice = (ag) => {
    const voice = RETELL_VOICES.find(v => v.id === ag.voice_id)
    if (voice) { previewVoice(voice); return }
    // Fallback: browser SpeechSynthesis
    if (window.speechSynthesis) {
      if (playingVoice === ag.id) { window.speechSynthesis.cancel(); setPlayingVoice(null); return }
      const u = new SpeechSynthesisUtterance("Hi, this is calling from Momenta Marketing. I wanted to reach out because we have been helping businesses like yours get significantly more leads.")
      u.rate = 0.9; u.pitch = 1.0
      u.onend = () => setPlayingVoice(null)
      window.speechSynthesis.speak(u)
      setPlayingVoice(ag.id)
    } else { toast.error('No voice preview available') }
  }

  // Duplicate agent
  const duplicateAgent = (ag) => {
    setEditAgent(null)
    setWizardData({
      business_name: ag.business_name || '', sic_code: ag.sic_code || '', description: ag.description || '',
      service: ag.service || '', target: ag.target || '', differentiator: ag.differentiator || '',
      service_area: ag.service_area || '', deal_size: ag.deal_size || '', voice_id: ag.voice_id || '',
      agent_name: (ag.name || '') + ' (Copy)', personality: ag.personality || 'professional',
      script: ag.script || {},
      closer_name: ag.closer_name || '', closer_title: ag.closer_title || '', closer_phone: ag.closer_phone || '',
      closer_calendar: ag.closer_calendar || '', closer_bio: ag.closer_bio || '',
      closer_expertise: ag.closer_expertise || '', closer_experience: ag.closer_experience || '',
      closer_proof: ag.closer_proof || '', meeting_duration: ag.meeting_duration || '15',
      max_call_duration: ag.max_call_duration || 5, silence_timeout: ag.silence_timeout || 10,
      interruption_sensitivity: ag.interruption_sensitivity || 'medium',
      enable_backchannel: ag.enable_backchannel !== false, amd_enabled: ag.amd_enabled !== false,
      dnc_check: ag.dnc_check !== false, timezone_enforce: ag.timezone_enforce !== false,
      tcpa_required: ag.tcpa_required !== false, recording_enabled: ag.recording_enabled !== false,
      transfer_phone: ag.transfer_phone || '', transfer_phrases: ag.transfer_phrases || '',
      agent_purpose: ag.agent_purpose || 'outbound',
    })
    setWizardStep(1)
    setShowAgentWizard(true)
  }

  const renderAgents = () => (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ margin:0, fontFamily:FH, fontSize:18, fontWeight:700, color:BLK }}>Voice Agents</h2>
        <div style={{ display:'flex', gap:8 }}>
          <Btn small bg={`${T}20`} color={T} onClick={async ()=>{
            try {
              const res = await api({ action:'sync_from_retell', agency_id:aid })
              if (res.synced > 0) { toast.success(`Synced ${res.synced} agents from Retell`); loadAll() }
              else toast.success(`All ${res.total_retell} Retell agents already synced`)
            } catch(e) { toast.error('Sync failed') }
          }}><RefreshCw size={12} /> Sync from Retell</Btn>
          <Btn onClick={()=>{
            setEditAgent(null)
            setWizardData({ business_name:'', sic_code:'', description:'', service:'', target:'', differentiator:'', service_area:'', deal_size:'', voice_id:'', agent_name:'', personality:'professional', script:{}, closer_name:'', closer_title:'', closer_phone:'', closer_calendar:'', closer_bio:'', closer_expertise:'', closer_experience:'', closer_proof:'', meeting_duration:'15', max_call_duration:5, silence_timeout:10, interruption_sensitivity:'medium', enable_backchannel:true, amd_enabled:true, dnc_check:true, timezone_enforce:true, tcpa_required:true, recording_enabled:true, transfer_phone:'', transfer_phrases:'', agent_purpose:'outbound' })
            setWizardStep(1); setShowAgentWizard(true)
          }}><Plus size={14} /> New Agent</Btn>
        </div>
      </div>
      {agents.length === 0 && !loading && <Card><p style={{ color:'#888', textAlign:'center', margin:20 }}>No agents yet. Create your first voice agent to get started.</p></Card>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16 }}>
        {agents.map(ag => {
          const voice = RETELL_VOICES.find(v=>v.id===ag.voice_id)
          const sic = SIC_CODES.find(s=>s.code===ag.sic_code)
          const sc = statusColor(ag.status || 'active')
          const isPlaying = playingVoice === ag.voice_id || playingVoice === ag.id
          return (
            <Card key={ag.id} style={{ position:'relative' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, fontFamily:FH, color:BLK }}>{ag.name || 'Unnamed Agent'}</div>
                  <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
                    {voice?.name || ag.voice_id || 'No voice'} ({voice?.provider || 'Unknown'}) -- {voice?.tone || ''}
                  </div>
                </div>
                <Badge label={ag.status||'active'} color={sc.c} bg={sc.bg} />
              </div>

              {/* Voice preview with waveform */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'6px 10px', background:isPlaying?`${PURP}10`:'#f9fafb', borderRadius:8, border:`1px solid ${isPlaying?PURP:'#e5e7eb'}` }}>
                <button onClick={()=>previewAgentVoice(ag)} style={{ width:28, height:28, borderRadius:'50%', border:'none', background:isPlaying?R:PURP, color:W, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                  {isPlaying ? <Square size={10} /> : <Play size={10} style={{ marginLeft:1 }} />}
                </button>
                {isPlaying ? (
                  <div style={{ display:'flex', alignItems:'center', gap:2, height:20 }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{ width:3, borderRadius:2, background:PURP, animation:`waveBar .6s ease-in-out ${i*0.1}s infinite alternate`, height:8 }} />
                    ))}
                    <span style={{ fontSize:11, color:PURP, fontWeight:600, fontFamily:FB, marginLeft:6 }}>Playing...</span>
                  </div>
                ) : (
                  <span style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>Preview Voice</span>
                )}
              </div>

              {sic && <div style={{ fontSize:11, color:'#666', marginBottom:4 }}><Globe size={11} style={{ marginRight:3, verticalAlign:'middle' }} />{sic.code} - {sic.label}</div>}
              {ag.business_name && <div style={{ fontSize:11, color:'#666', marginBottom:4 }}>{ag.business_name}</div>}
              {ag.closer_name && <div style={{ fontSize:11, color:T, marginBottom:4 }}>Closer: {ag.closer_name}</div>}

              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8, marginBottom:10 }}>
                <StatPill label="calls" value={ag.call_count||0} color={T} />
                <StatPill label="appts" value={ag.appointment_count||0} color={GRN} />
                <StatPill label="rate" value={`${ag.connection_rate||0}%`} color={PURP} />
              </div>

              {ag.updated_at && <div style={{ fontSize:10, color:'#bbb', fontFamily:FB, marginBottom:8 }}>Edited {new Date(ag.updated_at).toLocaleDateString()}</div>}

              <div style={{ display:'flex', gap:6 }}>
                <Btn small bg={`${T}15`} color={T} onClick={()=>openEditAgent(ag)}><Edit2 size={12} /> Edit</Btn>
                <Btn small bg="#f3f4f6" color="#6b7280" onClick={()=>duplicateAgent(ag)}><Copy size={12} /> Duplicate</Btn>
                <Btn small bg="#fee2e2" color={R} onClick={()=>deleteAgent(ag.id)}><Trash2 size={12} /></Btn>
              </div>
            </Card>
          )
        })}
      </div>
      <style>{`@keyframes waveBar{0%{height:4px}100%{height:18px}}`}</style>
    </div>
  )

  /* ── AGENT BUILDER (5 TABS) ── */
  const BUILDER_TABS = ['Identity','Business','Closer','Scripts','Advanced']
  const wd = wizardData
  const setWd = (key, val) => setWizardData(p => ({ ...p, [key]: val }))
  const setScript = (key, val) => setWizardData(p => ({ ...p, script: { ...p.script, [key]: val } }))

  // Generate all scripts at once
  const generateAllScripts = async () => {
    for (const section of ['intro','questions','value_prop','objections','closing','voicemail','tcpa_consent']) {
      await generateSection(section)
    }
    toast.success('All scripts generated')
  }

  const renderAgentWizard = () => (
    <Modal title={editAgent ? 'Edit Agent' : 'New Agent'} onClose={()=>{ setShowAgentWizard(false); setEditAgent(null) }} wide>
      {/* Tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #e5e7eb', paddingBottom:0 }}>
        {BUILDER_TABS.map((t, i) => (
          <button key={t} onClick={()=>setWizardStep(i+1)} style={{
            padding:'8px 16px', fontSize:12, fontWeight:wizardStep===i+1?700:500, fontFamily:FH,
            border:'none', borderBottom:wizardStep===i+1?`2px solid ${R}`:'2px solid transparent',
            background:'none', cursor:'pointer', color:wizardStep===i+1?BLK:'#9ca3af',
          }}>{i+1}. {t}</button>
        ))}
      </div>

      {/* TAB 1: IDENTITY */}
      {wizardStep === 1 && (
        <div>
          <Input label="Agent Name (what it calls itself on calls)" value={wd.agent_name} onChange={v=>setWd('agent_name',v)} placeholder="e.g. Alex, Sarah, Jordan" />
          <Select label="Agent Purpose" value={wd.agent_purpose||'outbound'} onChange={v=>setWd('agent_purpose',v)} options={[
            {value:'outbound',label:'Cold Outbound'},{value:'answering',label:'Answering Service'},{value:'reminder',label:'Appointment Reminder'},{value:'followup',label:'Follow-up'}
          ]} />
          <Select label="Personality" value={wd.personality} onChange={v=>setWd('personality',v)} options={[
            {value:'professional',label:'Professional'},{value:'friendly',label:'Friendly'},{value:'energetic',label:'Energetic'},
            {value:'consultative',label:'Consultative'},{value:'empathetic',label:'Empathetic'},{value:'authoritative',label:'Authoritative'}
          ]} />
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'10px 14px', background:'#f9fafb', borderRadius:8 }}>
            <span style={{ fontSize:12, fontWeight:600, fontFamily:FH, color:'#444' }}>Status:</span>
            <button onClick={()=>setWd('status',wd.status==='inactive'?'active':'inactive')} style={{
              padding:'4px 14px', borderRadius:99, border:'none', fontSize:11, fontWeight:700, fontFamily:FB, cursor:'pointer',
              background:wd.status==='inactive'?'#e5e7eb':GRN, color:wd.status==='inactive'?'#6b7280':W,
            }}>{wd.status==='inactive'?'Inactive':'Active'}</button>
          </div>

          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:8, fontFamily:FH }}>Select Voice</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, maxHeight:340, overflow:'auto' }}>
            {RETELL_VOICES.map(v => (
              <div key={v.id} onClick={()=>setWd('voice_id',v.id)} style={{
                padding:10, borderRadius:10,
                border:`2px solid ${wd.voice_id===v.id?R:'#e5e7eb'}`,
                background:wd.voice_id===v.id?`${R}08`:W,
                cursor:'pointer', transition:'all .15s', position:'relative',
              }}>
                {wd.voice_id===v.id && <div style={{ position:'absolute', top:6, right:6, width:18, height:18, borderRadius:'50%', background:R, display:'flex', alignItems:'center', justifyContent:'center' }}><Check size={10} color={W} /></div>}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                  <span style={{ fontSize:12, fontWeight:700, fontFamily:FH, color:BLK }}>{v.name}</span>
                  <button onClick={e=>{ e.stopPropagation(); previewVoice(v) }} style={{ background:playingVoice===v.id?`${R}20`:`${PURP}15`, border:'none', borderRadius:6, padding:'3px 6px', cursor:'pointer', display:'flex', alignItems:'center' }}>
                    {playingVoice===v.id ? <Square size={9} color={R} /> : <Play size={9} color={PURP} />}
                  </button>
                </div>
                <div style={{ fontSize:9, color:'#888' }}>{v.gender} -- {v.accent}</div>
                <div style={{ fontSize:9, color:T, fontWeight:600 }}>{v.tone}</div>
                <div style={{ display:'inline-block', fontSize:8, color:'#aaa', background:'#f3f4f6', padding:'1px 6px', borderRadius:4, marginTop:3 }}>{v.provider}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
            <Btn onClick={()=>setWizardStep(2)}>Next: Business Context <ChevronRight size={14} /></Btn>
          </div>
        </div>
      )}

      {/* TAB 2: BUSINESS CONTEXT */}
      {wizardStep === 2 && (
        <div>
          <Input label="Business Name" value={wd.business_name} onChange={v=>setWd('business_name',v)} placeholder="e.g. Smith Plumbing Co." />
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4, fontFamily:FH }}>SIC Code / Industry</label>
            <input value={sicSearch} onChange={e=>setSicSearch(e.target.value)} placeholder="Search SIC codes..." style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, boxSizing:'border-box', marginBottom:4 }} />
            {sicSearch && (
              <div style={{ maxHeight:140, overflow:'auto', border:'1px solid #e5e7eb', borderRadius:8, background:W }}>
                {filteredSic.slice(0,12).map(s => (
                  <div key={s.code} onClick={()=>{ setWd('sic_code',s.code); setSicSearch(`${s.code} - ${s.label}`) }} style={{ padding:'5px 12px', fontSize:12, cursor:'pointer', background:wd.sic_code===s.code?`${T}15`:W, borderBottom:'1px solid #f5f5f5' }}>
                    <strong>{s.code}</strong> - {s.label}
                  </div>
                ))}
              </div>
            )}
            {wd.sic_code && !sicSearch && <div style={{ fontSize:12, color:T, fontWeight:600 }}>Selected: {wd.sic_code} - {SIC_CODES.find(s=>s.code===wd.sic_code)?.label}</div>}
          </div>
          <Input label="Business Description" value={wd.description} onChange={v=>setWd('description',v)} textarea placeholder="What does this business do?" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Input label="Main Service" value={wd.service} onChange={v=>setWd('service',v)} placeholder="e.g. Emergency plumbing repair" />
            <Input label="Target Customer" value={wd.target} onChange={v=>setWd('target',v)} placeholder="e.g. Homeowners 35-65" />
          </div>
          <Input label="Key Differentiator" value={wd.differentiator} onChange={v=>setWd('differentiator',v)} placeholder="What makes this business better?" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Input label="Service Area" value={wd.service_area} onChange={v=>setWd('service_area',v)} placeholder="e.g. Greater Denver Metro" />
            <Select label="Average Deal Size" value={wd.deal_size} onChange={v=>setWd('deal_size',v)} options={[
              {value:'',label:'Select...'},{value:'<$500',label:'Under $500'},{value:'$500-2k',label:'$500 - $2,000'},
              {value:'$2k-10k',label:'$2,000 - $10,000'},{value:'$10k-50k',label:'$10,000 - $50,000'},{value:'$50k+',label:'$50,000+'}
            ]} />
          </div>
          <Input label="Notable Results / Proof Points" value={wd.closer_proof} onChange={v=>setWd('closer_proof',v)} textarea placeholder="e.g. Helped 500+ businesses, 340% lead increase, 4.8 stars" />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
            <Btn bg="#e5e7eb" color={BLK} onClick={()=>setWizardStep(1)}>Back</Btn>
            <Btn onClick={()=>setWizardStep(3)}>Next: Human Closer <ChevronRight size={14} /></Btn>
          </div>
        </div>
      )}

      {/* TAB 3: HUMAN CLOSER */}
      {wizardStep === 3 && (
        <div>
          <div style={{ padding:'12px 16px', background:'#f0fdfa', borderRadius:8, marginBottom:16, borderLeft:`3px solid ${T}` }}>
            <div style={{ fontSize:12, fontFamily:FB, color:'#0f766e' }}>The closer is the real person the AI books meetings for. This info helps the agent build credibility on calls.</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Input label="Closer Name" value={wd.closer_name} onChange={v=>setWd('closer_name',v)} placeholder="e.g. Adam Segall" />
            <Input label="Title" value={wd.closer_title} onChange={v=>setWd('closer_title',v)} placeholder="e.g. Senior Marketing Strategist" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Input label="Phone (for live transfer)" value={wd.closer_phone} onChange={v=>setWd('closer_phone',v)} placeholder="+1 555-000-0000" />
            <Input label="Calendar Link" value={wd.closer_calendar} onChange={v=>setWd('closer_calendar',v)} placeholder="https://calendly.com/..." />
          </div>
          <Input label="Bio (2-3 sentences the AI uses to build credibility)" value={wd.closer_bio} onChange={v=>setWd('closer_bio',v)} textarea placeholder="e.g. Adam has 10+ years of marketing experience and has helped over 500 local businesses..." />
          <Input label="Expertise Areas (comma separated)" value={wd.closer_expertise} onChange={v=>setWd('closer_expertise',v)} placeholder="e.g. local SEO, paid ads, restaurant marketing" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Input label="Years of Experience" value={wd.closer_experience} onChange={v=>setWd('closer_experience',v)} placeholder="e.g. 10" />
            <Select label="Meeting Duration" value={wd.meeting_duration||'15'} onChange={v=>setWd('meeting_duration',v)} options={[
              {value:'15',label:'15 minutes'},{value:'20',label:'20 minutes'},{value:'30',label:'30 minutes'},{value:'45',label:'45 minutes'},{value:'60',label:'60 minutes'}
            ]} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
            <Btn bg="#e5e7eb" color={BLK} onClick={()=>setWizardStep(2)}>Back</Btn>
            <Btn onClick={()=>setWizardStep(4)}>Next: AI Scripts <ChevronRight size={14} /></Btn>
          </div>
        </div>
      )}

      {/* TAB 4: AI SCRIPTS */}
      {wizardStep === 4 && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <Btn small bg={`${PURP}15`} color={PURP} onClick={generateAllScripts}>
              <Sparkles size={12} /> Generate All Scripts
            </Btn>
          </div>
          {['intro','questions','value_prop','objections','closing','voicemail','tcpa_consent'].map(section => (
            <div key={section} style={{ marginBottom:14, padding:12, background:'#fafafa', borderRadius:10, border:'1px solid #eee' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#444', fontFamily:FH, textTransform:'capitalize' }}>{section.replace(/_/g,' ')}</label>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <span style={{ fontSize:10, color:'#bbb', fontFamily:FB }}>{((wd.script||{})[section]||'').length} chars</span>
                  <Btn small bg={`${PURP}15`} color={PURP} disabled={generatingSection===section} onClick={()=>generateSection(section)}>
                    {generatingSection===section ? <Loader2 size={11} className="spin" /> : <Sparkles size={11} />}
                  </Btn>
                </div>
              </div>
              <textarea
                value={(section==='questions'||section==='objections') ? (Array.isArray((wd.script||{})[section]) ? (wd.script||{})[section].join('\n') : (wd.script||{})[section]||'') : ((wd.script||{})[section]||'')}
                onChange={e => {
                  const val = e.target.value
                  setScript(section, (section==='questions'||section==='objections') ? val.split('\n') : val)
                }}
                rows={section==='questions'||section==='objections'?4:2}
                placeholder={section==='questions'?'One question per line...':section==='objections'?'One objection handler per line...':section==='tcpa_consent'?'TCPA consent language...': `Enter ${section.replace(/_/g,' ')} script...`}
                style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:12, fontFamily:FB, resize:'vertical', boxSizing:'border-box' }}
              />
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
            <Btn bg="#e5e7eb" color={BLK} onClick={()=>setWizardStep(3)}>Back</Btn>
            <Btn onClick={()=>setWizardStep(5)}>Next: Advanced <ChevronRight size={14} /></Btn>
          </div>
        </div>
      )}

      {/* TAB 5: ADVANCED SETTINGS */}
      {wizardStep === 5 && (
        <div>
          <h3 style={{ fontSize:14, fontWeight:700, fontFamily:FH, color:BLK, margin:'0 0 12px' }}>Call Behavior</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#444', fontFamily:FH, marginBottom:4 }}>Max Duration (min)</label>
              <input type="number" min={1} max={30} value={wd.max_call_duration||5} onChange={e=>setWd('max_call_duration',parseInt(e.target.value)||5)} style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#444', fontFamily:FH, marginBottom:4 }}>Silence Timeout (sec)</label>
              <select value={wd.silence_timeout||10} onChange={e=>setWd('silence_timeout',parseInt(e.target.value))} style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, boxSizing:'border-box', cursor:'pointer' }}>
                <option value={5}>5 seconds</option><option value={10}>10 seconds</option><option value={15}>15 seconds</option><option value={20}>20 seconds</option>
              </select>
            </div>
            <Select label="Interruption Sensitivity" value={wd.interruption_sensitivity||'medium'} onChange={v=>setWd('interruption_sensitivity',v)} options={[
              {value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}
            ]} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
            {[
              { key:'enable_backchannel', label:'Backchanneling', sub:'mm-hmm, I see, right' },
              { key:'amd_enabled', label:'Voicemail Detection', sub:'Detect answering machines' },
              { key:'recording_enabled', label:'Call Recording', sub:'Record all calls' },
            ].map(tog => (
              <div key={tog.key} style={{ padding:'10px 14px', background:'#f9fafb', borderRadius:8, border:'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, fontFamily:FH, color:BLK }}>{tog.label}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FB }}>{tog.sub}</div>
                  </div>
                  <button onClick={()=>setWd(tog.key,!wd[tog.key])} style={{
                    width:40, height:22, borderRadius:99, border:'none', cursor:'pointer', position:'relative',
                    background:wd[tog.key]!==false?GRN:'#d1d5db', transition:'background .2s',
                  }}>
                    <div style={{ width:16, height:16, borderRadius:'50%', background:W, position:'absolute', top:3, left:wd[tog.key]!==false?21:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize:14, fontWeight:700, fontFamily:FH, color:BLK, margin:'0 0 12px' }}>Compliance</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
            {[
              { key:'dnc_check', label:'DNC Check', sub:'Check Do Not Call list' },
              { key:'timezone_enforce', label:'Timezone Rules', sub:'Only call during allowed hours' },
              { key:'tcpa_required', label:'TCPA Consent', sub:'Require consent on calls' },
            ].map(tog => (
              <div key={tog.key} style={{ padding:'10px 14px', background:'#f9fafb', borderRadius:8, border:'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, fontFamily:FH, color:BLK }}>{tog.label}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', fontFamily:FB }}>{tog.sub}</div>
                  </div>
                  <button onClick={()=>setWd(tog.key,!wd[tog.key])} style={{
                    width:40, height:22, borderRadius:99, border:'none', cursor:'pointer', position:'relative',
                    background:wd[tog.key]!==false?GRN:'#d1d5db', transition:'background .2s',
                  }}>
                    <div style={{ width:16, height:16, borderRadius:'50%', background:W, position:'absolute', top:3, left:wd[tog.key]!==false?21:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize:14, fontWeight:700, fontFamily:FH, color:BLK, margin:'0 0 12px' }}>Transfer Settings</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <Input label="Live Transfer Number" value={wd.transfer_phone} onChange={v=>setWd('transfer_phone',v)} placeholder="+1 555-000-0000" />
            <Input label="Transfer Trigger Phrases (comma separated)" value={wd.transfer_phrases} onChange={v=>setWd('transfer_phrases',v)} placeholder="transfer me, speak to someone, manager" />
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', marginTop:20 }}>
            <Btn bg="#e5e7eb" color={BLK} onClick={()=>setWizardStep(4)}>Back</Btn>
            <Btn bg={GRN} onClick={saveAgent}><Check size={14} /> {editAgent ? 'Update Agent' : 'Create Agent'}</Btn>
          </div>
        </div>
      )}
    </Modal>
  )

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  CAMPAIGNS TAB                                                         */
  /* ════════════════════════════════════════════════════════════════════════ */
  const renderCampaigns = () => (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ margin:0, fontFamily:FH, fontSize:18, fontWeight:700, color:BLK }}>Campaigns</h2>
        <Btn onClick={()=>setShowCampaignModal(true)}><Plus size={14} /> New Campaign</Btn>
      </div>
      {campaigns.length===0 && !loading && <Card><p style={{ color:'#888', textAlign:'center', margin:20 }}>No campaigns yet. Create a campaign to start calling.</p></Card>}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {campaigns.map(c => {
          const sc = statusColor(c.status||'draft')
          const total = c.total_leads||0
          const called = c.called||0
          const pct = total>0 ? Math.round((called/total)*100) : 0
          const ag = agents.find(a=>a.id===c.agent_id)
          return (
            <Card key={c.id}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, fontFamily:FH, color:BLK }}>{c.name}</div>
                  <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Agent: {ag?.name || 'Unknown'} {c.is_test_mode && <Badge label="TEST" color={AMB} bg={`${AMB}20`} />}</div>
                </div>
                <Badge label={c.status||'draft'} color={sc.c} bg={sc.bg} />
              </div>
              {/* Stats row */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                <StatPill label="total" value={total} color="#6b7280" />
                <StatPill label="called" value={called} color={T} />
                <StatPill label="answered" value={c.answered||0} color={GRN} />
                <StatPill label="appointments" value={c.appointments||0} color={PURP} />
                <StatPill label="callbacks" value={c.callbacks||0} color={AMB} />
              </div>
              {/* Progress bar */}
              <div style={{ background:'#e5e7eb', borderRadius:999, height:8, marginBottom:12, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${T},${GRN})`, borderRadius:999, transition:'width .3s' }} />
              </div>
              <div style={{ fontSize:11, color:'#888', marginBottom:12 }}>{pct}% complete - {called}/{total} called</div>
              {/* Action buttons */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {(c.status==='draft'||c.status==='paused') && <Btn small bg={GRN} onClick={()=>campaignAction(c.id,'start')}><Play size={12} /> Start</Btn>}
                {c.status==='running' && <Btn small bg={AMB} onClick={()=>campaignAction(c.id,'pause')}><Pause size={12} /> Pause</Btn>}
                {(c.status==='running'||c.status==='paused') && <Btn small bg={R} onClick={()=>campaignAction(c.id,'stop')}><Square size={12} /> Stop</Btn>}
                <Btn small bg={c.is_test_mode?`${AMB}20`:'#e5e7eb'} color={c.is_test_mode?AMB:BLK} onClick={()=>campaignAction(c.id,'toggle_test')}>
                  <AlertTriangle size={12} /> {c.is_test_mode?'Test ON':'Test OFF'}
                </Btn>
                <Btn small bg="#fee2e2" color={R} onClick={()=>{ if(confirm('Delete campaign?')) campaignAction(c.id,'delete') }}><Trash2 size={12} /></Btn>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )

  const renderCampaignModal = () => (
    <Modal title="New Campaign" onClose={()=>setShowCampaignModal(false)}>
      <Input label="Campaign Name" value={campaignForm.name} onChange={v=>setCampaignForm(p=>({...p,name:v}))} placeholder="e.g. HVAC Spring Push" />
      <Select label="Agent" value={campaignForm.agent_id} onChange={v=>setCampaignForm(p=>({...p,agent_id:v}))} placeholder="Select an agent..." options={agents.map(a=>({value:a.id,label:a.name||'Unnamed'}))} />
      <div style={{ marginBottom:12 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4, fontFamily:FH }}>Import Leads (CSV)</label>
        <input ref={fileRef} type="file" accept=".csv" onChange={e=>setCampaignLeadFile(e.target.files[0])} style={{ fontSize:12 }} />
      </div>
      <div style={{ marginBottom:16 }}>
        <Btn small bg={`${T}15`} color={T} onClick={useScoutLeads}><Zap size={12} /> Use Scout Leads</Btn>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <input type="checkbox" checked={campaignForm.is_test_mode} onChange={e=>setCampaignForm(p=>({...p,is_test_mode:e.target.checked}))} id="test-mode" />
        <label htmlFor="test-mode" style={{ fontSize:12, fontWeight:600, color:'#666', fontFamily:FH }}>Test Mode (calls only your number)</label>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <Btn bg="#e5e7eb" color={BLK} onClick={()=>setShowCampaignModal(false)}>Cancel</Btn>
        <Btn onClick={createCampaign}><Check size={14} /> Create Campaign</Btn>
      </div>
    </Modal>
  )

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  LEADS TAB                                                             */
  /* ════════════════════════════════════════════════════════════════════════ */
  const renderLeads = () => (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <h2 style={{ margin:0, fontFamily:FH, fontSize:18, fontWeight:700, color:BLK }}>Leads</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Select value={campaignFilter} onChange={setCampaignFilter} placeholder="All Campaigns" options={campaigns.map(c=>({value:c.id,label:c.name}))} style={{ marginBottom:0, minWidth:180 }} />
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:10, color:'#aaa' }} />
            <input value={leadSearch} onChange={e=>setLeadSearch(e.target.value)} placeholder="Search leads..." style={{ padding:'8px 12px 8px 30px', border:'1px solid #ddd', borderRadius:8, fontSize:13, fontFamily:FB, width:200 }} />
          </div>
          <input ref={csvRef} type="file" accept=".csv" style={{ display:'none' }} onChange={e=>{ if(e.target.files[0] && campaignFilter) importCSV(e.target.files[0], campaignFilter) }} />
          <Btn small bg={`${T}15`} color={T} onClick={()=>{ if(!campaignFilter){ toast.error('Select a campaign first'); return }; csvRef.current?.click() }}><Upload size={12} /> Import CSV</Btn>
        </div>
      </div>
      <Card style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FB }}>
            <thead>
              <tr style={{ background:'#fafafa', borderBottom:'1px solid #e5e7eb' }}>
                {['Name','Phone','Business','SIC','Status','Duration','Sentiment','Score'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:.5, fontFamily:FH }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length===0 && <tr><td colSpan={8} style={{ padding:24, textAlign:'center', color:'#aaa' }}>No leads found</td></tr>}
              {filteredLeads.map(l => {
                const sc = statusColor(l.status||'pending')
                return (
                  <tr key={l.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:BLK }}>{l.name||'-'}</td>
                    <td style={{ padding:'10px 14px', color:'#555' }}>{l.phone||'-'}</td>
                    <td style={{ padding:'10px 14px', color:'#555' }}>{l.business||'-'}</td>
                    <td style={{ padding:'10px 14px', color:'#555', fontSize:11 }}>{l.sic_code||'-'}</td>
                    <td style={{ padding:'10px 14px' }}><Badge label={l.status||'pending'} color={sc.c} bg={sc.bg} /></td>
                    <td style={{ padding:'10px 14px', color:'#555' }}>{l.duration ? `${l.duration}s` : '-'}</td>
                    <td style={{ padding:'10px 14px' }}>{l.sentiment ? <span style={{ color:l.sentiment==='positive'?GRN:l.sentiment==='negative'?R:AMB, fontWeight:600, fontSize:12 }}>{l.sentiment}</span> : '-'}</td>
                    <td style={{ padding:'10px 14px', fontWeight:700, color:PURP }}>{l.score ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  CALL HISTORY TAB                                                      */
  /* ════════════════════════════════════════════════════════════════════════ */
  const renderCallHistory = () => (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <h2 style={{ margin:0, fontFamily:FH, fontSize:18, fontWeight:700, color:BLK }}>Call History</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Select value={callFilter.campaign} onChange={v=>setCallFilter(p=>({...p,campaign:v}))} placeholder="All Campaigns" options={campaigns.map(c=>({value:c.id,label:c.name}))} style={{ marginBottom:0, minWidth:160 }} />
          <Select value={callFilter.outcome} onChange={v=>setCallFilter(p=>({...p,outcome:v}))} placeholder="All Outcomes" options={[
            {value:'answered',label:'Answered'},{value:'no_answer',label:'No Answer'},{value:'voicemail',label:'Voicemail'},
            {value:'appointment_set',label:'Appointment Set'},{value:'callback',label:'Callback'},{value:'failed',label:'Failed'}
          ]} style={{ marginBottom:0, minWidth:140 }} />
          <Select value={callFilter.sentiment} onChange={v=>setCallFilter(p=>({...p,sentiment:v}))} placeholder="All Sentiments" options={[
            {value:'positive',label:'Positive'},{value:'neutral',label:'Neutral'},{value:'negative',label:'Negative'}
          ]} style={{ marginBottom:0, minWidth:130 }} />
        </div>
      </div>
      <Card style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FB }}>
            <thead>
              <tr style={{ background:'#fafafa', borderBottom:'1px solid #e5e7eb' }}>
                {['','Name','Phone','Duration','Outcome','Sentiment','Appointment','TCPA','Discovery'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:.5, fontFamily:FH }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCalls.length===0 && <tr><td colSpan={9} style={{ padding:24, textAlign:'center', color:'#aaa' }}>No calls found</td></tr>}
              {filteredCalls.map(c => {
                const sc = statusColor(c.outcome||'pending')
                const expanded = callExpanded===c.id
                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ borderBottom:'1px solid #f5f5f5', cursor:'pointer', background:expanded?`${T}08`:W }} onClick={()=>setCallExpanded(expanded?null:c.id)}>
                      <td style={{ padding:'10px 14px', width:30 }}>{expanded ? <ChevronDown size={14} color="#aaa" /> : <ChevronRight size={14} color="#aaa" />}</td>
                      <td style={{ padding:'10px 14px', fontWeight:600, color:BLK }}>{c.lead_name||'-'}</td>
                      <td style={{ padding:'10px 14px', color:'#555' }}>{c.phone||'-'}</td>
                      <td style={{ padding:'10px 14px', color:'#555' }}>{c.duration ? `${Math.floor(c.duration/60)}:${String(c.duration%60).padStart(2,'0')}` : '-'}</td>
                      <td style={{ padding:'10px 14px' }}><Badge label={c.outcome||'pending'} color={sc.c} bg={sc.bg} /></td>
                      <td style={{ padding:'10px 14px' }}>{c.sentiment ? <span style={{ color:c.sentiment==='positive'?GRN:c.sentiment==='negative'?R:AMB, fontWeight:600, fontSize:12 }}>{c.sentiment}</span> : '-'}</td>
                      <td style={{ padding:'10px 14px' }}>{c.appointment_set ? <Check size={14} color={GRN} /> : <X size={14} color="#ddd" />}</td>
                      <td style={{ padding:'10px 14px' }}>{c.tcpa_consent ? <Shield size={14} color={GRN} /> : <Shield size={14} color="#ddd" />}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <button
                          onClick={async (ev) => {
                            ev.stopPropagation()
                            toast.loading('Creating discovery...', { id: 'disc' })
                            try {
                              const res = await fetch('/api/discovery', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'create_from_voice',
                                  call_id: c.id,
                                  lead_id: c.lead_id || null,
                                  agency_id: aid,
                                }),
                              }).then(r => r.json())
                              if (res?.data?.engagement_id) {
                                toast.success('Discovery created', { id: 'disc' })
                                navigate('/discovery')
                              } else {
                                toast.error(res?.error || 'Failed to create discovery', { id: 'disc' })
                              }
                            } catch {
                              toast.error('Request failed', { id: 'disc' })
                            }
                          }}
                          title="Start Discovery from this call"
                          style={{
                            background: 'none', border: `1px solid ${T}40`, borderRadius: 6,
                            padding: '5px 8px', cursor: 'pointer', color: T,
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
                          }}
                        >
                          <Brain size={12} /> Start
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={9} style={{ padding:0 }}>
                          <div style={{ padding:20, background:'#fafafa', borderBottom:'2px solid #e5e7eb' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                              {/* Transcript */}
                              <div>
                                <h4 style={{ margin:'0 0 8px', fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}><FileText size={14} style={{ marginRight:4 }} />Transcript</h4>
                                <div style={{ background:W, borderRadius:8, padding:12, maxHeight:200, overflow:'auto', fontSize:12, lineHeight:1.6, border:'1px solid #eee', whiteSpace:'pre-wrap' }}>
                                  {c.transcript || 'No transcript available'}
                                </div>
                              </div>
                              {/* AI Summary */}
                              <div>
                                <h4 style={{ margin:'0 0 8px', fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}><Brain size={14} style={{ marginRight:4 }} />AI Summary</h4>
                                <div style={{ background:W, borderRadius:8, padding:12, fontSize:12, lineHeight:1.6, border:'1px solid #eee', marginBottom:12 }}>
                                  {c.ai_summary || 'No summary available'}
                                </div>
                                <h4 style={{ margin:'0 0 8px', fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}><Star size={14} style={{ marginRight:4 }} />Key Moments</h4>
                                <div style={{ background:W, borderRadius:8, padding:12, fontSize:12, border:'1px solid #eee' }}>
                                  {c.key_moments ? (Array.isArray(c.key_moments) ? c.key_moments.map((m,i)=><div key={i} style={{ marginBottom:4 }}>- {m}</div>) : c.key_moments) : 'None identified'}
                                </div>
                              </div>
                            </div>
                            {/* Audio player */}
                            {c.recording_url && (
                              <div style={{ marginTop:12 }}>
                                <h4 style={{ margin:'0 0 8px', fontFamily:FH, fontSize:13, fontWeight:700, color:BLK }}><Volume2 size={14} style={{ marginRight:4 }} />Recording</h4>
                                <audio controls src={c.recording_url} style={{ width:'100%' }} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  ANALYTICS TAB                                                         */
  /* ════════════════════════════════════════════════════════════════════════ */
  const renderAnalytics = () => {
    const a = analytics || {}
    const hourlyData = a.hourly_connection || Array(24).fill(0)
    const dailyData = a.daily_appointments || Array(7).fill(0)
    const maxH = Math.max(...hourlyData, 1)
    const maxD = Math.max(...dailyData, 1)
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    const funnel = a.funnel || { called:0, answered:0, engaged:0, qualified:0, appointment:0 }
    const funnelMax = Math.max(funnel.called, 1)
    const industryData = a.industry_breakdown || []
    const insights = a.insights || {}

    return (
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ margin:0, fontFamily:FH, fontSize:18, fontWeight:700, color:BLK }}>Call Intelligence</h2>
          <Btn small bg={`${T}15`} color={T} onClick={loadAnalytics}><RefreshCw size={12} /> Refresh</Btn>
        </div>

        {/* Stat cards */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
          <StatCard icon={Phone} label="Total Calls" value={a.total_calls||0} color={T} />
          <StatCard icon={PhoneCall} label="Connection Rate" value={`${a.connection_rate||0}%`} color={GRN} />
          <StatCard icon={Target} label="Appointment Rate" value={`${a.appointment_rate||0}%`} color={PURP} />
          <StatCard icon={Clock} label="Avg Duration" value={a.avg_duration ? `${Math.floor(a.avg_duration/60)}:${String(Math.round(a.avg_duration%60)).padStart(2,'0')}` : '0:00'} color={AMB} />
          <StatCard icon={Zap} label="Best Call Time" value={a.best_call_time||'N/A'} color={R} />
          <StatCard icon={TrendingUp} label="Avg Sentiment" value={a.avg_sentiment?.toFixed(1)||'N/A'} color={GRN} sub="out of 10" />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
          {/* Hourly connection rate chart */}
          <Card>
            <h3 style={{ margin:'0 0 12px', fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>Connection Rate by Hour</h3>
            <svg viewBox="0 0 480 160" style={{ width:'100%' }}>
              {hourlyData.map((v,i) => {
                const barH = (v/maxH)*120
                return (
                  <g key={i}>
                    <rect x={i*20+2} y={140-barH} width={16} height={barH} rx={3} fill={v===Math.max(...hourlyData)?GRN:T} opacity={0.85} />
                    <text x={i*20+10} y={155} textAnchor="middle" fontSize="7" fill="#888">{i}</text>
                  </g>
                )
              })}
              <line x1="0" y1="140" x2="480" y2="140" stroke="#e5e7eb" strokeWidth="1" />
            </svg>
          </Card>

          {/* Daily appointment rate chart */}
          <Card>
            <h3 style={{ margin:'0 0 12px', fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>Appointments by Day</h3>
            <svg viewBox="0 0 280 160" style={{ width:'100%' }}>
              {dailyData.map((v,i) => {
                const barH = (v/maxD)*120
                return (
                  <g key={i}>
                    <rect x={i*40+4} y={140-barH} width={32} height={barH} rx={4} fill={v===Math.max(...dailyData)?PURP:T} opacity={0.85} />
                    <text x={i*40+20} y={155} textAnchor="middle" fontSize="9" fill="#888">{days[i]}</text>
                    <text x={i*40+20} y={135-barH} textAnchor="middle" fontSize="8" fill="#666" fontWeight="600">{v}</text>
                  </g>
                )
              })}
              <line x1="0" y1="140" x2="280" y2="140" stroke="#e5e7eb" strokeWidth="1" />
            </svg>
          </Card>
        </div>

        {/* Outcome funnel */}
        <Card style={{ marginBottom:20 }}>
          <h3 style={{ margin:'0 0 16px', fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>Outcome Funnel</h3>
          {['called','answered','engaged','qualified','appointment'].map((stage,i) => {
            const val = funnel[stage]||0
            const pct = funnelMax>0 ? (val/funnelMax)*100 : 0
            const colors = [T,GRN,AMB,PURP,R]
            return (
              <div key={stage} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                <span style={{ width:90, fontSize:12, fontWeight:600, color:'#555', textTransform:'capitalize', fontFamily:FH }}>{stage}</span>
                <div style={{ flex:1, background:'#f0f0f0', borderRadius:999, height:24, overflow:'hidden', position:'relative' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:colors[i], borderRadius:999, transition:'width .5s', minWidth:pct>0?40:0, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:W }}>{val}</span>
                  </div>
                </div>
                <span style={{ fontSize:11, color:'#888', width:45, textAlign:'right' }}>{pct.toFixed(0)}%</span>
              </div>
            )
          })}
        </Card>

        {/* Industry breakdown */}
        {industryData.length > 0 && (
          <Card style={{ marginBottom:20 }}>
            <h3 style={{ margin:'0 0 12px', fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>Industry Breakdown</h3>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:FB }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #e5e7eb' }}>
                    {['SIC','Industry','Calls','Connection %','Appointment %','Avg Duration','Sentiment'].map(h=>(
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', fontFamily:FH }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {industryData.map((row,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #f5f5f5' }}>
                      <td style={{ padding:'8px 12px', fontWeight:600 }}>{row.sic_code}</td>
                      <td style={{ padding:'8px 12px' }}>{SIC_CODES.find(s=>s.code===row.sic_code)?.label||row.sic_code}</td>
                      <td style={{ padding:'8px 12px' }}>{row.calls}</td>
                      <td style={{ padding:'8px 12px', color:GRN, fontWeight:600 }}>{row.connection_pct}%</td>
                      <td style={{ padding:'8px 12px', color:PURP, fontWeight:600 }}>{row.appointment_pct}%</td>
                      <td style={{ padding:'8px 12px' }}>{row.avg_duration}s</td>
                      <td style={{ padding:'8px 12px' }}>{row.sentiment?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* AI Insights */}
        <Card>
          <h3 style={{ margin:'0 0 16px', fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}><Brain size={16} style={{ marginRight:6 }} />AI Insights</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:GRN, marginBottom:8, fontFamily:FH, display:'flex', alignItems:'center', gap:4 }}><TrendingUp size={14} /> What's Working</div>
              {(insights.working || ['No data yet']).map((item,i) => (
                <div key={i} style={{ fontSize:12, color:'#555', marginBottom:6, paddingLeft:12, borderLeft:`2px solid ${GRN}`, lineHeight:1.5 }}>{item}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:R, marginBottom:8, fontFamily:FH, display:'flex', alignItems:'center', gap:4 }}><AlertTriangle size={14} /> What's Failing</div>
              {(insights.failing || ['No data yet']).map((item,i) => (
                <div key={i} style={{ fontSize:12, color:'#555', marginBottom:6, paddingLeft:12, borderLeft:`2px solid ${R}`, lineHeight:1.5 }}>{item}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:PURP, marginBottom:8, fontFamily:FH, display:'flex', alignItems:'center', gap:4 }}><Sparkles size={14} /> Recommendations</div>
              {(insights.recommendations || ['No data yet']).map((item,i) => (
                <div key={i} style={{ fontSize:12, color:'#555', marginBottom:6, paddingLeft:12, borderLeft:`2px solid ${PURP}`, lineHeight:1.5 }}>{item}</div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  TCPA TAB                                                              */
  /* ════════════════════════════════════════════════════════════════════════ */
  const renderTcpa = () => {
    const totalRecords = tcpaData.length
    const withConsent = tcpaData.filter(r=>r.consent_phone).length
    const complianceScore = totalRecords > 0 ? Math.round((withConsent/totalRecords)*100) : 100
    const optedOut = tcpaData.filter(r=>r.opted_out).length
    const dncFlagged = tcpaData.filter(r=>r.dnc_flagged).length
    const redFlags = tcpaData.filter(r=>r.dnc_flagged || (!r.consent_phone && r.called))

    return (
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ margin:0, fontFamily:FH, fontSize:18, fontWeight:700, color:BLK }}><Shield size={20} style={{ marginRight:6 }} />TCPA Compliance</h2>
          <div style={{ display:'flex', gap:8 }}>
            <Btn small bg={`${T}15`} color={T} onClick={loadTcpa}><RefreshCw size={12} /> Refresh</Btn>
            <Btn small bg={`${GRN}15`} color={GRN} onClick={exportTcpaCsv}><Download size={12} /> Export CSV</Btn>
          </div>
        </div>

        {/* Compliance stats */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
          <StatCard icon={Shield} label="Compliance Score" value={`${complianceScore}%`} color={complianceScore>=80?GRN:complianceScore>=60?AMB:R} />
          <StatCard icon={Check} label="With Consent" value={withConsent} color={GRN} />
          <StatCard icon={PhoneOff} label="Opted Out" value={optedOut} color={AMB} />
          <StatCard icon={AlertTriangle} label="DNC Flagged" value={dncFlagged} color={R} />
        </div>

        {/* Red flags panel */}
        {redFlags.length > 0 && (
          <Card style={{ marginBottom:16, borderColor:`${R}40`, background:`${R}05` }}>
            <h3 style={{ margin:'0 0 8px', fontFamily:FH, fontSize:14, fontWeight:700, color:R }}><AlertTriangle size={16} style={{ marginRight:6 }} />Red Flags ({redFlags.length})</h3>
            {redFlags.slice(0,5).map((r,i) => (
              <div key={i} style={{ fontSize:12, color:'#666', marginBottom:4, paddingLeft:12, borderLeft:`2px solid ${R}` }}>
                {r.phone} - {r.dnc_flagged ? 'On DNC list' : 'Missing consent'} {r.called ? '(Already called!)' : ''}
              </div>
            ))}
            {redFlags.length>5 && <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>...and {redFlags.length-5} more</div>}
          </Card>
        )}

        {/* Consent tracking table */}
        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:FB }}>
              <thead>
                <tr style={{ background:'#fafafa', borderBottom:'1px solid #e5e7eb' }}>
                  {['Phone','Phone Consent','SMS Consent','Email Consent','Method','DNC','Timestamp','Actions'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:.5, fontFamily:FH }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tcpaData.length===0 && <tr><td colSpan={8} style={{ padding:24, textAlign:'center', color:'#aaa' }}>No TCPA records</td></tr>}
                {tcpaData.map((r,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f5f5f5', background:r.dnc_flagged?`${R}05`:W }}>
                    <td style={{ padding:'10px 14px', fontWeight:600 }}>{r.phone}</td>
                    <td style={{ padding:'10px 14px' }}>{r.consent_phone ? <Check size={14} color={GRN} /> : <X size={14} color={R} />}</td>
                    <td style={{ padding:'10px 14px' }}>{r.consent_sms ? <Check size={14} color={GRN} /> : <X size={14} color={R} />}</td>
                    <td style={{ padding:'10px 14px' }}>{r.consent_email ? <Check size={14} color={GRN} /> : <X size={14} color={R} />}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#666' }}>{r.method||'-'}</td>
                    <td style={{ padding:'10px 14px' }}>{r.dnc_flagged ? <Badge label="DNC" color={W} bg={R} /> : <Badge label="Clear" color={GRN} bg={`${GRN}15`} />}</td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:'#888' }}>{r.timestamp ? new Date(r.timestamp).toLocaleString() : '-'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <Btn small bg="#fee2e2" color={R} onClick={async ()=>{
                        await api({ action:'opt_out', agency_id:aid, phone:r.phone })
                        toast.success('Opted out')
                        loadTcpa()
                      }}><PhoneOff size={10} /> Opt Out</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    )
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  CALENDAR TAB                                                          */
  /* ════════════════════════════════════════════════════════════════════════ */
  const [availGrid, setAvailGrid] = useState({
    Mon:{ enabled:true, start:'09:00', end:'17:00' },
    Tue:{ enabled:true, start:'09:00', end:'17:00' },
    Wed:{ enabled:true, start:'09:00', end:'17:00' },
    Thu:{ enabled:true, start:'09:00', end:'17:00' },
    Fri:{ enabled:true, start:'09:00', end:'17:00' },
    Sat:{ enabled:false, start:'10:00', end:'14:00' },
    Sun:{ enabled:false, start:'10:00', end:'14:00' },
  })

  useEffect(() => {
    if (availability && Object.keys(availability).length > 0) setAvailGrid(availability)
  }, [availability])

  const renderCalendar = () => (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ margin:0, fontFamily:FH, fontSize:18, fontWeight:700, color:BLK }}><Calendar size={20} style={{ marginRight:6 }} />Calendar & Scheduling</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Select value={calendarTimezone} onChange={setCalendarTimezone} options={[
            {value:'America/New_York',label:'Eastern'},{value:'America/Chicago',label:'Central'},
            {value:'America/Denver',label:'Mountain'},{value:'America/Los_Angeles',label:'Pacific'},
            {value:'America/Phoenix',label:'Arizona'},{value:'America/Anchorage',label:'Alaska'},
            {value:'Pacific/Honolulu',label:'Hawaii'},
          ]} style={{ marginBottom:0, minWidth:140 }} />
          <Btn small bg={`${PURP}15`} color={PURP} onClick={()=>toast.success('Google Calendar integration coming soon')}><ExternalLink size={12} /> Connect Google Calendar</Btn>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Availability grid */}
        <Card>
          <h3 style={{ margin:'0 0 16px', fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>Availability</h3>
          {Object.entries(availGrid).map(([day, cfg]) => (
            <div key={day} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10, padding:'8px 0', borderBottom:'1px solid #f5f5f5' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, width:80 }}>
                <input type="checkbox" checked={cfg.enabled} onChange={e=>setAvailGrid(p=>({...p,[day]:{...p[day],enabled:e.target.checked}}))} />
                <span style={{ fontSize:13, fontWeight:600, color:cfg.enabled?BLK:'#aaa', fontFamily:FH }}>{day}</span>
              </div>
              <input type="time" value={cfg.start} onChange={e=>setAvailGrid(p=>({...p,[day]:{...p[day],start:e.target.value}}))} disabled={!cfg.enabled} style={{ padding:'4px 8px', border:'1px solid #ddd', borderRadius:6, fontSize:12, fontFamily:FB, opacity:cfg.enabled?1:0.4 }} />
              <span style={{ color:'#aaa', fontSize:12 }}>to</span>
              <input type="time" value={cfg.end} onChange={e=>setAvailGrid(p=>({...p,[day]:{...p[day],end:e.target.value}}))} disabled={!cfg.enabled} style={{ padding:'4px 8px', border:'1px solid #ddd', borderRadius:6, fontSize:12, fontFamily:FB, opacity:cfg.enabled?1:0.4 }} />
            </div>
          ))}
          <Btn onClick={()=>saveAvailability(availGrid)} style={{ marginTop:12 }} bg={GRN}><Check size={14} /> Save Availability</Btn>
        </Card>

        {/* Upcoming appointments */}
        <Card>
          <h3 style={{ margin:'0 0 16px', fontFamily:FH, fontSize:14, fontWeight:700, color:BLK }}>Upcoming Appointments</h3>
          {appointments.length === 0 && <p style={{ color:'#aaa', fontSize:13, textAlign:'center', margin:20 }}>No upcoming appointments</p>}
          {appointments.map((apt,i) => (
            <div key={i} style={{ padding:12, background:'#fafafa', borderRadius:10, marginBottom:8, border:'1px solid #eee' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:BLK, fontFamily:FH }}>{apt.lead_name || 'Unknown'}</div>
                  <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{apt.phone}</div>
                  {apt.business && <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{apt.business}</div>}
                </div>
                <Badge label={apt.status||'scheduled'} color={statusColor(apt.status||'active').c} bg={statusColor(apt.status||'active').bg} />
              </div>
              <div style={{ display:'flex', gap:8, marginTop:8, fontSize:12, color:'#666' }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><Calendar size={12} />{apt.date ? new Date(apt.date).toLocaleDateString() : '-'}</span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><Clock size={12} />{apt.time || '-'}</span>
                {apt.agent_name && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Users size={12} />{apt.agent_name}</span>}
              </div>
              {apt.notes && <div style={{ fontSize:12, color:'#888', marginTop:6, fontStyle:'italic' }}>{apt.notes}</div>}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  TRAINING DATA TAB                                                     */
  /* ════════════════════════════════════════════════════════════════════════ */
  const [syntheticStatus, setSyntheticStatus] = useState(null)
  const [generatingIndustry, setGeneratingIndustry] = useState(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [genLog, setGenLog] = useState([])
  const [selectedIndustry, setSelectedIndustry] = useState('1711')

  const SYNTHETIC_INDUSTRIES = [
    { sic:'1711', name:'Plumbing' }, { sic:'1731', name:'Electrical' }, { sic:'1521', name:'General Contractor' },
    { sic:'1761', name:'Roofing' }, { sic:'7389', name:'Marketing Services' }, { sic:'8011', name:'Medical Office' },
    { sic:'8021', name:'Dental' }, { sic:'8049', name:'Chiropractic' }, { sic:'5812', name:'Restaurant' },
    { sic:'7532', name:'Auto Body' }, { sic:'8721', name:'Accounting' }, { sic:'6411', name:'Insurance' },
    { sic:'6159', name:'Mortgage' }, { sic:'7231', name:'Beauty Salon' }, { sic:'8742', name:'Consulting' },
  ]

  useEffect(() => {
    if (tab === 'training') {
      fetch('/api/synthetic?action=get_status').then(r => r.json()).then(r => setSyntheticStatus(r.data)).catch(() => {})
    }
  }, [tab])

  async function generateForIndustry() {
    const ind = SYNTHETIC_INDUSTRIES.find(i => i.sic === selectedIndustry)
    if (!ind) return
    setGeneratingIndustry(ind.name)
    setGenLog(l => [...l, `Starting generation for ${ind.name}...`])
    try {
      const res = await fetch('/api/synthetic', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate_industry', sic_code:ind.sic, industry_name:ind.name })
      })
      const data = await res.json()
      if (data.success) {
        setGenLog(l => [...l, `${ind.name}: ${data.data.saved}/${data.data.generated} saved, ${data.data.errors} errors`])
        toast.success(`Generated ${data.data.saved} calls for ${ind.name}`)
      } else {
        setGenLog(l => [...l, `Error: ${data.error}`])
        toast.error(data.error || 'Generation failed')
      }
    } catch (e) {
      setGenLog(l => [...l, `Error: ${e.message}`])
      toast.error('Generation failed')
    }
    setGeneratingIndustry(null)
    fetch('/api/synthetic?action=get_status').then(r => r.json()).then(r => setSyntheticStatus(r.data)).catch(() => {})
  }

  async function generateAllIndustries() {
    setGeneratingAll(true)
    setGenLog(l => [...l, 'Starting generation for ALL 15 industries...'])
    try {
      const res = await fetch('/api/synthetic', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate_all' })
      })
      const data = await res.json()
      if (data.success) {
        for (const r of data.data.results || []) {
          setGenLog(l => [...l, `${r.industry}: ${r.saved}/${r.generated} saved, ${r.errors} errors`])
        }
        toast.success('All industries generated')
      } else {
        setGenLog(l => [...l, `Error: ${data.error}`])
        toast.error(data.error || 'Generation failed')
      }
    } catch (e) {
      setGenLog(l => [...l, `Error: ${e.message}`])
    }
    setGeneratingAll(false)
    fetch('/api/synthetic?action=get_status').then(r => r.json()).then(r => setSyntheticStatus(r.data)).catch(() => {})
  }

  async function clearSynthetic() {
    if (!confirm('Delete ALL synthetic training data? This cannot be undone.')) return
    const res = await fetch('/api/synthetic', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'clear_synthetic' })
    })
    const data = await res.json()
    if (data.success) { toast.success('Synthetic data cleared'); setSyntheticStatus(null) }
    else toast.error(data.error || 'Failed')
    fetch('/api/synthetic?action=get_status').then(r => r.json()).then(r => setSyntheticStatus(r.data)).catch(() => {})
  }

  const renderTrainingData = () => (
    <div>
      {/* Warning banner */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, background:'#fef3c7', marginBottom:20, border:'1px solid #fbbf24' }}>
        <AlertTriangle size={18} color={AMB} />
        <span style={{ fontSize:13, fontFamily:FB, color:'#92400e' }}>
          Synthetic calls are labeled <strong>[SYNTHETIC]</strong> and excluded from client-facing reports. They are only used for AI training.
        </span>
      </div>

      <Card title="Synthetic Call Generator" sub="Seed your AI with realistic training calls before going live">
        {/* Stats row */}
        <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:130, padding:'14px 16px', background:'#f9fafb', borderRadius:10, borderTop:`3px solid ${T}` }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', fontFamily:FB, textTransform:'uppercase' }}>Synthetic Calls</div>
            <div style={{ fontSize:22, fontWeight:800, fontFamily:FH, color:BLK }}>{syntheticStatus?.total_synthetic || 0}</div>
          </div>
          <div style={{ flex:1, minWidth:130, padding:'14px 16px', background:'#f9fafb', borderRadius:10, borderTop:`3px solid ${GRN}` }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', fontFamily:FB, textTransform:'uppercase' }}>Real Calls</div>
            <div style={{ fontSize:22, fontWeight:800, fontFamily:FH, color:BLK }}>{syntheticStatus?.total_real || 0}</div>
          </div>
          <div style={{ flex:1, minWidth:130, padding:'14px 16px', background:'#f9fafb', borderRadius:10, borderTop:`3px solid ${PURP}` }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', fontFamily:FB, textTransform:'uppercase' }}>Total Combined</div>
            <div style={{ fontSize:22, fontWeight:800, fontFamily:FH, color:BLK }}>{(syntheticStatus?.total_synthetic || 0) + (syntheticStatus?.total_real || 0)}</div>
          </div>
        </div>

        {/* Industry status grid */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, fontFamily:FB, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Industry Status</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
            {SYNTHETIC_INDUSTRIES.map(ind => {
              const data = syntheticStatus?.by_industry?.[ind.sic]
              const count = data?.synthetic || 0
              const bg = count >= 10 ? '#dcfce7' : count > 0 ? '#fef3c7' : '#f3f4f6'
              const color = count >= 10 ? GRN : count > 0 ? AMB : '#9ca3af'
              return (
                <div key={ind.sic} style={{ padding:'10px 14px', borderRadius:8, background:bg, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, fontWeight:600, fontFamily:FH, color:BLK }}>{ind.name}</span>
                  <span style={{ fontSize:12, fontWeight:700, fontFamily:FH, color }}>{count} calls</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Generate controls */}
        <div style={{ padding:'20px', background:'#f9fafb', borderRadius:12, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
            <select value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)} style={{
              padding:'8px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:13, fontFamily:FB, flex:1, cursor:'pointer'
            }}>
              {SYNTHETIC_INDUSTRIES.map(i => <option key={i.sic} value={i.sic}>{i.name} ({i.sic})</option>)}
            </select>
            <Btn small bg={R} color={W} onClick={generateForIndustry} disabled={!!generatingIndustry || generatingAll}>
              {generatingIndustry ? <><Loader2 size={12} className="spin" /> Generating...</> : <><Zap size={12} /> Generate 16 Calls</>}
            </Btn>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn small bg={BLK} color={W} onClick={generateAllIndustries} disabled={!!generatingIndustry || generatingAll}>
              {generatingAll ? <><Loader2 size={12} className="spin" /> Generating All...</> : <><Sparkles size={12} /> Generate All Industries (~240 calls)</>}
            </Btn>
            <Btn small bg='#fef2f2' color={R} onClick={clearSynthetic} disabled={!!generatingIndustry || generatingAll}>
              <Trash2 size={12} /> Clear All Synthetic
            </Btn>
          </div>
        </div>

        {/* Generation log */}
        {genLog.length > 0 && (
          <div style={{ background: '#F5F5F5', borderRadius:10, padding:'14px 16px', maxHeight:200, overflow:'auto' }}>
            <div style={{ fontSize:11, fontWeight:700, fontFamily:FB, color: '#999999', marginBottom:8, textTransform:'uppercase', letterSpacing:'.08em' }}>Generation Log</div>
            {genLog.map((line, i) => (
              <div key={i} style={{ fontSize:12, fontFamily:'monospace', color:line.startsWith('Error') ? '#f87171' : '#a3e635', lineHeight:1.6 }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Provider info */}
      <div style={{ display:'flex', gap:12, marginTop:16 }}>
        {[
          { name:'Claude', color:'#d97706', desc:'Anthropic Sonnet 4.5' },
          { name:'GPT-4o', color:GRN, desc:'OpenAI' },
          { name:'Gemini', color:'#3b82f6', desc:'Google (fallback to Claude)' },
        ].map(p => (
          <div key={p.name} style={{ flex:1, padding:'12px 16px', background:W, borderRadius:10, borderLeft:`3px solid ${p.color}`, boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize:13, fontWeight:700, fontFamily:FH, color:BLK }}>{p.name}</div>
            <div style={{ fontSize:11, color:'#9ca3af', fontFamily:FB }}>{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  MAIN RENDER                                                           */
  /* ════════════════════════════════════════════════════════════════════════ */
  const renderTab = () => {
    switch(tab) {
      case 'agents': return renderAgents()
      case 'campaigns': return renderCampaigns()
      case 'leads': return renderLeads()
      case 'history': return renderCallHistory()
      case 'analytics': return renderAnalytics()
      case 'tcpa': return renderTcpa()
      case 'calendar': return renderCalendar()
      case 'training': return renderTrainingData()
      default: return renderAgents()
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
              <PhoneCall size={18} color={W} />
            </div>
            <div>
              <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:W, fontFamily:FH }}>Voice Agent Intelligence</h1>
              <p style={{ margin:0, fontSize:11, color:'#888', fontFamily:FB }}>AI-powered outbound calling platform</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {loading && <Loader2 size={16} color={T} className="spin" />}
            <Btn small bg={`${T}30`} color={T} onClick={loadAll}><RefreshCw size={12} /> Refresh</Btn>
            <div style={{ display:'flex', gap:6 }}>
              <StatPill label="agents" value={agents.length} color={T} />
              <StatPill label="campaigns" value={campaigns.length} color={GRN} />
              <StatPill label="leads" value={leads.length} color={PURP} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:24, flex:1, overflow:'auto' }}>
          <TabBar tabs={TABS} active={tab} onChange={setTab} />
          {renderTab()}
        </div>
      </div>

      {/* Modals */}
      {showAgentWizard && renderAgentWizard()}
      {showCampaignModal && renderCampaignModal()}

      {/* Spin animation */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  )
}
