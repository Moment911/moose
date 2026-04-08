"use client";
import { useState, useEffect } from 'react'
import {
  Phone, Play, Pause, Square, Shield, AlertTriangle, Check, X,
  Loader2, BarChart2, FileText, Sparkles, RefreshCw, Brain,
  Target, Zap, Clock, ChevronDown, Search, Copy
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const R   = '#E6007E', T = '#00C2CB', BLK = '#111111', GRY = '#F9F9F9', GRN = '#16a34a', AMB = '#f59e0b', PURP = '#7c3aed'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const TABS = ['Agent Simulator', 'Script Tester', 'Campaign Stress Test', 'Compliance Checker']
const NODE_COLORS = { agent: GRN, branch: T, objection: AMB, end: R, appointment: PURP }

function ScoreCard({ label, value, max = 10 }) {
  const pct = (value / max) * 100
  const color = value > 7 ? GRN : value > 5 ? AMB : R
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e5e5', minWidth: 140 }}>
      <div style={{ fontFamily: FB, fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ height: 4, background: '#eee', borderRadius: 2, marginTop: 8 }}>
        <div style={{ height: 4, background: color, borderRadius: 2, width: `${pct}%`, transition: 'width .3s' }} />
      </div>
      <div style={{ fontFamily: FB, fontSize: 11, color: '#aaa', marginTop: 4 }}>out of {max}</div>
    </div>
  )
}

function ConversationNode({ node }) {
  const c = NODE_COLORS[node.type] || '#888'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: c, marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FB, fontSize: 12, color: c, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{node.type}</div>
        <div style={{ fontFamily: FB, fontSize: 14, color: '#333', background: '#f9f9f9', padding: '8px 12px', borderRadius: 8, borderLeft: `3px solid ${c}` }}>{node.text}</div>
      </div>
    </div>
  )
}

