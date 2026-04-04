"use client";
import { useState, useEffect } from 'react'
import {
  Zap, Star, Phone, BarChart2, Globe, Mail, Target,
  Play, Pause, Settings, Plus, ChevronRight, Loader2,
  Check, AlertTriangle, TrendingUp, DollarSign, Clock,
  MessageSquare, RefreshCw, Sparkles, Shield, ArrowRight,
  Activity, X
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const ACCENT = '#E8551A'

// ── Agent definitions ─────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: 'review_response',
    name: 'Review Response Agent',
    tagline: 'Responds to every Google, Yelp & Facebook review — in your client\'s brand voice',
    icon: Star, color: '#f59e0b',
    tier: 'autopilot',
    price: 149,
    runs: 'Every 2 hours',
    impact: 'Avg. +0.3★ rating in 90 days',
    stats_label: ['Reviews Responded','Avg Response Time','Rating Improvement'],
    mock_stats: ['247','< 2 hrs','4.6 → 4.9★'],
    how: [
      'Pulls new reviews from Google Business Profile, Yelp, and Facebook APIs',
      'Scores sentiment and star rating to select the right response tone',
      'Generates a personalized response using brand voice, dos/don\'ts from onboarding',
      'Queues for 1-click agency approval OR auto-posts (configurable)',
      '1-star reviews trigger an immediate agency alert',
    ],
    requires: ['GBP access (from Access Checklist)', 'Brand voice from onboarding'],
  },
  {
    id: 'missed_call',
    name: 'Missed Call Text-Back',
    tagline: 'Texts back within 60 seconds when a call is missed — qualifies the lead automatically',
    icon: Phone, color: '#10b981',
    tier: 'autopilot',
    price: 99,
    runs: 'Real-time (< 60 seconds)',
    impact: '78% of customers go with the first business that responds',
    stats_label: ['Calls Recovered','Leads Qualified','Appts Booked'],
    mock_stats: ['142','89','34'],
    how: [
      'Integrates with GHL phone system or Twilio to detect missed calls',
      'Fires an SMS within 60 seconds: "Hey [name], sorry we missed you — how can we help?"',
      'Conducts a qualifying conversation: service needed, location, budget, timeline',
      'Books into their calendar directly or notifies the owner with a hot lead summary',
      'Out-of-service-area leads get a polite decline with a referral if configured',
    ],
    requires: ['Twilio or GHL phone number', 'Service area from onboarding', 'Calendar access'],
  },
  {
    id: 'gbp_optimizer',
    name: 'GBP Optimization Agent',
    tagline: 'Posts to Google Business Profile 3x/week and keeps the listing fully optimized',
    icon: Globe, color: '#4285f4',
    tier: 'autopilot',
    price: 99,
    runs: 'Every 2 days',
    impact: 'Businesses posting 3+/week get 4x more GBP views',
    stats_label: ['Posts Published','Views Generated','Search Appearances'],
    mock_stats: ['47','12,400','3,200'],
    how: [
      'Uses seasonal notes, services, and target cities from onboarding to plan content',
      'Generates GBP posts: offers, tips, behind-the-scenes, seasonal promotions',
      'Publishes via GBP API — no manual steps',
      'Updates holiday hours automatically 2 weeks in advance',
      'Responds to Q&A questions that appear on the profile',
      'Monitors local ranking changes and sends weekly position reports',
    ],
    requires: ['Google Business Profile Owner access', 'Services and seasonal data from onboarding'],
  },
  {
    id: 'monthly_report',
    name: 'Monthly AI Report Agent',
    tagline: 'Generates a full branded performance report and emails it to clients on the 1st',
    icon: BarChart2, color: '#8b5cf6',
    tier: 'autopilot',
    price: 49,
    runs: '1st of every month',
    impact: 'Saves 4–8 hrs per client per month in manual reporting',
    stats_label: ['Reports Sent','Hours Saved','Client Satisfaction'],
    mock_stats: ['18','144 hrs','4.8/5'],
    how: [
      'Pulls GA4 traffic, keyword rankings, GBP insights, ad performance, review velocity',
      'Writes a plain-English executive summary your client actually understands',
      'Highlights wins: "You ranked #1 for \'plumber miami\' for the first time this month"',
      'Includes 3 specific recommendations for next month based on the data',
      'Generates a branded PDF and emails it to the client automatically',
      'Agency gets a copy and an internal version with more detailed data',
    ],
    requires: ['GA4 Admin access', 'Google Search Console', 'Client email from onboarding'],
  },
  {
    id: 'social_content',
    name: 'Social Content Agent',
    tagline: 'Plans and posts a month of social content for every client — hands-free',
    icon: MessageSquare, color: '#ec4899',
    tier: 'autopilot',
    price: 199,
    runs: 'Weekly content batch',
    impact: '20 hours/month saved per client',
    stats_label: ['Posts Created','Avg Engagement','Hours Saved'],
    mock_stats: ['18/mo','4.2%','20 hrs'],
    how: [
      'Uses persona, brand voice, services, competitors, and seasonal notes from onboarding',
      'Generates platform-specific posts: Facebook, Instagram, LinkedIn, Google Business',
      'Adapts tone per platform — professional on LinkedIn, engaging on Instagram',
      'Queues in Social Planner for 1-click agency review and scheduling',
      'Suggests photo prompts and video ideas for each post',
      'Seasonal content automatically adjusts based on the business calendar',
    ],
    requires: ['Social media accounts from onboarding', 'Brand voice and persona data'],
  },
  {
    id: 'lead_scoring',
    name: 'Lead Scoring Agent',
    tagline: 'Scores every new lead 1–10, tags hot leads, and routes them for immediate follow-up',
    icon: Target, color: '#ef4444',
    tier: 'autopilot',
    price: 149,
    runs: 'Real-time on new leads',
    impact: 'Agency close rates typically increase 25–40%',
    stats_label: ['Leads Scored','Hot Leads Flagged','Close Rate Lift'],
    mock_stats: ['834','267','+31%'],
    how: [
      'Receives new leads from GHL, web forms, or direct integrations',
      'Scores against ideal customer profile from onboarding: location, service type, budget signal',
      'Tags HOT (8-10), WARM (5-7), COLD (1-4) in GHL automatically',
      'HOT leads trigger immediate SMS to the client: "🔥 Hot lead just came in — calling now"',
      'COLD leads enter a low-cost nurture sequence instead of burning sales time',
      'Monthly report shows lead quality trends and conversion by score band',
    ],
    requires: ['GHL integration', 'Ideal customer profile from onboarding', 'Service area data'],
  },
]

