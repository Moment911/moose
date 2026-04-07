"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Brain, Sparkles, Settings, AlertCircle, CheckCircle,
  TrendingUp, Star, Target, BarChart2, MessageSquare, Send,
  RefreshCw, Loader2, Clock, X, Calendar,
  ToggleLeft, ToggleRight, ChevronDown, Building2,
  Users, Globe, Shield, Layers, Trophy, Lightbulb, AlertTriangle, MapPin, DollarSign
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ClientSearchSelect from '../components/ClientSearchSelect'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'
import { useMobile } from '../hooks/useMobile'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const PURP  = '#7c3aed'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"
const KOTO_AGENCY_ID = '00000000-0000-0000-0000-000000000099'

const INSIGHT_CFG = {
  win:            { color: GREEN, bg: '#f0fdf4', icon: Trophy, border: '#bbf7d0' },
  alert:          { color: RED,   bg: '#fef2f2', icon: AlertCircle, border: '#fecaca' },
  opportunity:    { color: TEAL,  bg: '#f0fbfc', icon: Target, border: '#a5f3fc' },
  recommendation: { color: PURP,  bg: '#f5f3ff', icon: Lightbulb, border: '#ddd6fe' },
  warning:        { color: AMBER, bg: '#fffbeb', icon: AlertTriangle, border: '#fde68a' },
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

const GOALS_OPTIONS = [
  { key: 'rank_top3',         label: 'Rank #1-3 on Google',      icon: Trophy },
  { key: 'increase_reviews',  label: 'Get More Reviews',          icon: Star },
  { key: 'grow_traffic',      label: 'Grow Organic Traffic',      icon: TrendingUp },
  { key: 'generate_leads',    label: 'Generate More Leads',       icon: Target },
  { key: 'improve_gbp',       label: 'Optimize Google Profile',   icon: MapPin },
  { key: 'beat_competitors',  label: 'Outrank Competitors',       icon: Trophy },
  { key: 'ppc_roi',           label: 'Improve PPC ROI',           icon: DollarSign },
  { key: 'content_authority', label: 'Build Content Authority',   icon: Sparkles },
  { key: 'ai_visibility',     label: 'Appear in AI Answers (AEO)',icon: Brain },
]

const MODEL_COLORS = { 'Claude': TEAL, 'GPT-4o': GREEN, 'Gemini': AMBER }

function InsightCard({ insight, onDismiss }) {
  const cfg = INSIGHT_CFG[insight.type] || INSIGHT_CFG.recommendation
  return (
    <div style={{ background: cfg.bg, borderRadius: 14, border: `1px solid ${cfg.border}`, padding: '14px 16px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>{(() => { const Icon = cfg.icon; return <Icon size={18} color={cfg.color}/> })()}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK }}>{insight.title}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: cfg.color + '20', color: cfg.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {insight.priority}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>{insight.category}</span>
          </div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, margin: 0, fontFamily: FB }}>{insight.body}</p>
          {(insight.metric_before || insight.metric_after) && (
            <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
              {insight.metric_before && <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}><span style={{ fontWeight: 700 }}>Now:</span> {insight.metric_before}</div>}
              {insight.metric_after  && <div style={{ fontSize: 11, color: GREEN,    fontFamily: FB }}><span style={{ fontWeight: 700 }}>Target:</span> {insight.metric_after}</div>}
            </div>
          )}
        </div>
        <button onClick={() => onDismiss(insight.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2, flexShrink: 0 }}>
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ padding: '12px 16px', background: '#fff', borderRadius: 12, border: '1px solid #f3f4f6', textAlign: 'center' }}>
      <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: color || BLK, letterSpacing: '-.03em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function ScopeBar({ scope, setScope, clientId, setClientId, setClientObj, isKoto }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ display: 'flex', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', overflow: 'hidden' }}>
        {[
          ...(isKoto ? [{ key: 'koto',   label: 'Koto Platform', icon: Shield }] : []),
          { key: 'agency',  label: 'Agency View',    icon: Building2 },
          { key: 'client',  label: 'Client View',    icon: Users },
        ].map(s => {
          const Icon = s.icon
          const active = scope === s.key
          return (
            <button key={s.key} onClick={() => setScope(s.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRight: '1px solid rgba(255,255,255,.08)', background: active ? 'rgba(255,255,255,.15)' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,.45)', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: FH }}>
              <Icon size={12} /> {s.label}
            </button>
          )
        })}
      </div>
      {scope === 'client' && (
        <ClientSearchSelect value={clientId} onChange={(id, cl) => { setClientId(id); setClientObj(cl) }} minWidth={200} />
      )}
    </div>
  )
}