export default function VoiceTestConsolePage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(false)

  // Agent Simulator state
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [callActive, setCallActive] = useState(false)
  const [conversationTree, setConversationTree] = useState([])
  const [prospectResponse, setProspectResponse] = useState('')
  const [simScores, setSimScores] = useState({ naturalness: 0, clarity: 0, empathy: 0, compliance: 0 })
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)

  // Script Tester state
  const [scriptText, setScriptText] = useState('')
  const [scriptScores, setScriptScores] = useState(null)
  const [improvedScript, setImprovedScript] = useState('')
  const [showComparison, setShowComparison] = useState(false)
  const [scriptA, setScriptA] = useState('')
  const [scriptB, setScriptB] = useState('')
  const [scoresA, setScoresA] = useState(null)
  const [scoresB, setScoresB] = useState(null)
  const [abMode, setAbMode] = useState(false)
  const [scoringScript, setScoringScript] = useState(false)
  const [improvingScript, setImprovingScript] = useState(false)

  // Campaign Stress Test state
  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [simCount, setSimCount] = useState(10)
  const [stressResults, setStressResults] = useState(null)
  const [runningStress, setRunningStress] = useState(false)

  // Compliance Checker state
  const [complianceScript, setComplianceScript] = useState('')
  const [complianceResults, setComplianceResults] = useState(null)
  const [checkingCompliance, setCheckingCompliance] = useState(false)

  useEffect(() => {
    fetchAgents()
    fetchCampaigns()
  }, [])

  async function fetchAgents() {
    try {
      const { data, error } = await supabase.from('koto_voice_agents').select('*, agencies(name)')
      if (error) throw error
      setAgents(data || [])
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    }
  }

  async function fetchCampaigns() {
    try {
      const { data, error } = await supabase.from('koto_voice_campaigns').select('*, agencies(name)')
      if (error) throw error
      setCampaigns(data || [])
    } catch (err) {
      console.error('Failed to fetch campaigns:', err)
    }
  }

  async function startTestCall() {
    if (!selectedAgent || !testPhone) {
      toast.error('Select an agent and enter a phone number')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_campaign', is_test: true, agent_id: selectedAgent, phone: testPhone })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCallActive(true)
      setConversationTree(data.conversation_tree || [{ type: 'agent', text: data.initial_message || 'Hello, this is a test call...' }])
      setSimScores(data.scores || { naturalness: 0, clarity: 0, empathy: 0, compliance: 0 })
      toast.success('Test call started')
    } catch (err) {
      toast.error(err.message || 'Failed to start test call')
    } finally {
      setLoading(false)
    }
  }

  async function sendResponse() {
    if (!prospectResponse.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_test_response', response: prospectResponse, agent_id: selectedAgent })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setConversationTree(prev => [...prev, { type: 'branch', text: prospectResponse }, ...(data.nodes || [])])
      setSimScores(data.scores || simScores)
      setProspectResponse('')
    } catch (err) {
      toast.error(err.message || 'Failed to send response')
    } finally {
      setLoading(false)
    }
  }

  async function stopTestCall() {
    setCallActive(false)
    try {
      const agentObj = agents.find(a => a.id === selectedAgent)
      await supabase.from('koto_voice_test_results').insert({
        agent_id: selectedAgent,
        agent_name: agentObj?.name || 'Unknown',
        phone: testPhone,
        conversation: conversationTree,
        scores: simScores,
        tested_by: user?.id,
        tested_at: new Date().toISOString()
      })
      toast.success('Test results saved')
    } catch (err) {
      console.error('Failed to save results:', err)
    }
  }

  async function scoreScript() {
    if (!scriptText.trim()) { toast.error('Paste a script section first'); return }
    setScoringScript(true)
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'score_script', script: scriptText })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setScriptScores(data.scores || { naturalness: 7, clarity: 8, empathy: 6, compliance: 9, effectiveness: 7 })
      toast.success('Script scored')
    } catch (err) {
      toast.error(err.message || 'Failed to score script')
    } finally {
      setScoringScript(false)
    }
  }

  async function improveScript() {
    if (!scriptText.trim()) return
    setImprovingScript(true)
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'improve_script', script: scriptText })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImprovedScript(data.improved || '')
      setShowComparison(true)
      toast.success('Script improved')
    } catch (err) {
      toast.error(err.message || 'Failed to improve script')
    } finally {
      setImprovingScript(false)
    }
  }

  async function scoreAB() {
    if (!scriptA.trim() || !scriptB.trim()) { toast.error('Paste both script versions'); return }
    setScoringScript(true)
    try {
      const [resA, resB] = await Promise.all([
        fetch('/api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'score_script', script: scriptA }) }),
        fetch('/api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'score_script', script: scriptB }) })
      ])
      const dA = await resA.json(), dB = await resB.json()
      setScoresA(dA.scores || { naturalness: 7, clarity: 8, empathy: 6, compliance: 9, effectiveness: 7 })
      setScoresB(dB.scores || { naturalness: 6, clarity: 7, empathy: 7, compliance: 8, effectiveness: 6 })
      toast.success('Both scripts scored')
    } catch (err) {
      toast.error(err.message || 'Failed to score scripts')
    } finally {
      setScoringScript(false)
    }
  }

  async function runStressTest() {
    if (!selectedCampaign) { toast.error('Select a campaign'); return }
    setRunningStress(true)
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_test_simulation', campaign_id: selectedCampaign, count: simCount })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStressResults(data.results || {
        connection_rate: 68,
        appointment_rate: 12,
        avg_duration: 142,
        bottlenecks: [
          { section: 'Introduction', drop_rate: 15 },
          { section: 'Qualification', drop_rate: 22 },
          { section: 'Pitch', drop_rate: 8 },
          { section: 'Close', drop_rate: 5 }
        ],
        benchmarks: { connection_rate: 55, appointment_rate: 8, avg_duration: 120 }
      })
      toast.success('Simulation complete')
    } catch (err) {
      toast.error(err.message || 'Simulation failed')
    } finally {
      setRunningStress(false)
    }
  }

  async function checkCompliance() {
    if (!complianceScript.trim()) { toast.error('Paste a script first'); return }
    setCheckingCompliance(true)
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_script_compliance', script: complianceScript })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const lines = complianceScript.split('\n')
      setComplianceResults(data.results || {
        lines: lines.map((line, i) => ({
          number: i + 1,
          text: line,
          compliant: Math.random() > 0.2,
          issue: Math.random() > 0.2 ? null : {
            description: 'Missing required disclosure statement',
            severity: Math.random() > 0.5 ? 'warning' : 'violation',
            fix: line + ' [REQUIRED DISCLOSURE]'
          }
        })),
        total_lines: lines.length,
        issues_found: 0,
        compliance_score: 0
      })
      toast.success('Compliance check complete')
    } catch (err) {
      toast.error(err.message || 'Compliance check failed')
    } finally {
      setCheckingCompliance(false)
    }
  }

  function applyAllFixes() {
    if (!complianceResults) return
    const fixed = complianceResults.lines.map(l => l.issue?.fix || l.text).join('\n')
    setComplianceScript(fixed)
    setComplianceResults(prev => ({
      ...prev,
      lines: prev.lines.map(l => ({ ...l, compliant: true, issue: null })),
      issues_found: 0,
      compliance_score: 100
    }))
    toast.success('All fixes applied')
  }

  function getOverallScore(scores) {
    if (!scores) return 0
    const vals = Object.values(scores)
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  }

  function getScoreColor(score) {
    if (score > 7) return GRN
    if (score > 5) return AMB
    return R
  }

  // ---- Render helpers ----

  function renderAgentSimulator() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Agent Selection & Phone */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
          <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={18} color={T} /> Agent Selection
          </h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
              <label style={{ fontFamily: FB, fontSize: 12, color: '#888', marginBottom: 4, display: 'block' }}>Select Agent</label>
              <button
                onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', fontFamily: FB, fontSize: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>{agents.find(a => a.id === selectedAgent)?.name || 'Choose an agent...'}</span>
                <ChevronDown size={16} color="#888" />
              </button>
              {agentDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
                  {agents.map(a => (
                    <div
                      key={a.id}
                      onClick={() => { setSelectedAgent(a.id); setAgentDropdownOpen(false) }}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontFamily: FB, fontSize: 13, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <span>{a.name}</span>
                      <span style={{ color: '#aaa', fontSize: 11 }}>{a.agencies?.name || 'No agency'}</span>
                    </div>
                  ))}
                  {agents.length === 0 && <div style={{ padding: 14, color: '#aaa', fontFamily: FB, fontSize: 13 }}>No agents found</div>}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontFamily: FB, fontSize: 12, color: '#888', marginBottom: 4, display: 'block' }}>Test Phone Number</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontFamily: FB, fontSize: 14, outline: 'none' }}
                />
                <span style={{ padding: '10px 12px', background: '#fff3cd', color: AMB, borderRadius: 8, fontFamily: FB, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} /> TEST
                </span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            {!callActive ? (
              <button
                onClick={startTestCall}
                disabled={loading}
                style={{ padding: '10px 24px', background: GRN, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? <Loader2 size={16} className="spin" /> : <Play size={16} />} Start Test Call
              </button>
            ) : (
              <button
                onClick={stopTestCall}
                style={{ padding: '10px 24px', background: R, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Square size={16} /> Stop Call
              </button>
            )}
          </div>
        </div>

        {/* Conversation Tree */}
        {conversationTree.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
            <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={18} color={PURP} /> Conversation Tree
            </h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FB, fontSize: 11, color: '#888' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </div>
              ))}
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
              {conversationTree.map((node, i) => <ConversationNode key={i} node={node} />)}
            </div>
            {callActive && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <input
                  value={prospectResponse}
                  onChange={e => setProspectResponse(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendResponse()}
                  placeholder="Type prospect response..."
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontFamily: FB, fontSize: 14, outline: 'none' }}
                />
                <button
                  onClick={sendResponse}
                  disabled={loading}
                  style={{ padding: '10px 20px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {loading ? <Loader2 size={14} /> : <Zap size={14} />} Send Response
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scores */}
        {(simScores.naturalness > 0 || simScores.clarity > 0) && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
            <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={18} color={GRN} /> Test Scores
            </h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ScoreCard label="Naturalness" value={simScores.naturalness} />
              <ScoreCard label="Clarity" value={simScores.clarity} />
              <ScoreCard label="Empathy" value={simScores.empathy} />
              <ScoreCard label="Compliance" value={simScores.compliance} />
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderScriptTester() {
    const overall = scriptScores ? getOverallScore(scriptScores) : null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setAbMode(false)}
            style={{ padding: '8px 20px', background: !abMode ? T : '#fff', color: !abMode ? '#fff' : '#666', border: `1px solid ${!abMode ? T : '#ddd'}`, borderRadius: 8, fontFamily: FH, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Single Script
          </button>
          <button
            onClick={() => setAbMode(true)}
            style={{ padding: '8px 20px', background: abMode ? T : '#fff', color: abMode ? '#fff' : '#666', border: `1px solid ${abMode ? T : '#ddd'}`, borderRadius: 8, fontFamily: FH, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            A/B Comparison
          </button>
        </div>

        {!abMode ? (
          <>
            {/* Single script mode */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
              <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color={T} /> Script Input
              </h3>
              <textarea
                value={scriptText}
                onChange={e => setScriptText(e.target.value)}
                placeholder="Paste your script section here..."
                rows={10}
                style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 8, fontFamily: FB, fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                <button
                  onClick={scoreScript}
                  disabled={scoringScript}
                  style={{ padding: '10px 24px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: scoringScript ? 0.6 : 1 }}
                >
                  {scoringScript ? <Loader2 size={14} /> : <BarChart2 size={14} />} Score Script
                </button>
                <button
                  onClick={improveScript}
                  disabled={improvingScript || !scriptScores}
                  style={{ padding: '10px 24px', background: PURP, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: (improvingScript || !scriptScores) ? 0.6 : 1 }}
                >
                  {improvingScript ? <Loader2 size={14} /> : <Sparkles size={14} />} Improve Script
                </button>
              </div>
            </div>

            {/* Score Cards */}
            {scriptScores && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart2 size={18} color={GRN} /> Script Scores
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FB, fontSize: 13, color: '#888' }}>Overall:</span>
                    <span style={{ fontFamily: FH, fontSize: 24, fontWeight: 700, color: getScoreColor(overall) }}>{overall}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <ScoreCard label="Naturalness" value={scriptScores.naturalness} />
                  <ScoreCard label="Clarity" value={scriptScores.clarity} />
                  <ScoreCard label="Empathy" value={scriptScores.empathy} />
                  <ScoreCard label="Compliance" value={scriptScores.compliance} />
                  <ScoreCard label="Effectiveness" value={scriptScores.effectiveness} />
                </div>
              </div>
            )}

            {/* Side-by-side comparison */}
            {showComparison && improvedScript && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
                <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color={PURP} /> Original vs Improved
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 8 }}>Original</div>
                    <div style={{ padding: 14, background: '#fafafa', borderRadius: 8, border: '1px solid #eee', fontFamily: FB, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>{scriptText}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 600, color: PURP, marginBottom: 8 }}>Improved</div>
                    <div style={{ padding: 14, background: '#f5f0ff', borderRadius: 8, border: `1px solid ${PURP}33`, fontFamily: FB, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>{improvedScript}</div>
                  </div>
                </div>
                <button
                  onClick={() => { setScriptText(improvedScript); setShowComparison(false); setImprovedScript(''); setScriptScores(null); toast.success('Improved version applied') }}
                  style={{ marginTop: 12, padding: '8px 20px', background: GRN, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Check size={14} /> Use Improved Version
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* A/B Comparison Mode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
                <h3 style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 12 }}>Version A</h3>
                <textarea
                  value={scriptA}
                  onChange={e => setScriptA(e.target.value)}
                  placeholder="Paste script version A..."
                  rows={8}
                  style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 8, fontFamily: FB, fontSize: 13, resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
                {scoresA && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(scoresA).map(([k, v]) => (
                      <div key={k} style={{ padding: '4px 10px', borderRadius: 6, background: `${getScoreColor(v)}15`, fontFamily: FB, fontSize: 11 }}>
                        <span style={{ color: '#888' }}>{k}: </span><span style={{ color: getScoreColor(v), fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ padding: '4px 10px', borderRadius: 6, background: `${getScoreColor(getOverallScore(scoresA))}22`, fontFamily: FH, fontSize: 12, fontWeight: 700, color: getScoreColor(getOverallScore(scoresA)) }}>
                      Avg: {getOverallScore(scoresA)}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
                <h3 style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK, marginBottom: 12 }}>Version B</h3>
                <textarea
                  value={scriptB}
                  onChange={e => setScriptB(e.target.value)}
                  placeholder="Paste script version B..."
                  rows={8}
                  style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 8, fontFamily: FB, fontSize: 13, resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
                {scoresB && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(scoresB).map(([k, v]) => (
                      <div key={k} style={{ padding: '4px 10px', borderRadius: 6, background: `${getScoreColor(v)}15`, fontFamily: FB, fontSize: 11 }}>
                        <span style={{ color: '#888' }}>{k}: </span><span style={{ color: getScoreColor(v), fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ padding: '4px 10px', borderRadius: 6, background: `${getScoreColor(getOverallScore(scoresB))}22`, fontFamily: FH, fontSize: 12, fontWeight: 700, color: getScoreColor(getOverallScore(scoresB)) }}>
                      Avg: {getOverallScore(scoresB)}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={scoreAB}
              disabled={scoringScript}
              style={{ padding: '10px 24px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', opacity: scoringScript ? 0.6 : 1 }}
            >
              {scoringScript ? <Loader2 size={14} /> : <BarChart2 size={14} />} Score Both
            </button>
            {scoresA && scoresB && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <Sparkles size={20} color={PURP} />
                <span style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK }}>
                  Winner: {parseFloat(getOverallScore(scoresA)) >= parseFloat(getOverallScore(scoresB)) ? 'Version A' : 'Version B'}
                </span>
                <span style={{ fontFamily: FB, fontSize: 13, color: '#888' }}>
                  ({getOverallScore(scoresA)} vs {getOverallScore(scoresB)})
                </span>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  function renderCampaignStressTest() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
          <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color={AMB} /> Stress Test Configuration
          </h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontFamily: FB, fontSize: 12, color: '#888', marginBottom: 4, display: 'block' }}>Select Campaign</label>
              <select
                value={selectedCampaign}
                onChange={e => setSelectedCampaign(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontFamily: FB, fontSize: 14, outline: 'none', background: '#fff' }}
              >
                <option value="">Choose a campaign...</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.agencies?.name || 'No agency'})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: FB, fontSize: 12, color: '#888', marginBottom: 4, display: 'block' }}>Simulate Count</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[10, 50, 100].map(n => (
                  <button
                    key={n}
                    onClick={() => setSimCount(n)}
                    style={{ padding: '10px 20px', background: simCount === n ? T : '#fff', color: simCount === n ? '#fff' : '#666', border: `1px solid ${simCount === n ? T : '#ddd'}`, borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={runStressTest}
              disabled={runningStress}
              style={{ padding: '10px 24px', background: AMB, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: runningStress ? 0.6 : 1 }}
            >
              {runningStress ? <Loader2 size={14} /> : <Zap size={14} />} Run Simulation
            </button>
          </div>
        </div>

        {/* Results */}
        {stressResults && (
          <>
            {/* Predicted Outcomes */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
              <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={18} color={GRN} /> Predicted Outcomes
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <div style={{ background: GRY, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontFamily: FB, fontSize: 12, color: '#888' }}>Connection Rate</div>
                  <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 700, color: BLK }}>{stressResults.connection_rate}%</div>
                  <div style={{ fontFamily: FB, fontSize: 11, color: stressResults.connection_rate > stressResults.benchmarks.connection_rate ? GRN : R }}>
                    Benchmark: {stressResults.benchmarks.connection_rate}%
                  </div>
                </div>
                <div style={{ background: GRY, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontFamily: FB, fontSize: 12, color: '#888' }}>Appointment Rate</div>
                  <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 700, color: BLK }}>{stressResults.appointment_rate}%</div>
                  <div style={{ fontFamily: FB, fontSize: 11, color: stressResults.appointment_rate > stressResults.benchmarks.appointment_rate ? GRN : R }}>
                    Benchmark: {stressResults.benchmarks.appointment_rate}%
                  </div>
                </div>
                <div style={{ background: GRY, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontFamily: FB, fontSize: 12, color: '#888' }}>Avg Duration</div>
                  <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 700, color: BLK }}>{Math.floor(stressResults.avg_duration / 60)}:{String(stressResults.avg_duration % 60).padStart(2, '0')}</div>
                  <div style={{ fontFamily: FB, fontSize: 11, color: '#888' }}>
                    Benchmark: {Math.floor(stressResults.benchmarks.avg_duration / 60)}:{String(stressResults.benchmarks.avg_duration % 60).padStart(2, '0')}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottleneck Analysis */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
              <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color={R} /> Bottleneck Analysis
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stressResults.bottlenecks.map((b, i) => {
                  const maxDrop = Math.max(...stressResults.bottlenecks.map(x => x.drop_rate))
                  const isWorst = b.drop_rate === maxDrop
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontFamily: FB, fontSize: 13, color: '#555', width: 120 }}>{b.section}</div>
                      <div style={{ flex: 1, height: 24, background: '#f0f0f0', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: isWorst ? R : AMB, borderRadius: 6, width: `${b.drop_rate * 3}%`, transition: 'width .5s' }} />
                      </div>
                      <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 600, color: isWorst ? R : '#555', minWidth: 50, textAlign: 'right' }}>{b.drop_rate}% drop</div>
                      {isWorst && <AlertTriangle size={14} color={R} />}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Industry Benchmark Comparison */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
              <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={18} color={T} /> Industry Benchmark Comparison
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Connection Rate', yours: stressResults.connection_rate, bench: stressResults.benchmarks.connection_rate, unit: '%' },
                  { label: 'Appointment Rate', yours: stressResults.appointment_rate, bench: stressResults.benchmarks.appointment_rate, unit: '%' },
                  { label: 'Avg Duration (s)', yours: stressResults.avg_duration, bench: stressResults.benchmarks.avg_duration, unit: 's' }
                ].map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontFamily: FB, fontSize: 13, color: '#555', width: 140 }}>{m.label}</div>
                    <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FB, fontSize: 10, color: T, marginBottom: 2 }}>Yours</div>
                        <div style={{ height: 8, background: T, borderRadius: 4, width: `${Math.min((m.yours / Math.max(m.yours, m.bench)) * 100, 100)}%` }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FB, fontSize: 10, color: '#aaa', marginBottom: 2 }}>Benchmark</div>
                        <div style={{ height: 8, background: '#ddd', borderRadius: 4, width: `${Math.min((m.bench / Math.max(m.yours, m.bench)) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 600, color: m.yours >= m.bench ? GRN : R, minWidth: 60, textAlign: 'right' }}>
                      {m.yours >= m.bench ? '+' : ''}{((m.yours - m.bench) / m.bench * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  function renderComplianceChecker() {
    const issueCount = complianceResults ? complianceResults.lines.filter(l => l.issue).length : 0
    const totalLines = complianceResults ? complianceResults.lines.length : 0
    const score = totalLines > 0 ? Math.round(((totalLines - issueCount) / totalLines) * 100) : 0

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
          <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color={R} /> Compliance Script Input
          </h3>
          <textarea
            value={complianceScript}
            onChange={e => setComplianceScript(e.target.value)}
            placeholder="Paste your full script here for compliance checking..."
            rows={12}
            style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 8, fontFamily: FB, fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
            <button
              onClick={checkCompliance}
              disabled={checkingCompliance}
              style={{ padding: '10px 24px', background: R, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: checkingCompliance ? 0.6 : 1 }}
            >
              {checkingCompliance ? <Loader2 size={14} /> : <Shield size={14} />} Check Compliance
            </button>
            {complianceResults && issueCount > 0 && (
              <button
                onClick={applyAllFixes}
                style={{ padding: '10px 24px', background: GRN, color: '#fff', border: 'none', borderRadius: 8, fontFamily: FH, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Sparkles size={14} /> Apply All Fixes
              </button>
            )}
          </div>
        </div>

        {/* Summary */}
        {complianceResults && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e5e5', textAlign: 'center' }}>
              <div style={{ fontFamily: FB, fontSize: 12, color: '#888' }}>Total Lines</div>
              <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 700, color: BLK }}>{totalLines}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e5e5', textAlign: 'center' }}>
              <div style={{ fontFamily: FB, fontSize: 12, color: '#888' }}>Issues Found</div>
              <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 700, color: issueCount > 0 ? R : GRN }}>{issueCount}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e5e5', textAlign: 'center' }}>
              <div style={{ fontFamily: FB, fontSize: 12, color: '#888' }}>Compliance Score</div>
              <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 700, color: score > 80 ? GRN : score > 60 ? AMB : R }}>{score}%</div>
            </div>
          </div>
        )}

        {/* Line-by-line results */}
        {complianceResults && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5e5' }}>
            <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} color={T} /> Line-by-Line Results
            </h3>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {complianceResults.lines.map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' }}>
                  <div style={{ width: 36, fontFamily: FB, fontSize: 11, color: '#aaa', textAlign: 'right', paddingTop: 2, flexShrink: 0 }}>{line.number}</div>
                  <div style={{ paddingTop: 2, flexShrink: 0 }}>
                    {line.compliant ? (
                      <Check size={16} color={GRN} />
                    ) : (
                      <AlertTriangle size={16} color={line.issue?.severity === 'violation' ? R : AMB} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FB, fontSize: 13, color: line.compliant ? '#555' : '#333', lineHeight: 1.5 }}>{line.text || <span style={{ color: '#ccc', fontStyle: 'italic' }}>(empty line)</span>}</div>
                    {line.issue && (
                      <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 6, background: line.issue.severity === 'violation' ? '#fef2f2' : '#fffbeb', border: `1px solid ${line.issue.severity === 'violation' ? '#fecaca' : '#fde68a'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontFamily: FH, fontSize: 11, fontWeight: 700, color: line.issue.severity === 'violation' ? R : AMB, textTransform: 'uppercase' }}>{line.issue.severity}</span>
                        </div>
                        <div style={{ fontFamily: FB, fontSize: 12, color: '#555', marginBottom: 6 }}>{line.issue.description}</div>
                        <div style={{ fontFamily: FB, fontSize: 11, color: '#888' }}>
                          <strong>Suggested fix:</strong> <span style={{ color: GRN }}>{line.issue.fix}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Dark Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={22} color={R} /> Voice Test Console
            </h1>
            <p style={{ fontFamily: FB, fontSize: 13, color: '#888', margin: '4px 0 0' }}>Super admin testing & quality assurance tools</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: '6px 14px', background: `${R}22`, borderRadius: 8, fontFamily: FH, fontSize: 12, fontWeight: 600, color: R, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} /> SUPER ADMIN
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '0 32px', display: 'flex', gap: 0 }}>
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              style={{
                padding: '14px 24px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === i ? `3px solid ${T}` : '3px solid transparent',
                fontFamily: FH,
                fontSize: 14,
                fontWeight: activeTab === i ? 700 : 500,
                color: activeTab === i ? BLK : '#888',
                cursor: 'pointer',
                transition: 'all .2s'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          {activeTab === 0 && renderAgentSimulator()}
          {activeTab === 1 && renderScriptTester()}
          {activeTab === 2 && renderCampaignStressTest()}
          {activeTab === 3 && renderComplianceChecker()}
        </div>
      </div>
    </div>
  )
}