const STANDALONE = [
  {
    id: 'competitor_intel',
    name: 'Competitor Intelligence',
    tagline: 'Weekly brief on what your competitors are doing — and how to counter it',
    icon: Shield, color: '#6b7280', price: 99,
    runs: 'Every Monday',
    stats_label: ['Competitors Tracked','Alerts Sent','Opportunities Found'],
    mock_stats: ['3','47','12'],
  },
  {
    id: 'email_nurture',
    name: 'Email Nurture Sequences',
    tagline: 'AI-written 12-email sequences for every new lead that doesn\'t convert',
    icon: Mail, color: '#3b82f6', price: 149,
    runs: 'Triggered on new lead',
    stats_label: ['Sequences Active','Emails Sent','Reopens'],
    mock_stats: ['24','2,847','38%'],
  },
  {
    id: 'landing_pages',
    name: 'Local Landing Page Generator',
    tagline: 'Auto-generates SEO pages for every target city — unique content, zero manual work',
    icon: Globe, color: '#10b981', price: 299,
    runs: 'One-time per city batch',
    stats_label: ['Pages Created','Ranking Keywords','Organic Leads'],
    mock_stats: ['47','312','89/mo'],
  },
]

// ── Agent Card ────────────────────────────────────────────────────────────────
function AgentCard({ agent, clientId, enabled, stats, onToggle, onConfigure }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = agent.icon

  return (
    <div style={{ background:'#fff', borderRadius:18, border:`1.5px solid ${enabled ? agent.color+'40' : '#e5e7eb'}`, overflow:'hidden', transition:'border-color .2s' }}>
      {/* Top bar */}
      <div style={{ height:4, background: enabled ? agent.color : '#e5e7eb', transition:'background .3s' }}/>

      <div style={{ padding:'20px 22px' }}>
        {/* Header row */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
          <div style={{ width:46, height:46, borderRadius:13, background:agent.color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon size={22} color={agent.color}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:3 }}>{agent.name}</div>
            <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5 }}>{agent.tagline}</div>
          </div>
          {/* Toggle */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flexShrink:0 }}>
            <div onClick={() => onToggle(!enabled)}
              style={{ width:48, height:26, borderRadius:13, background: enabled ? agent.color : '#d1d5db', cursor:'pointer', position:'relative', transition:'background .25s' }}>
              <div style={{ position:'absolute', top:3, left: enabled ? 24 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .25s', boxShadow:'0 1px 4px rgba(0,0,0,.2)' }}/>
            </div>
            <div style={{ fontSize:10, fontWeight:700, color: enabled ? agent.color : '#9ca3af' }}>
              {enabled ? 'ON' : 'OFF'}
            </div>
          </div>
        </div>

        {/* Stats row (when enabled) */}
        {enabled && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14, padding:'10px 12px', background:'#f9fafb', borderRadius:12, border:'1px solid #f3f4f6' }}>
            {agent.stats_label.map((label, i) => (
              <div key={label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:16, fontWeight:900, color: i===0?agent.color:'#111' }}>
                  {stats?.[i] || agent.mock_stats[i]}
                </div>
                <div style={{ fontSize:10, color:'#9ca3af', lineHeight:1.3, marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'#f3f4f6', color:'#6b7280', display:'flex', alignItems:'center', gap:5 }}>
            <Clock size={10}/> {agent.runs}
          </span>
          <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:agent.color+'12', color:agent.color }}>
            ${agent.price}/mo add-on
          </span>
          {enabled && <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'#f0fdf4', color:'#16a34a' }}>● Active</span>}
        </div>

        {/* Impact callout */}
        <div style={{ background:`linear-gradient(135deg, ${agent.color}08, transparent)`, border:`1px solid ${agent.color}20`, borderRadius:10, padding:'9px 12px', marginBottom:14, fontSize:12, color:'#374151' }}>
          💡 <strong>Impact:</strong> {agent.impact}
        </div>

        {/* How it works (expandable) */}
        <button onClick={() => setExpanded(e => !e)}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', cursor:'pointer', padding:0, marginBottom: expanded ? 12 : 0 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>How it works</span>
          <ChevronRight size={14} color="#9ca3af" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)', transition:'transform .2s' }}/>
        </button>

        {expanded && (
          <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:14 }}>
            {agent.how.map((step, i) => (
              <div key={i} style={{ display:'flex', gap:10, fontSize:12, color:'#374151', alignItems:'flex-start' }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:agent.color+'15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:agent.color, flexShrink:0 }}>{i+1}</div>
                {step}
              </div>
            ))}
            {agent.requires && (
              <div style={{ marginTop:6, padding:'8px 12px', background:'#fffbeb', borderRadius:9, border:'1px solid #fde68a' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#92400e', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Requires</div>
                {agent.requires.map(r => (
                  <div key={r} style={{ fontSize:11, color:'#92400e', display:'flex', gap:6 }}><Check size={10} style={{ flexShrink:0, marginTop:1 }}/>{r}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => onToggle(!enabled)}
            style={{ flex:1, padding:'9px', borderRadius:10, border:'none', background: enabled ? '#fef2f2' : agent.color, color: enabled ? '#dc2626' : '#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            {enabled ? <><Pause size={13}/> Pause</> : <><Play size={13}/> Activate</>}
          </button>
          <button onClick={() => onConfigure(agent.id)}
            style={{ padding:'9px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
            <Settings size={13}/> Config
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Autopilot Bundle Card ─────────────────────────────────────────────────────
function AutopilotBundle({ activeCount, onActivateAll }) {
  const allActive = activeCount === AGENTS.length
  return (
    <div style={{ background:'linear-gradient(135deg,#18181b,#1f1f1f)', borderRadius:20, padding:'28px 30px', marginBottom:28, position:'relative', overflow:'hidden' }}>
      {/* Glow */}
      <div style={{ position:'absolute', top:-60, right:-60, width:300, height:300, borderRadius:'50%', background:`radial-gradient(circle, ${ACCENT}20 0%, transparent 70%)`, pointerEvents:'none' }}/>

      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:20, marginBottom:20 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:ACCENT, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Zap size={28} color="#fff"/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ fontSize:22, fontWeight:900, color:'#fff' }}>Agency Autopilot Bundle</div>
              <span style={{ fontSize:11, fontWeight:800, color:ACCENT, background:ACCENT+'20', border:`1px solid ${ACCENT}40`, borderRadius:20, padding:'3px 12px' }}>BEST VALUE</span>
            </div>
            <div style={{ fontSize:14, color:'#a1a1aa', lineHeight:1.6, maxWidth:600 }}>
              All 6 agents working together — review responses, missed call recovery, GBP optimization, monthly reports, social content, and lead scoring. One AI team for every client. Runs 24/7 without your team lifting a finger.
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
          {[
            { label:'Value if bought separately', value:'$645/mo', color:'#a1a1aa', strike:true },
            { label:'Bundle price', value:'$497/mo', color:ACCENT },
            { label:'Hours saved per client', value:'40+/mo', color:'#22c55e' },
            { label:'Avg client retention lift', value:'+60%', color:'#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,.06)', borderRadius:12, padding:'14px 16px', textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:900, color:s.color, textDecoration:s.strike?'line-through':'none' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'#52525b', marginTop:4, lineHeight:1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Agent checklist */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:22 }}>
          {AGENTS.map(a => (
            <span key={a.id} style={{ fontSize:12, fontWeight:600, padding:'5px 14px', borderRadius:20, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'#d4d4d8', display:'flex', alignItems:'center', gap:6 }}>
              <a.icon size={12} color={a.color}/> {a.name}
            </span>
          ))}
        </div>

        {/* Status + CTA */}
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: allActive ? '#22c55e' : activeCount > 0 ? '#f59e0b' : '#4b5563', animation: allActive ? 'pulse 2s infinite' : 'none' }}/>
            <span style={{ fontSize:13, color: allActive ? '#22c55e' : activeCount > 0 ? '#f59e0b' : '#6b7280', fontWeight:700 }}>
              {allActive ? 'All 6 agents running' : activeCount > 0 ? `${activeCount} of 6 agents active` : 'No agents active'}
            </span>
          </div>
          {!allActive && (
            <button onClick={onActivateAll}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 24px', borderRadius:12, border:'none', background:ACCENT, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:`0 6px 20px ${ACCENT}45` }}>
              <Zap size={16}/> Activate All 6 Agents <ArrowRight size={15}/>
            </button>
          )}
          {allActive && (
            <div style={{ display:'flex', alignItems:'center', gap:7, padding:'11px 20px', borderRadius:12, background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.3)', color:'#22c55e', fontSize:13, fontWeight:700 }}>
              <Check size={15} strokeWidth={3}/> Running at full capacity
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AIAgentsPage() {
  const { user, agencyId } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [agentStatus, setAgentStatus] = useState({}) // { agentId: boolean }
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('autopilot') // autopilot|standalone|activity

  useEffect(() => { init() }, [])

  async function init() {
    const aid = agencyId || '00000000-0000-0000-0000-000000000099'
    const { data: cls } = await supabase.from('clients').select('id,name,industry').eq('agency_id', aid).order('name')
    setClients(cls || [])
    setLoading(false)
    // Default: first client
    if (cls?.length) selectClient(cls[0])
  }

  function selectClient(client) {
    setSelectedClient(client)
    // Load agent status from DB (stored in client record or separate table)
    // For now: load from localStorage as mock
    const saved = localStorage.getItem(`agent-status-${client.id}`)
    setAgentStatus(saved ? JSON.parse(saved) : {})
  }

  function toggleAgent(agentId, val) {
    const next = { ...agentStatus, [agentId]: val }
    setAgentStatus(next)
    if (selectedClient) localStorage.setItem(`agent-status-${selectedClient.id}`, JSON.stringify(next))
    const agent = AGENTS.find(a => a.id === agentId)
    toast.success(val ? `✅ ${agent?.name} activated` : `⏸ ${agent?.name} paused`)
  }

  function activateAll() {
    const next = {}
    AGENTS.forEach(a => next[a.id] = true)
    setAgentStatus(next)
    if (selectedClient) localStorage.setItem(`agent-status-${selectedClient.id}`, JSON.stringify(next))
    toast.success('🚀 All 6 Autopilot agents activated!')
  }

  function configureAgent(agentId) {
    toast('Agent configuration panel coming soon — for now, settings are inherited from client onboarding data.', { icon:'⚙️' })
  }

  const activeCount = AGENTS.filter(a => agentStatus[a.id]).length

  // Agency-wide stats
  const totalActive = clients.length * activeCount
  const estimatedValue = clients.length * (activeCount > 0 ? 497 : 0)

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Loader2 size={28} color={ACCENT} style={{ animation:'spin 1s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f4f5' }}>
      <Sidebar/>

      {/* Client list */}
      <div style={{ width:220, flexShrink:0, background:'#fff', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0 }}>
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#111' }}>AI Agents</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{clients.length} clients</div>
        </div>

        {/* Agency-wide stats */}
        <div style={{ padding:'12px 14px', background:'#fff7f5', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Agency Overview</div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, textAlign:'center', background:'#fff', borderRadius:9, padding:'8px 4px', border:'1px solid #f3f4f6' }}>
              <div style={{ fontSize:16, fontWeight:900, color:ACCENT }}>{totalActive}</div>
              <div style={{ fontSize:9, color:'#9ca3af' }}>Active Agents</div>
            </div>
            <div style={{ flex:1, textAlign:'center', background:'#fff', borderRadius:9, padding:'8px 4px', border:'1px solid #f3f4f6' }}>
              <div style={{ fontSize:14, fontWeight:900, color:'#22c55e' }}>${(estimatedValue/1000).toFixed(0)}k</div>
              <div style={{ fontSize:9, color:'#9ca3af' }}>MRR Value</div>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {clients.map(c => {
            const saved = localStorage.getItem(`agent-status-${c.id}`)
            const status = saved ? JSON.parse(saved) : {}
            const count = Object.values(status).filter(Boolean).length
            return (
              <div key={c.id} onClick={() => selectClient(c)}
                style={{ padding:'11px 14px', cursor:'pointer', borderBottom:'1px solid #f9fafb', background:selectedClient?.id===c.id?'#fff7f5':'#fff', borderLeft:`3px solid ${selectedClient?.id===c.id?ACCENT:'transparent'}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{c.name}</div>
                  {count > 0 && <span style={{ fontSize:9, fontWeight:800, color:'#22c55e', background:'#f0fdf4', borderRadius:20, padding:'1px 6px' }}>{count} ON</span>}
                </div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>{c.industry}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {!selectedClient ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'#9ca3af' }}>
            <Zap size={48} strokeWidth={1}/>
            <div style={{ fontSize:16, fontWeight:600 }}>Select a client to configure their AI agents</div>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'14px 26px', display:'flex', alignItems:'center', gap:14, position:'sticky', top:0, zIndex:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:17, fontWeight:800, color:'#111' }}>{selectedClient.name} — AI Agents</div>
                <div style={{ fontSize:12, color:'#9ca3af' }}>
                  {activeCount === 0 ? 'No agents active' : `${activeCount} of ${AGENTS.length} Autopilot agents running`}
                </div>
              </div>
              {/* Tab switcher */}
              <div style={{ display:'flex', gap:2, background:'#f3f4f6', borderRadius:10, padding:3 }}>
                {[['autopilot','🤖 Autopilot'],['standalone','⚡ Add-ons'],['activity','📊 Activity']].map(([id,label]) => (
                  <button key={id} onClick={() => setActiveTab(id)}
                    style={{ padding:'6px 14px', borderRadius:8, border:'none', background:activeTab===id?'#fff':'transparent', color:activeTab===id?'#111':'#6b7280', fontSize:12, fontWeight:activeTab===id?700:500, cursor:'pointer', boxShadow:activeTab===id?'0 1px 3px rgba(0,0,0,.1)':'none', whiteSpace:'nowrap' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding:'22px 26px' }}>

              {/* Autopilot tab */}
              {activeTab === 'autopilot' && (
                <>
                  <AutopilotBundle activeCount={activeCount} onActivateAll={activateAll}/>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))', gap:18 }}>
                    {AGENTS.map(agent => (
                      <AgentCard key={agent.id} agent={agent} clientId={selectedClient.id}
                        enabled={!!agentStatus[agent.id]} stats={null}
                        onToggle={val => toggleAgent(agent.id, val)}
                        onConfigure={configureAgent}/>
                    ))}
                  </div>
                </>
              )}

              {/* Standalone add-ons tab */}
              {activeTab === 'standalone' && (
                <div>
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:18, fontWeight:800, color:'#111', marginBottom:6 }}>Standalone Add-On Agents</div>
                    <div style={{ fontSize:14, color:'#6b7280' }}>Additional AI capabilities that work alongside the Autopilot bundle</div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
                    {STANDALONE.map(agent => {
                      const Icon = agent.icon
                      return (
                        <div key={agent.id} style={{ background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', padding:'22px', position:'relative', overflow:'hidden' }}>
                          <div style={{ display:'flex', gap:14, marginBottom:14 }}>
                            <div style={{ width:44, height:44, borderRadius:12, background:agent.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <Icon size={20} color={agent.color}/>
                            </div>
                            <div>
                              <div style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:3 }}>{agent.name}</div>
                              <span style={{ fontSize:11, fontWeight:700, color:agent.color, background:agent.color+'12', padding:'2px 9px', borderRadius:20 }}>${agent.price}/mo</span>
                            </div>
                          </div>
                          <p style={{ fontSize:13, color:'#6b7280', lineHeight:1.6, marginBottom:14 }}>{agent.tagline}</p>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:16 }}>
                            {agent.stats_label.map((label, i) => (
                              <div key={label} style={{ background:'#f9fafb', borderRadius:8, padding:'8px', textAlign:'center' }}>
                                <div style={{ fontSize:14, fontWeight:800, color:agent.color }}>{agent.mock_stats[i]}</div>
                                <div style={{ fontSize:9, color:'#9ca3af', lineHeight:1.2, marginTop:1 }}>{label}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display:'flex', gap:7, fontSize:11, color:'#9ca3af', marginBottom:14 }}>
                            <Clock size={11}/> {agent.runs}
                          </div>
                          <button onClick={() => toast('Coming in next sprint! Add to your waitlist.', { icon:'🔜' })}
                            style={{ width:'100%', padding:'10px', borderRadius:10, border:`1.5px solid ${agent.color}`, background:'#fff', color:agent.color, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                            Activate Agent
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Activity tab */}
              {activeTab === 'activity' && (
                <div>
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:18, fontWeight:800, color:'#111', marginBottom:6 }}>Agent Activity Log</div>
                    <div style={{ fontSize:14, color:'#6b7280' }}>Everything your AI agents have done for {selectedClient.name}</div>
                  </div>
                  {/* Mock activity feed */}
                  {[
                    { icon:'⭐', time:'2 hours ago', action:'Review Response Agent', desc:'Responded to 4.5★ Google review from "Michael T." — response posted automatically', color:'#f59e0b' },
                    { icon:'📱', time:'6 hours ago', action:'Social Content Agent', desc:'Generated 4 posts for next week — queued in Social Planner for review', color:'#ec4899' },
                    { icon:'🔍', time:'Yesterday', action:'GBP Optimization Agent', desc:'Published "Emergency HVAC in Miami — 24/7 Service" post to Google Business Profile', color:'#4285f4' },
                    { icon:'📞', time:'Yesterday', action:'Missed Call Text-Back', desc:'Recovered missed call from (305) 555-0192 — lead qualified, appointment booked', color:'#10b981' },
                    { icon:'🎯', time:'2 days ago', action:'Lead Scoring Agent', desc:'Scored 8 new leads — 2 tagged HOT, 4 WARM, 2 COLD — owner notified on hot leads', color:'#ef4444' },
                    { icon:'📊', time:'Dec 1', action:'Monthly Report Agent', desc:'Generated November performance report — emailed to client and agency', color:'#8b5cf6' },
                  ].map((item, i) => (
                    <div key={i} style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', padding:'16px 20px', marginBottom:10, display:'flex', gap:14, alignItems:'flex-start' }}>
                      <div style={{ width:40, height:40, borderRadius:12, background:item.color+'15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{item.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:item.color }}>{item.action}</span>
                          <span style={{ fontSize:11, color:'#9ca3af' }}>{item.time}</span>
                        </div>
                        <div style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}>{item.desc}</div>
                      </div>
                      <Check size={15} color="#22c55e" style={{ flexShrink:0, marginTop:2 }}/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}