export default function AgentPage() {
  const { agencyId, realAgencyId, agencyName } = useAuth()
  const isMobile = useMobile()
  const { selectedClient } = useClient()
  const chatEndRef = useRef(null)
  const isKoto = realAgencyId === KOTO_AGENCY_ID || agencyId === KOTO_AGENCY_ID

  // Scope
  const [scope,     setScope]     = useState(isKoto ? 'koto' : 'agency')
  const [clientId,  setClientId]  = useState('')
  const [clientObj, setClientObj] = useState(null)

  // Tabs
  const [activeTab, setActiveTab] = useState('chat')

  // Agent data
  const [loading,   setLoading]   = useState(false)
  const [running,   setRunning]   = useState(false)
  const [runStep,   setRunStep]   = useState('')
  const [config,    setConfig]    = useState(null)
  const [insights,  setInsights]  = useState([])
  const [runs,      setRuns]      = useState([])
  const [analysis,  setAnalysis]  = useState(null)
  const [snapshot,  setSnapshot]  = useState(null)

  // Setup
  const [setup, setSetup] = useState({
    business_goals: [], target_keywords: '', competitors: '',
    service_area: '', monthly_budget: '', ad_budget: '',
    primary_channel: 'both', business_type: 'b2c', avg_ticket_value: '',
    schedule_weekly: true, schedule_monthly: true, schedule_daily: false,
    alert_review_new: true, alert_rank_drop: 3, alert_traffic_drop: 20,
    enabled: false,
  })

  // Chat
  const [chatInput,   setChatInput]   = useState('')
  const [chatHist,    setChatHist]    = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [lastModels,  setLastModels]  = useState([])

  useEffect(() => { if (selectedClient && scope === 'client') { setClientId(selectedClient.id); setClientObj(selectedClient) } }, [selectedClient])
  useEffect(() => { loadAgentData() }, [clientId, scope])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatHist])

  async function loadAgentData() {
    const targetId = scope === 'client' ? clientId : null
    if (scope === 'client' && !clientId) return
    setLoading(true)
    try {
      const url = scope === 'client' ? `/api/agent?client_id=${clientId}` : `/api/agent?client_id=none&scope=${scope}&agency_id=${agencyId}`
      const res  = await fetch(url)
      const data = await res.json()
      setConfig(data.config)
      setInsights(data.insights || [])
      setRuns(data.runs || [])
      if (data.runs?.[0]?.report_data) setAnalysis(data.runs[0].report_data)
      if (data.chats?.length) setChatHist(data.chats)
      if (data.config) setSetup(p => ({ ...p, ...data.config, target_keywords: (data.config.target_keywords||[]).join(', '), competitors: (data.config.competitors||[]).join(', ') }))
    } catch {}
    setLoading(false)
  }

  async function saveConfig(enable) {
    if (!clientId && scope === 'client') return
    const payload = {
      client_id:        clientId, agency_id: agencyId,
      business_goals:   setup.business_goals,
      target_keywords:  setup.target_keywords.split(',').map(k => k.trim()).filter(Boolean),
      competitors:      setup.competitors.split(',').map(c => c.trim()).filter(Boolean),
      service_area:     setup.service_area,
      monthly_budget:   parseFloat(setup.monthly_budget) || null,
      ad_budget:        parseFloat(setup.ad_budget) || null,
      primary_channel:  setup.primary_channel,
      business_type:    setup.business_type,
      avg_ticket_value: parseFloat(setup.avg_ticket_value) || null,
      schedule_weekly:  setup.schedule_weekly,
      schedule_monthly: setup.schedule_monthly,
      schedule_daily:   setup.schedule_daily,
      alert_review_new: setup.alert_review_new,
      alert_rank_drop:  setup.alert_rank_drop,
      alert_traffic_drop: setup.alert_traffic_drop,
      onboarding_done:  true,
      enabled:          enable !== undefined ? enable : setup.enabled,
    }
    const res  = await fetch('/api/agent/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    setConfig(data.config)
    setSetup(p => ({ ...p, enabled: data.config.enabled }))
    return data.config
  }

  async function runAnalysis() {
    if (scope === 'client' && !clientId) { toast.error('Select a client first'); return }
    setRunning(true)
    const steps = ['Pulling live data…','Scanning GBP…','Analyzing reviews…','Checking rankings…','Running CMO analysis…','Synthesizing insights…','Building action plan…']
    let si = 0
    const iv = setInterval(() => { si = Math.min(si+1, steps.length-1); setRunStep(steps[si]) }, 3000)
    setRunStep(steps[0])
    try {
      const res  = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId || 'none', agency_id: agencyId, run_type: 'adhoc', scope }),
      })
      const data = await res.json()
      clearInterval(iv)
      if (data.error) throw new Error(data.error)
      setAnalysis(data.analysis); setSnapshot(data.snapshot)
      await loadAgentData()
      setActiveTab('insights')
      toast.success(`${data.analysis?.insights?.length || 0} insights generated`)
    } catch (e) { clearInterval(iv); toast.error('Failed: ' + e.message) }
    setRunning(false); setRunStep('')
  }

  async function toggleAgent() {
    try {
      const next = !(setup.enabled || config?.enabled)
      setSetup(p => ({ ...p, enabled: next }))
      await saveConfig(next)
      toast.success(next ? '🤖 Agent activated — running 24/7' : 'Agent paused')
    } catch (e) { toast.error(e.message) }
  }

  async function sendChat() {
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatHist(h => [...h, { role: 'user', content: msg }])
    setChatLoading(true)
    try {
      const res  = await fetch('/api/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: chatHist.slice(-10),
          scope,
          scope_id:      scope === 'client' ? clientId : null,
          agency_id:     agencyId,
          real_agency_id: realAgencyId,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLastModels(data.models || [])
      setChatHist(h => [...h, { role: 'agent', content: data.reply, models: data.models }])
    } catch (e) { toast.error('Chat failed: ' + e.message); setChatHist(h => h.slice(0,-1)) }
    setChatLoading(false)
  }

  async function dismissInsight(id) {
    await fetch('/api/agent/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ insight_id: id }) })
    setInsights(p => p.filter(i => i.id !== id))
  }

  const isEnabled        = setup.enabled || config?.enabled
  const criticalInsights = insights.filter(i => i.priority === 'critical' || i.type === 'alert')
  const otherInsights    = insights.filter(i => i.priority !== 'critical' && i.type !== 'alert').sort((a,b) => (PRIORITY_ORDER[a.priority]||9) - (PRIORITY_ORDER[b.priority]||9))

  const scopeLabel = scope === 'koto' ? 'Koto Platform' : scope === 'agency' ? (agencyName || 'Agency') : (clientObj?.name || 'Client')

  const QUICK_QUESTIONS = {
    koto: [
      'Which agency has the best performing clients right now?',
      'What is our total MRR and how is it trending?',
      'Which clients need the most attention across all agencies?',
      'Show me a platform health summary',
      'What are the most common issues across all clients?',
    ],
    agency: [
      'Which of my clients needs the most urgent attention?',
      'Give me a performance summary of all my clients',
      'Which clients have the best review ratings?',
      'Who hasn\'t had an analysis run recently?',
      'What should I focus on this month across my book of clients?',
    ],
    client: [
      'What should I focus on this month?',
      'Why aren\'t my rankings improving?',
      'How do I get more Google reviews fast?',
      'How do I beat my top competitor?',
      'Create a 30-day content plan for my industry',
      'What\'s my biggest quick win right now?',
      'How do I appear in AI search results (AEO)?',
      'Build me a PPC strategy',
    ],
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f2f2f0' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: BLK, padding: isMobile ? '12px 16px 0' : '18px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-.03em', display: 'flex', alignItems: 'center', gap: 9 }}>
                <Brain size={18} color={TEAL} />
                Koto CMO Agent
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: TEAL+'25', color: TEAL, letterSpacing: '.06em' }}>
                  AUTONOMOUS
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: '3px 0 0', fontFamily: FB }}>
                Claude · GPT-4o · Gemini — real-time data at every level
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Autonomous toggle */}
              {scope === 'client' && clientId && (
                <button onClick={toggleAgent}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: 'none', background: isEnabled ? GREEN+'25' : 'rgba(255,255,255,.08)', color: isEnabled ? GREEN : 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                  {isEnabled ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                  {isEnabled ? 'Autonomous ON' : 'Autonomous OFF'}
                </button>
              )}
              <button onClick={runAnalysis} disabled={running}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: 'none', background: RED, color: '#fff', fontSize: 12, fontWeight: 700, cursor: running ? 'default' : 'pointer', fontFamily: FH, opacity: running ? .7 : 1, boxShadow: `0 2px 10px ${RED}50` }}>
                {running ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                {running ? runStep : 'Run Analysis'}
              </button>
            </div>
          </div>

          {/* Scope selector */}
          <ScopeBar scope={scope} setScope={setScope} clientId={clientId} setClientId={setClientId} setClientObj={setClientObj} isKoto={isKoto} />

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {[
              { key: 'chat',     label: 'Ask CMO',    icon: MessageSquare, badge: null },
              { key: 'insights', label: 'Insights',   icon: Sparkles,      badge: criticalInsights.length || null },
              { key: 'plan',     label: 'Action Plan',icon: Calendar,      badge: null },
              { key: 'setup',    label: 'Setup',      icon: Settings,      badge: null },
              { key: 'history',  label: 'History',    icon: Clock,         badge: null },
            ].map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: '8px 8px 0 0', border: 'none', background: active ? '#f2f2f0' : 'transparent', color: active ? BLK : 'rgba(255,255,255,.45)', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: FH, position: 'relative' }}>
                  <Icon size={12} /> {tab.label}
                  {tab.badge > 0 && (
                    <span style={{ background: RED, color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 10, padding: '1px 5px', marginLeft: 2 }}>{tab.badge}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px 16px' : '20px 28px' }}>

          {/* ── CHAT TAB ────────────────────────────────────────────────── */}
          {activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)' }}>

              {/* Scope context badge */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isEnabled ? GREEN : TEAL, boxShadow: `0 0 0 3px ${isEnabled ? GREEN : TEAL}25` }} />
                <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>
                  {scope === 'koto' ? '🌐 Koto Platform — Full visibility across all agencies' :
                   scope === 'agency' ? `🏢 ${agencyName} — All clients in view` :
                   clientObj ? `👤 ${clientObj.name} — Client-level data only` :
                   'Select a client to enable client-level conversation'}
                </span>
                {lastModels.length > 0 && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {lastModels.map(m => (
                      <span key={m} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: (MODEL_COLORS[m]||TEAL)+'20', color: MODEL_COLORS[m]||TEAL, fontFamily: FH }}>{m}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
                {chatHist.length === 0 && (
                  <div style={{ paddingTop: 16 }}>
                    <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB, marginBottom: 12, textAlign: 'center' }}>
                      Ask anything — pulling real-time data from every connected source
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                      {(QUICK_QUESTIONS[scope] || QUICK_QUESTIONS.agency).map(q => (
                        <button key={q} onClick={() => setChatInput(q)}
                          style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontFamily: FB, cursor: 'pointer', lineHeight: 1.4, textAlign: 'left' }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatHist.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                    {msg.role === 'agent' && (
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: TEAL+'20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Brain size={13} color={TEAL} />
                      </div>
                    )}
                    <div>
                      <div style={{
                        maxWidth: 640, padding: '11px 15px',
                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.role === 'user' ? BLK : '#fff',
                        border: msg.role === 'agent' ? '1px solid #e5e7eb' : 'none',
                        color: msg.role === 'user' ? '#fff' : '#374151',
                        fontSize: 14, fontFamily: FB, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                      }}>{msg.content}</div>
                      {msg.role === 'agent' && msg.models?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, marginLeft: 4 }}>
                          {msg.models.map(m => (
                            <span key={m} style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: (MODEL_COLORS[m]||TEAL)+'15', color: MODEL_COLORS[m]||TEAL, fontFamily: FH }}>{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: TEAL+'20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Brain size={13} color={TEAL} />
                    </div>
                    <div style={{ padding: '11px 15px', borderRadius: '16px 16px 16px 4px', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={14} color={TEAL} style={{ animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>Querying Claude · GPT-4o · Gemini…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ display: 'flex', gap: 8, background: '#fff', borderRadius: 14, border: '1.5px solid #e5e7eb', padding: '8px 8px 8px 16px', alignItems: 'flex-end' }}>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  placeholder={`Ask your CMO anything about ${scope === 'koto' ? 'the Koto platform' : scope === 'agency' ? 'your agency' : clientObj?.name || 'this client'}… (Enter to send)`}
                  rows={1} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, fontFamily: FB, resize: 'none', lineHeight: 1.6, background: 'transparent', maxHeight: 120, overflowY: 'auto' }} />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                  style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: chatInput.trim() ? RED : '#f3f4f6', color: chatInput.trim() ? '#fff' : '#9ca3af', cursor: chatInput.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── INSIGHTS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'insights' && (
            <div>
              {/* Status + stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
                <StatPill label="Health Score" value={analysis?.overall_score ? `${analysis.overall_score}/100` : '—'} color={analysis?.overall_score >= 70 ? GREEN : analysis?.overall_score >= 50 ? AMBER : RED} />
                <StatPill label="Active Insights" value={insights.length} color={criticalInsights.length > 0 ? RED : TEAL} />
                <StatPill label="GBP Score" value={snapshot?.gbp_score ? `${snapshot.gbp_score}/100` : '—'} color={TEAL} />
                <StatPill label="Reviews (30d)" value={snapshot?.reviews_count ?? '—'} color={AMBER} />
                <StatPill label="Keyword Opps" value={snapshot?.keywords_count ?? '—'} color={PURP} />
              </div>

              {/* Executive summary */}
              {analysis?.summary && (
                <div style={{ background: `linear-gradient(135deg,${BLK},#1a1a2e)`, borderRadius: 14, padding: '18px 22px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <Brain size={13} color={TEAL} />
                    <span style={{ fontFamily: FH, fontSize: 10, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '.1em' }}>CMO Executive Summary · {scopeLabel}</span>
                  </div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', fontFamily: FB, lineHeight: 1.8, margin: 0 }}>{analysis.summary}</p>
                </div>
              )}

              {/* Critical alerts */}
              {criticalInsights.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: RED, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={13} /> {criticalInsights.length} Critical Alert{criticalInsights.length > 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {criticalInsights.map(i => <InsightCard key={i.id} insight={i} onDismiss={dismissInsight} />)}
                  </div>
                </div>
              )}

              {/* Other insights grid */}
              {otherInsights.length > 0 && (
                <div>
                  <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} color={TEAL} /> Insights ({otherInsights.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                    {otherInsights.map(i => <InsightCard key={i.id} insight={i} onDismiss={dismissInsight} />)}
                  </div>
                </div>
              )}

              {insights.length === 0 && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '48px 24px', textAlign: 'center' }}>
                  <Sparkles size={36} color="#e5e7eb" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 6 }}>No insights yet</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB, marginBottom: 16 }}>Run an analysis to generate AI-powered insights</div>
                  <button onClick={runAnalysis} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: RED, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    ▶ Run Analysis
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── PLAN TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'plan' && (
            <div style={{ maxWidth: 800 }}>
              {analysis?.top_actions?.length > 0 ? (
                <>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 14 }}>
                    <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Calendar size={14} color={RED} /> 4-Week Action Plan
                    </div>
                    {analysis.top_actions.map((action, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < analysis.top_actions.length-1 ? '1px solid #f3f4f6' : 'none', alignItems: 'flex-start' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: RED+'15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontFamily: FH, fontSize: 11, fontWeight: 900, color: RED }}>W{action.week}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 2 }}>{action.action}</div>
                          <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>{action.impact}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: action.effort==='low'?'#f0fdf4':action.effort==='high'?'#fef2f2':'#fffbeb', color: action.effort==='low'?GREEN:action.effort==='high'?RED:AMBER, flexShrink: 0, fontFamily: FH }}>
                          {action.effort} effort
                        </span>
                      </div>
                    ))}
                  </div>

                  {analysis['90_day_plan'] && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 14 }}>
                      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Target size={14} color={PURP} /> 90-Day Growth Plan
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                        {[['Month 1', analysis['90_day_plan'].month1],['Month 2', analysis['90_day_plan'].month2],['Month 3', analysis['90_day_plan'].month3]].map(([label, body]) => (
                          <div key={label} style={{ padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                            <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color: PURP, marginBottom: 5 }}>{label}</div>
                            <div style={{ fontSize: 12, color: '#374151', fontFamily: FB, lineHeight: 1.6 }}>{body}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.quick_wins?.length > 0 && (
                    <div style={{ background: TEAL+'12', borderRadius: 14, border: `1px solid ${TEAL}30`, padding: '14px 18px' }}>
                      <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 10 }}>⚡ Quick Wins</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {analysis.quick_wins.map((win, i) => (
                          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                            <CheckCircle size={13} color={TEAL} style={{ flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: 13, color: '#374151', fontFamily: FB }}>{win}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '48px 24px', textAlign: 'center' }}>
                  <Calendar size={36} color="#e5e7eb" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 6 }}>No action plan yet</div>
                  <button onClick={runAnalysis} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: RED, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>▶ Run Analysis</button>
                </div>
              )}
            </div>
          )}

          {/* ── SETUP TAB ────────────────────────────────────────────────── */}
          {activeTab === 'setup' && (
            <div style={{ maxWidth: 680 }}>
              {scope !== 'client' && (
                <div style={{ background: AMBER+'15', borderRadius: 12, border: `1px solid ${AMBER}40`, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e', fontFamily: FB }}>
                  Setup is configured per-client. Switch to Client View and select a client to configure their agent.
                </div>
              )}
              {scope === 'client' && !clientId && (
                <div style={{ background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb', padding: '40px 24px', textAlign: 'center', fontSize: 14, color: '#6b7280', fontFamily: FB }}>
                  Select a client above to configure their autonomous agent.
                </div>
              )}
              {scope === 'client' && clientId && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '22px 24px' }}>
                  <h2 style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, margin: '0 0 4px' }}>Agent Setup — {clientObj?.name}</h2>
                  <p style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, margin: '0 0 20px', lineHeight: 1.6 }}>Configure once. The agent uses this context for every analysis and recommendation.</p>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, display: 'block', marginBottom: 8 }}>Business Goals</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                      {GOALS_OPTIONS.map(g => {
                        const sel = setup.business_goals.includes(g.key)
                        return (
                          <button key={g.key} onClick={() => setSetup(s => ({ ...s, business_goals: sel ? s.business_goals.filter(x=>x!==g.key) : [...s.business_goals, g.key] }))}
                            style={{ padding: '8px 10px', borderRadius: 9, border: `2px solid ${sel?RED:'#e5e7eb'}`, background: sel?RED+'10':'#fff', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ display:'flex',alignItems:'center' }}>{(() => { const Icon = g.icon; return <Icon size={14} color={sel?RED:'#6b7280'}/> })()}</span>
                            <span style={{ fontFamily: FB, fontSize: 11, fontWeight: sel?700:400, color: sel?RED:'#374151' }}>{g.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {[
                    { key: 'target_keywords', label: 'Target Keywords', placeholder: 'plumber miami, emergency plumber, water heater repair' },
                    { key: 'competitors',     label: 'Competitors',     placeholder: 'competitor.com, Bob\'s Plumbing' },
                    { key: 'service_area',    label: 'Service Area',    placeholder: 'Miami-Dade County, FL' },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                      <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, display: 'block', marginBottom: 5 }}>{f.label}</label>
                      <input value={setup[f.key]} onChange={e => setSetup(s => ({ ...s, [f.key]: e.target.value }))}
                        style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}
                        placeholder={f.placeholder} />
                    </div>
                  ))}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                    {[
                      { key: 'monthly_budget',   label: 'Monthly Budget ($)',    placeholder: '2500' },
                      { key: 'ad_budget',         label: 'Ad Budget ($)',         placeholder: '1000' },
                      { key: 'avg_ticket_value',  label: 'Avg Customer Value ($)',placeholder: '450'  },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, display: 'block', marginBottom: 5 }}>{f.label}</label>
                        <input type="number" value={setup[f.key]} onChange={e => setSetup(s => ({ ...s, [f.key]: e.target.value }))}
                          style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}
                          placeholder={f.placeholder} />
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                    {[
                      { key: 'primary_channel', label: 'Primary Channel', options: [['local_seo','Local SEO'],['ppc','PPC / Google Ads'],['both','SEO + PPC'],['organic','Organic / Content']] },
                      { key: 'business_type',   label: 'Business Type',   options: [['b2c','B2C / Consumer'],['b2b','B2B / Business'],['service','Service Area'],['ecommerce','eCommerce']] },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK, display: 'block', marginBottom: 5 }}>{f.label}</label>
                        <select value={setup[f.key]} onChange={e => setSetup(s => ({ ...s, [f.key]: e.target.value }))}
                          style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                          {f.options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
                    <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color: BLK, marginBottom: 10 }}>📅 Schedule</div>
                    {[
                      { key: 'schedule_weekly',  label: 'Weekly Analysis',    desc: 'Full audit every Monday' },
                      { key: 'schedule_monthly', label: 'Monthly Report',     desc: 'Comprehensive report on 1st' },
                      { key: 'schedule_daily',   label: 'Daily Rank Check',   desc: 'Keyword positions daily' },
                      { key: 'alert_review_new', label: 'New Review Alerts',  desc: 'Alert on new reviews' },
                    ].map(item => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <button onClick={() => setSetup(s => ({ ...s, [item.key]: !s[item.key] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                          {setup[item.key] ? <ToggleRight size={22} color={GREEN}/> : <ToggleLeft size={22} color="#d1d5db"/>}
                        </button>
                        <div>
                          <div style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: BLK }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={async () => { try { await saveConfig(); setActiveTab('chat'); await runAnalysis() } catch(e) { toast.error(e.message) }}}
                      style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: RED, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                      Save & Run Analysis →
                    </button>
                    <button onClick={async () => { try { await saveConfig(); toast.success('Saved') } catch(e) { toast.error(e.message) }}}
                      style={{ padding: '12px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: BLK, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ──────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>
                  Analysis History
                </div>
                {runs.length === 0
                  ? <div style={{ padding: '36px 24px', textAlign: 'center', color: '#9ca3af', fontFamily: FB, fontSize: 13 }}>No runs yet</div>
                  : runs.map(run => (
                    <div key={run.id} style={{ padding: '14px 18px', borderBottom: '1px solid #f9fafb', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: run.status==='done'?GREEN+'15':'#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {run.status==='done' ? <CheckCircle size={14} color={GREEN}/> : <Loader2 size={14} color="#9ca3af"/>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, textTransform: 'capitalize' }}>{run.run_type} Analysis</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>{run.summary?.slice(0,100)||'No summary'}{run.summary?.length>100?'…':''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, fontFamily: FH }}>{run.insights_count} insights</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>
                          {new Date(run.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
