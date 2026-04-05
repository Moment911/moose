"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Brain, Sparkles, Play, Pause, Settings, ChevronRight, ChevronDown,
  AlertCircle, CheckCircle, TrendingUp, Star, Target, Zap, BarChart2,
  MessageSquare, Send, RefreshCw, Loader2, Clock, ArrowRight, X,
  Shield, Globe, Users, Award, Calendar, Bell, Eye, ToggleLeft, ToggleRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ClientSearchSelect from '../components/ClientSearchSelect'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClient } from '../context/ClientContext'
import toast from 'react-hot-toast'

const RED   = '#ea2729'
const TEAL  = '#5bc6d0'
const BLK   = '#0a0a0a'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const PURP  = '#7c3aed'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Helvetica Neue',sans-serif"

const INSIGHT_CFG = {
  win:            { color: GREEN, bg: '#f0fdf4', icon: '🏆', border: '#bbf7d0' },
  alert:          { color: RED,   bg: '#fef2f2', icon: '🚨', border: '#fecaca' },
  opportunity:    { color: TEAL,  bg: '#f0fbfc', icon: '🎯', border: '#a5f3fc' },
  recommendation: { color: PURP,  bg: '#f5f3ff', icon: '💡', border: '#ddd6fe' },
  warning:        { color: AMBER, bg: '#fffbeb', icon: '⚠️', border: '#fde68a' },
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

const GOALS_OPTIONS = [
  { key: 'rank_top3',        label: 'Rank #1-3 on Google',     icon: '🥇' },
  { key: 'increase_reviews', label: 'Get More Reviews',        icon: '⭐' },
  { key: 'grow_traffic',     label: 'Grow Organic Traffic',    icon: '📈' },
  { key: 'generate_leads',   label: 'Generate More Leads',     icon: '🎯' },
  { key: 'improve_gbp',      label: 'Optimize Google Profile', icon: '📍' },
  { key: 'beat_competitors', label: 'Outrank Competitors',     icon: '🏆' },
  { key: 'ppc_roi',          label: 'Improve PPC ROI',         icon: '💰' },
  { key: 'content_authority',label: 'Build Content Authority', icon: '✍️' },
  { key: 'ai_visibility',    label: 'Appear in AI Answers',    icon: '🤖' },
]

function InsightCard({ insight, onDismiss }) {
  const cfg = INSIGHT_CFG[insight.type] || INSIGHT_CFG.recommendation
  return (
    <div style={{ background: cfg.bg, borderRadius: 14, border: `1px solid ${cfg.border}`, padding: '16px 18px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{cfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>{insight.title}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.color + '20', color: cfg.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {insight.priority}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>{insight.category}</span>
          </div>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0, fontFamily: FB }}>{insight.body}</p>
          {(insight.metric_before || insight.metric_after) && (
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              {insight.metric_before && (
                <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>
                  <span style={{ fontWeight: 700 }}>Now:</span> {insight.metric_before}
                </div>
              )}
              {insight.metric_after && (
                <div style={{ fontSize: 12, color: GREEN, fontFamily: FB }}>
                  <span style={{ fontWeight: 700 }}>Target:</span> {insight.metric_after}
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={() => onDismiss(insight.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 4, flexShrink: 0 }}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ padding: '10px 16px', background: '#fff', borderRadius: 12, border: '1px solid #f3f4f6', textAlign: 'center' }}>
      <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: color || BLK, letterSpacing: '-.03em' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function AgentPage() {
  const { agencyId, agencyName } = useAuth()
  const { selectedClient } = useClient()
  const chatEndRef = useRef(null)

  // Client selection
  const [clientId,  setClientId]  = useState('')
  const [clientObj, setClientObj] = useState(null)

  // Page state
  const [activeTab, setActiveTab] = useState('dashboard')  // dashboard | setup | chat | history
  const [loading,   setLoading]   = useState(false)
  const [running,   setRunning]   = useState(false)
  const [step,      setStep]      = useState('')

  // Agent data
  const [config,    setConfig]    = useState(null)
  const [insights,  setInsights]  = useState([])
  const [runs,      setRuns]      = useState([])
  const [lastRun,   setLastRun]   = useState(null)
  const [analysis,  setAnalysis]  = useState(null)
  const [snapshot,  setSnapshot]  = useState(null)

  // Setup form
  const [setup, setSetup] = useState({
    business_goals:    [],
    target_keywords:   '',
    competitors:       '',
    service_area:      '',
    monthly_budget:    '',
    ad_budget:         '',
    primary_channel:   'both',
    business_type:     'b2c',
    avg_ticket_value:  '',
    schedule_weekly:   true,
    schedule_monthly:  true,
    schedule_daily:    false,
    alert_review_new:  true,
    alert_rank_drop:   3,
    alert_traffic_drop:20,
    enabled:           false,
  })

  // Chat
  const [chatInput,  setChatInput]  = useState('')
  const [chatHist,   setChatHist]   = useState([])
  const [chatLoading,setChatLoading]= useState(false)

  useEffect(() => { if (selectedClient) { setClientId(selectedClient.id); setClientObj(selectedClient) } }, [selectedClient])
  useEffect(() => { if (clientId) loadAgentData() }, [clientId])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatHist])

  async function loadAgentData() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/agent?client_id=${clientId}`)
      const data = await res.json()
      setConfig(data.config)
      setInsights(data.insights || [])
      setRuns(data.runs || [])
      setLastRun(data.runs?.[0] || null)
      if (data.runs?.[0]?.report_data) setAnalysis(data.runs[0].report_data)
      if (data.chats?.length) setChatHist(data.chats)

      // Pre-fill setup from config
      if (data.config) {
        setSetup(prev => ({
          ...prev,
          ...data.config,
          target_keywords: (data.config.target_keywords || []).join(', '),
          competitors:     (data.config.competitors || []).join(', '),
        }))
      }

      // If no config yet, switch to setup tab
      if (!data.config?.onboarding_done) setActiveTab('setup')
    } catch (e) { toast.error('Failed to load agent data') }
    setLoading(false)
  }

  async function saveConfig(enable = false) {
    if (!clientId) return
    const payload = {
      client_id:        clientId,
      agency_id:        agencyId,
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
    const res = await fetch('/api/agent/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    setConfig(data.config)
    setSetup(prev => ({ ...prev, enabled: data.config.enabled }))
    return data.config
  }

  async function runAnalysis(runType = 'adhoc') {
    if (!clientId) { toast.error('Select a client first'); return }
    setRunning(true)
    const steps = [
      'Pulling GBP data…', 'Analyzing reviews…', 'Checking keyword rankings…',
      'Auditing SEO health…', 'Scanning competitors…', 'Running CMO analysis…',
      'Generating insights…', 'Building action plan…',
    ]
    let si = 0
    const iv = setInterval(() => { si = Math.min(si + 1, steps.length - 1); setStep(steps[si]) }, 3500)
    setStep(steps[0])
    try {
      const res = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, agency_id: agencyId, run_type: runType }),
      })
      const data = await res.json()
      clearInterval(iv)
      if (data.error) throw new Error(data.error)
      setAnalysis(data.analysis)
      setSnapshot(data.snapshot)
      await loadAgentData()
      setActiveTab('dashboard')
      toast.success(`Analysis complete — ${data.analysis?.insights?.length || 0} insights generated`)
    } catch (e) { clearInterval(iv); toast.error('Analysis failed: ' + e.message) }
    setRunning(false); setStep('')
  }

  async function toggleAgent() {
    if (!clientId) return
    try {
      const newEnabled = !setup.enabled
      setSetup(prev => ({ ...prev, enabled: newEnabled }))
      await saveConfig(newEnabled)
      toast.success(newEnabled ? '🤖 Autonomous agent enabled — running 24/7' : 'Agent paused')
    } catch (e) { toast.error('Failed: ' + e.message) }
  }

  async function sendChat() {
    if (!chatInput.trim() || !clientId) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatHist(h => [...h, { role: 'user', content: msg }])
    setChatLoading(true)
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId, agency_id: agencyId, message: msg,
          history: chatHist.slice(-10),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setChatHist(h => [...h, { role: 'agent', content: data.reply }])
    } catch (e) { toast.error('Chat failed: ' + e.message) }
    setChatLoading(false)
  }

  async function dismissInsight(id) {
    await fetch('/api/agent/dismiss', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight_id: id }),
    })
    setInsights(prev => prev.filter(i => i.id !== id))
  }

  const criticalInsights = insights.filter(i => i.priority === 'critical' || i.type === 'alert')
  const otherInsights    = insights.filter(i => i.priority !== 'critical' && i.type !== 'alert')
    .sort((a, b) => (PRIORITY_ORDER[a.priority] || 9) - (PRIORITY_ORDER[b.priority] || 9))

  const isEnabled = setup.enabled || config?.enabled

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f2f2f0' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: BLK, padding: '20px 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-.03em', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Brain size={20} color={TEAL} /> Koto CMO Agent
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', margin: '3px 0 0', fontFamily: FB }}>
                25-year CMO expertise running autonomously 24/7 for every client
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ClientSearchSelect value={clientId} onChange={(id, cl) => { setClientId(id); setClientObj(cl) }} minWidth={220} />
              {clientId && (
                <button onClick={toggleAgent}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none',
                    background: isEnabled ? GREEN : 'rgba(255,255,255,.1)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                  {isEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {isEnabled ? 'Agent Active' : 'Agent Off'}
                </button>
              )}
              {clientId && (
                <button onClick={() => runAnalysis()} disabled={running}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none',
                    background: RED, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH,
                    boxShadow: `0 3px 12px ${RED}50`, opacity: running ? .7 : 1 }}>
                  {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                  {running ? step || 'Analyzing…' : 'Run Analysis'}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'dashboard', label: 'Dashboard',  icon: BarChart2 },
              { key: 'setup',     label: 'Setup',      icon: Settings },
              { key: 'chat',      label: 'Ask CMO',    icon: MessageSquare },
              { key: 'history',   label: 'Run History',icon: Clock },
            ].map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: active ? 'rgba(255,255,255,.12)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,.5)', fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', fontFamily: FH, transition: 'all .15s' }}>
                  <Icon size={13} /> {tab.label}
                  {tab.key === 'dashboard' && criticalInsights.length > 0 && (
                    <span style={{ background: RED, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '1px 6px', marginLeft: 2 }}>
                      {criticalInsights.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

          {/* No client selected */}
          {!clientId && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '64px 24px', textAlign: 'center' }}>
              <Brain size={56} color="#e5e7eb" style={{ margin: '0 auto 16px', display: 'block' }} />
              <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, marginBottom: 8 }}>Koto Autonomous CMO Agent</div>
              <div style={{ fontSize: 15, color: '#6b7280', fontFamily: FB, maxWidth: 560, margin: '0 auto 28px', lineHeight: 1.7 }}>
                Select a client above to activate your autonomous marketing agent. It will analyze every data point, identify opportunities, generate insights, and run 24/7 on autopilot.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, maxWidth: 640, margin: '0 auto' }}>
                {[
                  { icon: '🧠', label: '25yr CMO Expertise', desc: 'SEO, PPC, AEO, reputation, content — all channels' },
                  { icon: '⚡', label: 'Real-Time Analysis', desc: 'Pulls live data from every connected source' },
                  { icon: '🤖', label: 'Set & Forget', desc: 'Runs autonomously, sends alerts, files reports' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '18px 14px', background: '#f9fafb', borderRadius: 14, border: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                    <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB, lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DASHBOARD TAB */}
          {clientId && activeTab === 'dashboard' && (
            <div>
              {/* Status banner */}
              <div style={{ background: isEnabled ? GREEN + '15' : '#f9fafb', borderRadius: 14, border: `1px solid ${isEnabled ? GREEN + '40' : '#e5e7eb'}`, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: isEnabled ? GREEN : '#d1d5db', boxShadow: isEnabled ? `0 0 0 3px ${GREEN}30` : 'none', animation: isEnabled ? 'pulse 2s infinite' : 'none' }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: isEnabled ? GREEN : '#6b7280' }}>
                    {isEnabled ? '🤖 Autonomous agent is active — running 24/7' : '⏸ Agent is paused — click "Agent Off" to activate'}
                  </span>
                  {lastRun && <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB, marginLeft: 12 }}>Last run: {new Date(lastRun.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                {!isEnabled && (
                  <button onClick={() => setActiveTab('setup')}
                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: BLK, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    Complete Setup →
                  </button>
                )}
              </div>

              {/* Snapshot stats */}
              {(snapshot || lastRun) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
                  <StatPill label="Overall Score" value={analysis?.overall_score ? `${analysis.overall_score}/100` : '—'} color={analysis?.overall_score >= 70 ? GREEN : analysis?.overall_score >= 50 ? AMBER : RED} />
                  <StatPill label="Active Insights" value={insights.length} color={criticalInsights.length > 0 ? RED : TEAL} />
                  <StatPill label="GBP Score" value={snapshot?.gbp_score ? `${snapshot.gbp_score}/100` : '—'} color={TEAL} />
                  <StatPill label="Reviews (30d)" value={snapshot?.reviews_count ?? '—'} color={AMBER} />
                  <StatPill label="Keyword Opps" value={snapshot?.keywords_count ?? '—'} color={PURP} />
                </div>
              )}

              {/* Executive summary */}
              {analysis?.summary && (
                <div style={{ background: `linear-gradient(135deg, ${BLK} 0%, #1a1a2e 100%)`, borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Brain size={14} color={TEAL} />
                    <span style={{ fontFamily: FH, fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '.08em' }}>CMO Executive Summary</span>
                  </div>
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,.85)', fontFamily: FB, lineHeight: 1.8, margin: 0 }}>{analysis.summary}</p>
                </div>
              )}

              {/* Critical alerts */}
              {criticalInsights.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: RED, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={14} /> {criticalInsights.length} Critical Alert{criticalInsights.length > 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {criticalInsights.map(i => <InsightCard key={i.id} insight={i} onDismiss={dismissInsight} />)}
                  </div>
                </div>
              )}

              {/* 4-week action plan */}
              {analysis?.top_actions?.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 16 }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={16} color={RED} /> 4-Week Action Plan
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analysis.top_actions.map((action, i) => (
                      <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: i < analysis.top_actions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: RED + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontFamily: FH, fontSize: 12, fontWeight: 900, color: RED }}>W{action.week}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 2 }}>{action.action}</div>
                          <div style={{ fontSize: 13, color: '#6b7280', fontFamily: FB }}>{action.impact}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: action.effort === 'low' ? '#f0fdf4' : action.effort === 'high' ? '#fef2f2' : '#fffbeb', color: action.effort === 'low' ? GREEN : action.effort === 'high' ? RED : AMBER, flexShrink: 0, fontFamily: FH }}>
                          {action.effort} effort
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other insights grid */}
              {otherInsights.length > 0 && (
                <div>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} color={TEAL} /> All Insights ({otherInsights.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                    {otherInsights.map(i => <InsightCard key={i.id} insight={i} onDismiss={dismissInsight} />)}
                  </div>
                </div>
              )}

              {/* 90-day plan */}
              {analysis?.['90_day_plan'] && (
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px 22px', marginTop: 16 }}>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={16} color={PURP} /> 90-Day Growth Plan
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    {[['Month 1', analysis['90_day_plan'].month1], ['Month 2', analysis['90_day_plan'].month2], ['Month 3', analysis['90_day_plan'].month3]].map(([label, body]) => (
                      <div key={label} style={{ padding: '14px 16px', borderRadius: 12, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                        <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: PURP, marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 13, color: '#374151', fontFamily: FB, lineHeight: 1.6 }}>{body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick wins */}
              {analysis?.quick_wins?.length > 0 && (
                <div style={{ background: `${TEAL}15`, borderRadius: 14, border: `1px solid ${TEAL}30`, padding: '16px 20px', marginTop: 16 }}>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 10 }}>⚡ Quick Wins</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {analysis.quick_wins.map((win, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <CheckCircle size={14} color={TEAL} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 14, color: '#374151', fontFamily: FB }}>{win}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state — no analysis yet */}
              {!analysis && !running && (
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '48px 24px', textAlign: 'center' }}>
                  <Sparkles size={40} color="#e5e7eb" style={{ margin: '0 auto 14px', display: 'block' }} />
                  <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 8 }}>No analysis yet</div>
                  <div style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, marginBottom: 20 }}>
                    {config?.onboarding_done ? 'Click "Run Analysis" to generate your first CMO report.' : 'Complete Setup first, then run your first analysis.'}
                  </div>
                  <button onClick={() => config?.onboarding_done ? runAnalysis() : setActiveTab('setup')}
                    style={{ padding: '11px 28px', borderRadius: 11, border: 'none', background: RED, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    {config?.onboarding_done ? '▶ Run First Analysis' : '→ Complete Setup'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SETUP TAB */}
          {clientId && activeTab === 'setup' && (
            <div style={{ maxWidth: 720 }}>
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px 28px', marginBottom: 16 }}>
                <h2 style={{ fontFamily: FH, fontSize: 17, fontWeight: 800, color: BLK, margin: '0 0 6px' }}>Agent Onboarding</h2>
                <p style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, margin: '0 0 24px', lineHeight: 1.6 }}>
                  Answer these questions once. The agent uses this context for every analysis, recommendation, and strategy it generates.
                </p>

                {/* Goals */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, display: 'block', marginBottom: 10 }}>Business Goals <span style={{ color: RED }}>*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {GOALS_OPTIONS.map(g => {
                      const sel = setup.business_goals.includes(g.key)
                      return (
                        <button key={g.key} onClick={() => setSetup(s => ({
                          ...s, business_goals: sel ? s.business_goals.filter(x => x !== g.key) : [...s.business_goals, g.key]
                        }))}
                          style={{ padding: '10px 12px', borderRadius: 10, border: `2px solid ${sel ? RED : '#e5e7eb'}`, background: sel ? RED + '10' : '#fff', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{g.icon}</span>
                          <span style={{ fontFamily: FB, fontSize: 12, fontWeight: sel ? 700 : 400, color: sel ? RED : '#374151' }}>{g.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Keywords */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, display: 'block', marginBottom: 6 }}>Target Keywords (comma-separated)</label>
                  <input value={setup.target_keywords} onChange={e => setSetup(s => ({ ...s, target_keywords: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}
                    placeholder="plumber miami, emergency plumber, water heater repair" />
                </div>

                {/* Competitors */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, display: 'block', marginBottom: 6 }}>Main Competitors (names or domains)</label>
                  <input value={setup.competitors} onChange={e => setSetup(s => ({ ...s, competitors: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}
                    placeholder="competitorplumbing.com, Bob's Plumbing" />
                </div>

                {/* Budget + Channel row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, display: 'block', marginBottom: 6 }}>Monthly Budget ($)</label>
                    <input type="number" value={setup.monthly_budget} onChange={e => setSetup(s => ({ ...s, monthly_budget: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}
                      placeholder="2500" />
                  </div>
                  <div>
                    <label style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, display: 'block', marginBottom: 6 }}>Ad Budget ($)</label>
                    <input type="number" value={setup.ad_budget} onChange={e => setSetup(s => ({ ...s, ad_budget: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}
                      placeholder="1000" />
                  </div>
                  <div>
                    <label style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, display: 'block', marginBottom: 6 }}>Avg Customer Value ($)</label>
                    <input type="number" value={setup.avg_ticket_value} onChange={e => setSetup(s => ({ ...s, avg_ticket_value: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }}
                      placeholder="450" />
                  </div>
                </div>

                {/* Channel + type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, display: 'block', marginBottom: 6 }}>Primary Channel</label>
                    <select value={setup.primary_channel} onChange={e => setSetup(s => ({ ...s, primary_channel: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                      <option value="local_seo">Local SEO only</option>
                      <option value="ppc">PPC / Google Ads only</option>
                      <option value="both">SEO + PPC (both)</option>
                      <option value="organic">Organic / Content</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, display: 'block', marginBottom: 6 }}>Business Type</label>
                    <select value={setup.business_type} onChange={e => setSetup(s => ({ ...s, business_type: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                      <option value="b2c">B2C / Consumer</option>
                      <option value="b2b">B2B / Business</option>
                      <option value="service">Service Area Business</option>
                      <option value="ecommerce">eCommerce</option>
                    </select>
                  </div>
                </div>

                {/* Schedule */}
                <div style={{ background: '#f9fafb', borderRadius: 12, border: '1px solid #f3f4f6', padding: '16px 18px', marginBottom: 20 }}>
                  <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 12 }}>📅 Autonomous Schedule</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { key: 'schedule_weekly', label: 'Weekly Analysis', desc: 'Full audit every Monday morning' },
                      { key: 'schedule_monthly', label: 'Monthly Report', desc: 'Comprehensive report on the 1st' },
                      { key: 'schedule_daily', label: 'Daily Rank Check', desc: 'Track keyword positions every day' },
                      { key: 'alert_review_new', label: 'New Review Alerts', desc: 'Notify when new reviews come in' },
                    ].map(item => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={() => setSetup(s => ({ ...s, [item.key]: !s[item.key] }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                          {setup[item.key]
                            ? <ToggleRight size={26} color={GREEN} />
                            : <ToggleLeft size={26} color="#d1d5db" />}
                        </button>
                        <div>
                          <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK }}>{item.label}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={async () => { try { await saveConfig(); toast.success('Setup saved'); setActiveTab('dashboard'); await runAnalysis() } catch(e) { toast.error(e.message) }}}
                    style={{ flex: 1, padding: '13px', borderRadius: 11, border: 'none', background: RED, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    Save & Run First Analysis →
                  </button>
                  <button onClick={async () => { try { await saveConfig(); toast.success('Saved'); setActiveTab('dashboard') } catch(e) { toast.error(e.message) }}}
                    style={{ padding: '13px 20px', borderRadius: 11, border: '1.5px solid #e5e7eb', background: '#fff', color: BLK, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
                    Save Only
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CHAT TAB */}
          {clientId && activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Brain size={18} color={TEAL} />
                <div>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>Ask Your CMO Anything</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>Ask about strategy, explain metrics, request recommendations, or get a second opinion</div>
                </div>
              </div>

              {/* Chat messages */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
                {chatHist.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 24px' }}>
                    <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB, marginBottom: 16 }}>Start a conversation with your CMO agent</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                      {[
                        'What should I focus on this month?',
                        'Why are my rankings not improving?',
                        'How do I get more Google reviews fast?',
                        'What PPC campaigns should I run?',
                        'Create a 30-day content plan',
                        'How do I beat my top competitor?',
                      ].map(q => (
                        <button key={q} onClick={() => { setChatInput(q) }}
                          style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: 13, fontFamily: FB, cursor: 'pointer' }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatHist.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'agent' && (
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: TEAL + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0, marginTop: 4 }}>
                        <Brain size={14} color={TEAL} />
                      </div>
                    )}
                    <div style={{
                      maxWidth: '72%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.role === 'user' ? BLK : '#fff',
                      border: msg.role === 'agent' ? '1px solid #e5e7eb' : 'none',
                      color: msg.role === 'user' ? '#fff' : '#374151',
                      fontSize: 14, fontFamily: FB, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: TEAL + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Brain size={14} color={TEAL} />
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: '#fff', border: '1px solid #e5e7eb' }}>
                      <Loader2 size={16} color={TEAL} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div style={{ display: 'flex', gap: 10, background: '#fff', borderRadius: 14, border: '1.5px solid #e5e7eb', padding: '8px 8px 8px 16px', alignItems: 'flex-end' }}>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  placeholder="Ask your CMO anything… (Enter to send)"
                  rows={1} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, fontFamily: FB, resize: 'none', lineHeight: 1.6, background: 'transparent', maxHeight: 120, overflowY: 'auto' }} />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                  style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: chatInput.trim() ? RED : '#f3f4f6', color: chatInput.trim() ? '#fff' : '#9ca3af', cursor: chatInput.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {clientId && activeTab === 'history' && (
            <div>
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>
                  Analysis Run History
                </div>
                {runs.length === 0 ? (
                  <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontFamily: FB, fontSize: 14 }}>No runs yet</div>
                ) : runs.map((run) => (
                  <div key={run.id} style={{ padding: '16px 20px', borderBottom: '1px solid #f9fafb', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: run.status === 'done' ? GREEN + '15' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {run.status === 'done' ? <CheckCircle size={16} color={GREEN} /> : <Loader2 size={16} color="#9ca3af" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, textTransform: 'capitalize' }}>{run.run_type} Analysis</div>
                      <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB }}>{run.summary?.slice(0, 100) || 'No summary'}{run.summary?.length > 100 ? '…' : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, fontFamily: FH }}>{run.insights_count} insights</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>
                        {new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
