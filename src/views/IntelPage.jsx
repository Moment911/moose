"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import {
  Search, Play, Loader2, ChevronRight, BarChart2, TrendingUp, Users, DollarSign,
  Target, Globe, Star, Phone, MapPin, ExternalLink, AlertCircle, CheckCircle,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Trash2, Clock, FileText,
  Zap, Shield, Eye, Activity, ChevronDown, ChevronUp, Sliders, Download, Share2, Brain, Check as CheckIcon2, X as X2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'
import UnifiedCalculator from '../components/intel/UnifiedCalculator'
import DataEnrichmentSections from '../components/intel/DataEnrichmentSections'

// ── Brain teasers for scanning view ────────────────────────────────────────
const BRAIN_TEASERS = [
  { question: 'If 96 out of 100 visitors leave your site without taking action, what\'s your bounce rate?', choices: ['72%', '84%', '96%', '88%'], answer: 2, explanation: 'A 96% bounce rate means only 4 out of 100 visitors engage. Industry average for services is ~65% — above 80% signals a serious problem.' },
  { question: 'A business spends $500 on ads and gets $3,000 in revenue. What\'s the ROI?', choices: ['300%', '500%', '600%', '250%'], answer: 1, explanation: 'ROI = (Revenue - Cost) / Cost × 100. ($3,000 - $500) / $500 = 500%. For every dollar spent, $5 came back.' },
  { question: '75% of users never scroll past page 1 of Google. If you\'re on page 2, what % of searchers miss you?', choices: ['50%', '65%', '75%', '90%'], answer: 2, explanation: '75% never click past page 1. If you\'re not ranking there, three-quarters of potential customers never see you.' },
  { question: 'Responding to a lead in 5 min vs 30 min makes you _x more likely to qualify them.', choices: ['5x', '10x', '21x', '15x'], answer: 2, explanation: 'Harvard found 5-minute responders are 21x more likely to qualify a lead. Speed-to-lead is the most impactful sales metric.' },
  { question: 'What % of consumers read online reviews before making a purchase?', choices: ['78%', '85%', '92%', '68%'], answer: 2, explanation: '92% read reviews before buying. Your Google reviews are a primary decision-making tool for nearly every customer.' },
  { question: 'The average SMB wastes $__K per year on ads that don\'t convert.', choices: ['$8K', '$15K', '$22K', '$10K'], answer: 1, explanation: 'SMBs waste an average $15,000/year on poorly targeted ad spend. Proper tracking can reclaim most of it.' },
  { question: 'For every $1 spent on email marketing, the average return is $__.', choices: ['$12', '$24', '$36', '$44'], answer: 2, explanation: 'Email delivers $36 for every $1 — the highest-ROI digital channel. Yet most SMBs underinvest in their list.' },
  { question: 'What % of local mobile searches result in a store visit within a week?', choices: ['55%', '72%', '88%', '64%'], answer: 2, explanation: '88% of local mobile searches lead to a call or visit within 7 days. Local SEO is your most direct line to revenue.' },
]

function BrainTeaserGame({ progress }) {
  const [idx, setIdx] = useState(0)
  const [sel, setSel] = useState(null)
  const [showExp, setShowExp] = useState(false)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(0)
  const timerRef = useRef(null)
  const t = BRAIN_TEASERS[idx % BRAIN_TEASERS.length]

  function pick(i) {
    if (sel !== null) return
    setSel(i); setShowExp(true); setAnswered(a => a + 1)
    if (i === t.answer) setScore(s => s + 1)
    timerRef.current = setTimeout(() => { setSel(null); setShowExp(false); setIdx(x => x + 1) }, 3500)
  }
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
        <Brain size={28} color={T} />
        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: BLK }}>Marketing Brain Teasers</div>
      </div>
      {answered > 0 && <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, fontFamily: FH }}>{score}/{answered} correct</div>}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '28px 32px', marginBottom: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12, fontFamily: FH }}>Question {(idx % BRAIN_TEASERS.length) + 1} of {BRAIN_TEASERS.length}</div>
        <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, lineHeight: 1.5, marginBottom: 24 }}>{t.question}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {t.choices.map((c, i) => {
            let bg = '#f9fafb', border = '1.5px solid #e5e7eb', tc = BLK
            if (sel !== null) {
              if (i === t.answer) { bg = GRN + '15'; border = `1.5px solid ${GRN}`; tc = GRN }
              else if (i === sel) { bg = R + '15'; border = `1.5px solid ${R}`; tc = R }
            }
            return <button key={i} onClick={() => pick(i)} style={{ padding: '14px 18px', borderRadius: 10, background: bg, border, cursor: sel !== null ? 'default' : 'pointer', fontFamily: FH, fontSize: 16, fontWeight: 800, color: tc, transition: 'all .2s' }}>{c}</button>
          })}
        </div>
        {showExp && (
          <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 10, background: (sel === t.answer ? GRN : R) + '08', border: `1px solid ${sel === t.answer ? GRN : R}20`, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: sel === t.answer ? GRN : R, marginBottom: 4, fontFamily: FH }}>{sel === t.answer ? 'Correct!' : 'Not quite!'}</div>
            <div style={{ fontSize: 13, color: '#374141', lineHeight: 1.6 }}>{t.explanation}</div>
          </div>
        )}
      </div>
      <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Analyzing your market...</div>
      <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: T, borderRadius: 4, transition: 'width .3s' }} />
      </div>
      <div style={{ fontSize: 13, color: T, fontWeight: 700, fontFamily: FH }}>{Math.round(progress)}%</div>
    </div>
  )
}

// ── Score color helper ─────────────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 75) return GRN
  if (s >= 50) return AMB
  return R
}

function ScoreRing({ score, size = 64, stroke = 5, label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = scoreColor(score)
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ marginTop: -size + 8, position: 'relative', height: size - 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FH, fontSize: size * 0.32, fontWeight: 900, color }}>{score}</span>
      </div>
      {label && <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginTop: 4, fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>}
    </div>
  )
}

// ── Pipeline stage card ────────────────────────────────────────────────────
function PipelineStage({ name, score, label }) {
  const color = scoreColor(score)
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '16px 14px', border: `1.5px solid ${color}25`, textAlign: 'center', minWidth: 120 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontFamily: FH }}>{name}</div>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, margin: '0 auto 6px', boxShadow: `0 0 8px ${color}60` }} />
      <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color }}>{score}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}

// ── Metric card ────────────────────────────────────────────────────────────
function MetricCard({ label, value, sublabel, icon: Icon, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 16px', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: (color || T) + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color || T} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: FH }}>{label}</div>
      </div>
      <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: BLK, letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sublabel}</div>
    </div>
  )
}

// ── Lead source row ────────────────────────────────────────────────────────
function LeadSourceRow({ src }) {
  const qualityColors = { 'Very High': GRN, 'High': GRN, 'Medium': AMB, 'Low': R }
  const statusColors = { 'Active': GRN, 'Paying': GRN, 'Underoptimized': AMB, 'Not active': R, 'Absent': R, 'Unstructured': AMB, 'Not running': R }
  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: BLK, fontFamily: FH }}>{src.source}</td>
      <td style={{ padding: '12px 14px', fontSize: 14, fontFamily: FB, textAlign: 'center' }}>{src.monthly_volume}</td>
      <td style={{ padding: '12px 14px', fontSize: 14, fontFamily: FB, textAlign: 'center' }}>${src.cost_per_lead}</td>
      <td style={{ padding: '12px 14px', fontSize: 14, fontFamily: FB, textAlign: 'center' }}>{src.close_rate}</td>
      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: (qualityColors[src.quality] || '#6b7280') + '15', color: qualityColors[src.quality] || '#6b7280' }}>{src.quality}</span>
      </td>
      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: (statusColors[src.status] || '#6b7280') + '15', color: statusColors[src.status] || '#6b7280' }}>{src.status}</span>
      </td>
    </tr>
  )
}

// ── Budget slider ──────────────────────────────────────────────────────────
function BudgetSlider({ reportId, initialBudget, channels, industry, onRecalc }) {
  const [budget, setBudget] = useState(initialBudget || 2000)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const debounceRef = useRef(null)

  async function recalculate(newBudget) {
    setLoading(true)
    try {
      const res = await fetch('/api/intel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate_budget', report_id: reportId, new_budget: newBudget }),
      }).then(r => r.json())
      if (res.budget) { setResult(res.budget); if (onRecalc) onRecalc(res.budget) }
    } catch (e) { toast.error('Budget recalculation failed') }
    setLoading(false)
  }

  function handleSlider(e) {
    const val = parseInt(e.target.value)
    setBudget(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => recalculate(val), 800)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={18} color={T} /> Budget Optimizer
        </div>
        {loading && <Loader2 size={16} color={T} style={{ animation: 'spin 1s linear infinite' }} />}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: FH, fontSize: 42, fontWeight: 900, color: T, letterSpacing: '-.02em' }}>
          ${budget.toLocaleString()}<span style={{ fontSize: 16, color: '#9ca3af', fontWeight: 600 }}>/mo</span>
        </div>
      </div>

      <input type="range" min={0} max={20000} step={250} value={budget} onChange={handleSlider}
        style={{ width: '100%', height: 8, borderRadius: 4, appearance: 'none', background: `linear-gradient(to right, ${T} ${budget/200}%, #e5e7eb ${budget/200}%)`, cursor: 'pointer', marginBottom: 8 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', fontFamily: FH }}>
        <span>$0</span><span>$5K</span><span>$10K</span><span>$15K</span><span>$20K</span>
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 10 }}>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: T }}>{result.total_projected_leads || '—'}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FH }}>Projected Leads</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 10 }}>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: T }}>${result.blended_cpl || '—'}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FH }}>Blended CPL</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 10 }}>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: GRN }}>{result.roi_projection || '—'}x</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FH }}>Projected ROI</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 10 }}>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: GRN }}>${(result.revenue_projection || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontFamily: FH }}>Revenue Projection</div>
            </div>
          </div>

          {result.spend_by_channel && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, fontFamily: FH }}>Channel Allocation</div>
              {result.spend_by_channel.map((ch, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>{ch.channel}</div>
                  <div style={{ fontSize: 13, color: T, fontWeight: 700, fontFamily: FH, width: 80, textAlign: 'right' }}>${ch.recommended?.toLocaleString()}</div>
                  <div style={{ width: 120, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (ch.recommended / budget) * 100)}%`, background: T, borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: GRN, fontWeight: 700, width: 70, textAlign: 'right' }}>{ch.projected_leads} leads</div>
                </div>
              ))}
            </div>
          )}

          {result.summary && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: T + '08', borderRadius: 10, border: `1px solid ${T}20`, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              {result.summary}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function IntelPage() {
  const navigate = useNavigate()
  const { reportId } = useParams()
  const [searchParams] = useSearchParams()
  const { agencyId, agency } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'
  const clientIdParam = searchParams.get('client_id')

  // ── State ──────────────────────────────────────────────────────────────
  const [view, setView] = useState(reportId ? 'report' : 'home')
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [report, setReport] = useState(null)
  const [reports, setReports] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Form
  const [businessName, setBusinessName] = useState('')
  const [website, setWebsite] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [avgJobValue, setAvgJobValue] = useState('')
  const [leadSources, setLeadSources] = useState('')
  const [leadGoal, setLeadGoal] = useState('10-25 leads/mo')

  // ── Load history ───────────────────────────────────────────────────────
  useEffect(() => { loadHistory() }, [aid])

  useEffect(() => {
    if (reportId && view !== 'report') {
      loadReport(reportId)
    }
  }, [reportId])

  // Pre-fill form from client record when navigated with ?client_id=
  useEffect(() => {
    if (!clientIdParam) return
    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_client_full', client_id: clientIdParam }),
    })
      .then(r => r.json())
      .then(res => {
        if (!res.client) return
        const c = res.client
        const answers = c.onboarding_answers || {}
        setBusinessName(c.name || '')
        setWebsite(c.website || '')
        setIndustry(c.industry || '')
        setLocation([c.city, c.state].filter(Boolean).join(', '))
        setBudget(c.marketing_budget || answers.budget_for_agency || '')
        if (c.primary_service) setLeadSources(c.primary_service)
      })
      .catch(() => {})
  }, [clientIdParam])

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/intel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_reports', agency_id: aid }),
      }).then(r => r.json())
      setReports(res.reports || [])
    } catch { setReports([]) }
    setLoadingHistory(false)
  }

  async function loadReport(id) {
    const res = await fetch('/api/intel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_report', report_id: id }),
    }).then(r => r.json())
    if (res.report) {
      setReport(res.report)
      setView('report')
    }
  }

  // ── Run scan ───────────────────────────────────────────────────────────
  async function runScan() {
    if (!businessName || !location) { toast.error('Business name and location are required'); return }
    setScanning(true)
    setScanProgress(0)
    setView('scanning')

    // Fake progress while real scan runs
    const interval = setInterval(() => {
      setScanProgress(p => Math.min(p + Math.random() * 3, 92))
    }, 500)

    try {
      const res = await fetch('/api/intel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_scan', agency_id: aid,
          business_name: businessName, website, industry, location,
          budget, avg_job_value: avgJobValue, current_lead_sources: leadSources, monthly_lead_goal: leadGoal,
        }),
      }).then(r => r.json())

      clearInterval(interval)
      setScanProgress(100)

      if (res.error) { toast.error(res.error); setView('home'); setScanning(false); return }
      setReport({ id: res.report?.id, report_data: res.report, inputs: { business_name: businessName, website, industry, location, budget, avg_job_value: avgJobValue } })
      setView('report')
      loadHistory()
    } catch (e) {
      clearInterval(interval)
      toast.error('Scan failed: ' + e.message)
      setView('home')
    }
    setScanning(false)
  }

  async function deleteReport(id) {
    if (!confirm('Delete this report?')) return
    await fetch('/api/intel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_report', report_id: id }),
    })
    toast.success('Report deleted')
    loadHistory()
    if (report?.id === id) { setReport(null); setView('home') }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }
  const sectionTitle = { fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }
  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, fontFamily: FH }

  const rd = report?.report_data || report || {}

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY, fontFamily: FB }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: FH }}>Multi-Agent Intelligence Report</div>
            <h1 style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: BLK, margin: 0, letterSpacing: '-.03em' }}>KotoIntel</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {view === 'report' && report?.id && (
              <>
                <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/intel/public/' + report.id); toast.success('Share link copied!') }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${T}40`, background: '#fff', color: T, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Share2 size={13} /> Share
                </button>
                <button onClick={() => window.print()}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Download size={13} /> PDF
                </button>
              </>
            )}
            <button onClick={() => { setView('home'); setReport(null) }}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FH }}>
              + New Scan
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {/* ══════ HOME — Input form + History ══════ */}
          {view === 'home' && (
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <div style={card}>
                <div style={sectionTitle}><Search size={18} color={T} /> Report Inputs — populate before running</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Business name</label>
                    <input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Apex Plumbing" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Industry / trade</label>
                    <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Plumbing / home services" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Primary market</label>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Columbus, OH metro" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Website URL</label>
                    <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="e.g. apexplumbing.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Avg job / deal value</label>
                    <input value={avgJobValue} onChange={e => setAvgJobValue(e.target.value)} placeholder="e.g. $350 service / $8,500 install" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Monthly budget</label>
                    <input value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. $2,000" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>Current lead sources</label>
                    <input value={leadSources} onChange={e => setLeadSources(e.target.value)} placeholder="e.g. Google, Angi, referrals" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Monthly lead goal</label>
                    <select value={leadGoal} onChange={e => setLeadGoal(e.target.value)}
                      style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                      <option>5-10 leads/mo</option>
                      <option>10-25 leads/mo</option>
                      <option>25-50 leads/mo</option>
                      <option>50-100 leads/mo</option>
                      <option>100+ leads/mo</option>
                    </select>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16, fontStyle: 'italic' }}>
                  These inputs define what the agents audit. This triggers the full research and output stack automatically.
                </div>
                <button onClick={runScan} disabled={scanning || !businessName || !location}
                  style={{ padding: '12px 32px', borderRadius: 10, border: 'none', background: businessName && location ? R : '#e5e7eb', color: '#fff', fontSize: 15, fontWeight: 800, cursor: businessName && location ? 'pointer' : 'not-allowed', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '.02em' }}>
                  <Play size={16} /> Run KotoIntel Scan
                </button>
              </div>

              {/* History */}
              <div style={card}>
                <div style={sectionTitle}><Clock size={18} color={R} /> Report History</div>
                {loadingHistory ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
                ) : reports.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No reports yet. Run your first scan above.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {reports.map(r => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}
                        onClick={() => loadReport(r.id)}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === 'complete' ? GRN : r.status === 'running' ? AMB : R }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: BLK, fontFamily: FH }}>{r.inputs?.business_name || 'Unnamed'}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.inputs?.industry} · {r.inputs?.location} · {new Date(r.created_at).toLocaleDateString()}</div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteReport(r.id) }}
                          style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', opacity: 0.5 }}>
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={16} color="#9ca3af" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════ SCANNING — Brain Teasers ══════ */}
          {view === 'scanning' && (
            <BrainTeaserGame progress={scanProgress} />
          )}

          {/* ══════ REPORT ══════ */}
          {view === 'report' && rd && (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              {/* Report header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: FH, marginBottom: 4 }}>
                  Multi-Agent Intelligence Report · Lead Generation
                </div>
                <h2 style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: BLK, margin: 0, letterSpacing: '-.03em' }}>
                  Lead pipeline audit & generation strategy
                </h2>
                <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
                  {report?.inputs?.business_name || businessName} · {report?.inputs?.industry || industry} · {report?.inputs?.location || location} · {new Date().toLocaleDateString()}
                </div>
              </div>

              {/* Executive Summary */}
              {rd.executive_summary && (
                <div style={{ ...card, borderLeft: `4px solid ${T}`, background: `${T}04` }}>
                  <div style={sectionTitle}><Zap size={18} color={T} /> Executive Summary</div>
                  <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, margin: 0 }}>{rd.executive_summary}</p>
                </div>
              )}

              {/* 01 — Pipeline Diagnostic */}
              {rd.pipeline_scores && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: R }}>01</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Pipeline diagnostic agent</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Current lead volume · source breakdown · leakage points · cost per lead baseline</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    {Object.entries(rd.pipeline_scores).map(([key, val]) => (
                      <PipelineStage key={key} name={key.replace('_', ' / ')} score={val.score} label={val.label} />
                    ))}
                  </div>
                  {rd.metrics && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <MetricCard label="Est. monthly leads" value={rd.metrics.est_monthly_leads?.value || '—'} sublabel={rd.metrics.est_monthly_leads?.label} icon={Users} color={T} />
                      <MetricCard label="Avg cost per lead" value={`$${rd.metrics.avg_cost_per_lead?.value || '—'}`} sublabel={rd.metrics.avg_cost_per_lead?.label} icon={DollarSign} color={AMB} />
                      <MetricCard label="Lead-to-close rate" value={rd.metrics.lead_to_close_rate?.value || '—'} sublabel={rd.metrics.lead_to_close_rate?.label} icon={Target} color={GRN} />
                      <MetricCard label="Response time avg" value={rd.metrics.response_time_avg?.value || '—'} sublabel={rd.metrics.response_time_avg?.label} icon={Clock} color={R} />
                      <MetricCard label="Referral % of leads" value={rd.metrics.referral_pct?.value || '—'} sublabel={rd.metrics.referral_pct?.label} icon={Users} color={T} />
                      <MetricCard label="Repeat customer rate" value={rd.metrics.repeat_customer_rate?.value || '—'} sublabel={rd.metrics.repeat_customer_rate?.label} icon={RefreshCw} color={GRN} />
                    </div>
                  )}
                </div>
              )}

              {/* 02 — Lead Source Intelligence */}
              {rd.lead_sources && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: T + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: T }}>02</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Lead source intelligence agent</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Active channels · cost efficiency · quality scoring · untapped sources</div>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          {['Lead source', 'Monthly volume', 'Cost per lead', 'Close rate', 'Lead quality', 'Current status'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, textAlign: h === 'Lead source' ? 'left' : 'center' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rd.lead_sources.map((src, i) => <LeadSourceRow key={i} src={src} />)}
                      </tbody>
                    </table>
                  </div>

                  {rd.critical_finding && (
                    <div style={{ marginTop: 20, padding: '16px 20px', borderRadius: 12, background: R + '08', borderLeft: `4px solid ${R}` }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: R, color: '#fff', marginRight: 8 }}>Critical</span>
                      <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>{rd.critical_finding.title}</span>
                      <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '8px 0 0' }}>{rd.critical_finding.detail}</p>
                    </div>
                  )}

                  {rd.top_opportunity && (
                    <div style={{ marginTop: 12, padding: '16px 20px', borderRadius: 12, background: GRN + '08', borderLeft: `4px solid ${GRN}` }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: GRN, color: '#fff', marginRight: 8 }}>Opportunity</span>
                      <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>{rd.top_opportunity.title}</span>
                      <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '8px 0 0' }}>{rd.top_opportunity.detail}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 03 — Competitor Intel */}
              {rd.competitors && rd.competitors.length > 0 && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: GRN + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: GRN }}>03</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Local market & competitor intelligence</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>How competitors generate leads · their volume estimates · their gaps · your opening</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {rd.competitors.map((c, i) => (
                      <div key={i} style={{ padding: 16, borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: BLK, fontFamily: FH, marginBottom: 4 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={10} /> {c.address?.split(',')[0]}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Star size={12} color={AMB} fill={AMB} />
                            <span style={{ fontSize: 14, fontWeight: 800, color: BLK }}>{c.rating}</span>
                          </div>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>({c.reviews} reviews)</span>
                        </div>
                        {c.mapsUrl && (
                          <a href={c.mapsUrl} target="_blank" rel="noopener" style={{ fontSize: 11, color: T, display: 'flex', alignItems: 'center', gap: 3, marginTop: 8, textDecoration: 'none' }}>
                            <ExternalLink size={10} /> View on Maps
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                  {rd.competitor_analysis && (
                    <div style={{ marginTop: 16, padding: '14px 18px', background: '#f9fafb', borderRadius: 10, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                      {rd.competitor_analysis.summary}
                    </div>
                  )}
                </div>
              )}

              {/* 03b — Sitemap Comparison & Content Gaps */}
              {(rd.sitemap || rd.content_gaps) && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7c3aed15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: '#7c3aed' }}>03b</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Content & sitemap analysis</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Your pages vs competitor pages · content gaps · missing opportunities</div>
                    </div>
                  </div>

                  {/* Sitemap comparison table */}
                  {rd.sitemap && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: FH }}>Page Count by Category</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                              <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', fontFamily: FH, textAlign: 'left' }}>Category</th>
                              <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', fontFamily: FH, textAlign: 'center' }}>You</th>
                              {rd.sitemap.competitors && Object.keys(rd.sitemap.competitors).map(name => (
                                <th key={name} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', fontFamily: FH, textAlign: 'center', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {['services', 'locations', 'blog', 'about', 'contact', 'landing', 'other'].map(cat => {
                              const clientCount = rd.sitemap.client?.categories?.[cat]?.length || (typeof rd.sitemap.client?.categories?.[cat] === 'number' ? rd.sitemap.client.categories[cat] : 0)
                              return (
                                <tr key={cat} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH, textTransform: 'capitalize' }}>{cat}</td>
                                  <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 900, color: T, fontFamily: FH, textAlign: 'center' }}>{clientCount}</td>
                                  {rd.sitemap.competitors && Object.entries(rd.sitemap.competitors).map(([name, data]) => {
                                    const count = data?.categories?.[cat] || 0
                                    const isMore = count > clientCount
                                    return (
                                      <td key={name} style={{ padding: '10px 12px', fontSize: 14, fontWeight: 700, color: isMore ? R : '#6b7280', fontFamily: FH, textAlign: 'center' }}>
                                        {count} {isMore && <ArrowUpRight size={10} style={{ display: 'inline' }} />}
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                            <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                              <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 900, color: BLK, fontFamily: FH }}>Total Pages</td>
                              <td style={{ padding: '10px 12px', fontSize: 16, fontWeight: 900, color: T, fontFamily: FH, textAlign: 'center' }}>{rd.sitemap.client?.total || 0}</td>
                              {rd.sitemap.competitors && Object.entries(rd.sitemap.competitors).map(([name, data]) => (
                                <td key={name} style={{ padding: '10px 12px', fontSize: 16, fontWeight: 900, color: (data?.total || 0) > (rd.sitemap.client?.total || 0) ? R : '#6b7280', fontFamily: FH, textAlign: 'center' }}>
                                  {data?.total || 0}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Content gaps */}
                  {rd.content_gaps && rd.content_gaps.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: FH }}>Content Gaps Identified</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {rd.content_gaps.map((gap, i) => {
                          const gColor = gap.priority === 'high' ? R : gap.priority === 'medium' ? AMB : '#6b7280'
                          const typeLabels = { missing_service_page: 'Missing Service Page', missing_location_page: 'Missing Location Page', missing_blog: 'Missing Blog Content', missing_faq: 'Missing FAQ', missing_landing_page: 'Missing Landing Page', weak_content: 'Weak Content' }
                          return (
                            <div key={i} style={{ padding: '14px 18px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: `4px solid ${gColor}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: gColor + '15', color: gColor, textTransform: 'uppercase' }}>{gap.priority}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#7c3aed12', padding: '2px 8px', borderRadius: 4 }}>{typeLabels[gap.type] || gap.type}</span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: BLK, fontFamily: FH, marginBottom: 4 }}>{gap.title}</div>
                              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{gap.detail}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 04 — PageSpeed */}
              {rd.page_speed && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: AMB + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: AMB }}>04</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Website performance audit</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Google PageSpeed scores · Core Web Vitals · mobile experience</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 20 }}>
                    <ScoreRing score={rd.page_speed.performance || 0} label="Performance" />
                    <ScoreRing score={rd.page_speed.seo || 0} label="SEO" />
                    <ScoreRing score={rd.page_speed.accessibility || 0} label="Accessibility" />
                    <ScoreRing score={rd.page_speed.bestPractices || 0} label="Best Practices" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[['FCP', rd.page_speed.fcp], ['LCP', rd.page_speed.lcp], ['TBT', rd.page_speed.tbt], ['CLS', rd.page_speed.cls], ['Speed Index', rd.page_speed.speedIndex], ['TTI', rd.page_speed.tti]].map(([k, v]) => (
                      <div key={k} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: BLK, fontFamily: FH }}>{v || 'N/A'}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FH }}>{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 04b — Tech Stack & Marketing Infrastructure */}
              {rd.tech_stack?.length > 0 && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: T + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: T }}>04b</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Marketing tech stack</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Tools detected on your website — verified from source code scan</div>
                    </div>
                    {rd.tech_stack_assessment?.grade && (
                      <div style={{ marginLeft: 'auto', fontFamily: FH, fontSize: 28, fontWeight: 900, color: { A: GRN, B: GRN, C: AMB, D: R, F: R }[rd.tech_stack_assessment.grade] || BLK }}>
                        {rd.tech_stack_assessment.grade}
                      </div>
                    )}
                  </div>

                  {rd.tech_stack_assessment?.summary && (
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 20, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                      {rd.tech_stack_assessment.summary}
                    </div>
                  )}

                  {/* Category badges */}
                  {(() => {
                    const cats = { analytics: '📊', tag_manager: '🏷️', chat_widget: '💬', crm: '🔗', ad_pixel: '📡', seo: '🔍', booking: '📅', email_marketing: '📧', cdn_hosting: '🌐', conversion: '🎯', social: '📱', other: '⚙️' }
                    const catLabels = { analytics: 'Analytics', tag_manager: 'Tag Managers', chat_widget: 'Chat & Messaging', crm: 'CRM & Automation', ad_pixel: 'Ad Pixels & Tracking', seo: 'SEO', booking: 'Booking & Scheduling', email_marketing: 'Email Marketing', cdn_hosting: 'Platform & CDN', conversion: 'Conversion & Forms', social: 'Social', other: 'Other Tools' }
                    const grouped = {}
                    rd.tech_stack.forEach(t => { if (!grouped[t.category]) grouped[t.category] = []; grouped[t.category].push(t) })
                    return Object.entries(grouped).map(([cat, tools]) => (
                      <div key={cat} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontFamily: FH }}>
                          {cats[cat] || '⚙️'} {catLabels[cat] || cat}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {tools.map((tool, i) => (
                            <div key={i} style={{ padding: '8px 14px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{tool.name}</div>
                                <div style={{ fontSize: 11, color: '#6b7280' }}>{tool.evidence}</div>
                              </div>
                              {tool.verification_url && (
                                <a href={tool.verification_url} target="_blank" rel="noopener noreferrer" style={{ color: T, fontSize: 11, textDecoration: 'none', flexShrink: 0 }}>↗</a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}

                  {/* Missing critical tools */}
                  {rd.tech_stack_assessment?.missing_critical?.length > 0 && (
                    <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 8, background: R + '08', border: `1.5px solid ${R}20` }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, fontFamily: FH }}>Missing critical tools</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {rd.tech_stack_assessment.missing_critical.map((tool, i) => (
                          <span key={i} style={{ padding: '4px 12px', borderRadius: 6, background: R + '12', color: R, fontSize: 12, fontWeight: 600 }}>{tool}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence notes */}
                  {rd.tech_stack_assessment?.confidence_notes && (
                    <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', fontStyle: 'italic', lineHeight: 1.5 }}>
                      {rd.tech_stack_assessment.confidence_notes}
                    </div>
                  )}
                </div>
              )}

              {/* 04c — Domain Authority & Backlink Profile (Moz) */}
              {rd.moz_data && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: R }}>04c</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Domain authority & backlinks</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Moz Link Explorer — how search engines see your site's authority vs competitors</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: FH, fontSize: 42, fontWeight: 900, color: rd.moz_data.domain_authority >= 40 ? GRN : rd.moz_data.domain_authority >= 20 ? AMB : R, lineHeight: 1 }}>
                        {rd.moz_data.domain_authority}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Domain Authority</div>
                    </div>
                  </div>

                  {/* Client metrics row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                    {[
                      ['Page Authority', rd.moz_data.page_authority, rd.moz_data.page_authority >= 30 ? GRN : rd.moz_data.page_authority >= 15 ? AMB : R],
                      ['Spam Score', rd.moz_data.spam_score + '%', rd.moz_data.spam_score <= 5 ? GRN : rd.moz_data.spam_score <= 30 ? AMB : R],
                      ['Linking Domains', rd.moz_data.linking_root_domains?.toLocaleString(), T],
                      ['Total Backlinks', rd.moz_data.external_backlinks?.toLocaleString(), T],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* DA comparison bars — client vs competitors */}
                  {rd.moz_competitors?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, fontFamily: FH }}>
                        Domain Authority Comparison
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Client bar first */}
                        {(() => {
                          const maxDA = Math.max(rd.moz_data.domain_authority, ...rd.moz_competitors.map(c => c.domain_authority))
                          const allBars = [
                            { name: rd.moz_data.domain ? rd.moz_data.domain : 'You', da: rd.moz_data.domain_authority, links: rd.moz_data.linking_root_domains, isClient: true },
                            ...rd.moz_competitors.map(c => ({ name: c.name, da: c.domain_authority, links: c.linking_root_domains, isClient: false }))
                          ].sort((a, b) => b.da - a.da)

                          return allBars.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 140, fontSize: 12, fontWeight: item.isClient ? 800 : 500, color: item.isClient ? BLK : '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.isClient ? '★ ' : ''}{item.name}
                              </div>
                              <div style={{ flex: 1, height: 28, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                                <div style={{
                                  width: `${maxDA > 0 ? (item.da / maxDA) * 100 : 0}%`,
                                  height: '100%',
                                  background: item.isClient
                                    ? `linear-gradient(90deg, ${R}, ${R}cc)`
                                    : `linear-gradient(90deg, ${T}60, ${T}30)`,
                                  borderRadius: 6,
                                  transition: 'width .6s ease',
                                  minWidth: item.da > 0 ? 24 : 0,
                                }} />
                                <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 800, color: item.isClient ? '#fff' : BLK, fontFamily: FH }}>
                                  {item.da}
                                </div>
                              </div>
                              <div style={{ width: 80, fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
                                {item.links?.toLocaleString()} links
                              </div>
                            </div>
                          ))
                        })()}
                      </div>

                      {/* DA context */}
                      <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                        <div style={{ fontSize: 12, color: '#0c4a6e', lineHeight: 1.6 }}>
                          <strong>What this means:</strong> Domain Authority predicts how well a site will rank on Google. DA 1-20 = new/weak, 20-40 = developing, 40-60 = strong, 60+ = authoritative.
                          {rd.moz_data.domain_authority < rd.moz_competitors?.[0]?.domain_authority && (
                            <span> Your DA of <strong>{rd.moz_data.domain_authority}</strong> is below your top competitor at <strong>{rd.moz_competitors.sort((a, b) => b.domain_authority - a.domain_authority)[0].domain_authority}</strong> — link building and content strategy can close this gap.</span>
                          )}
                          {rd.moz_data.spam_score > 30 && (
                            <span style={{ color: R }}> <strong>Warning:</strong> Your spam score of {rd.moz_data.spam_score}% is high — this could hurt rankings. A backlink audit is recommended.</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>Source: Moz Link Explorer API v2</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 04d — GBP Audit */}
              {rd.gbp_audit && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: AMB + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: AMB }}>04d</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Google Business Profile audit</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Your GBP listing completeness — verified via Google Places API</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: FH, fontSize: 42, fontWeight: 900, color: rd.gbp_audit.audit.score >= 80 ? GRN : rd.gbp_audit.audit.score >= 60 ? AMB : R, lineHeight: 1 }}>
                        {rd.gbp_audit.audit.score}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>GBP Score</div>
                    </div>
                  </div>

                  {/* GBP key metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      ['Rating', rd.gbp_audit.rating ? `${rd.gbp_audit.rating}★` : 'N/A', rd.gbp_audit.rating >= 4.0 ? GRN : rd.gbp_audit.rating >= 3.0 ? AMB : R],
                      ['Reviews', rd.gbp_audit.review_count?.toLocaleString() || '0', rd.gbp_audit.review_count >= 50 ? GRN : rd.gbp_audit.review_count >= 10 ? AMB : R],
                      ['Photos', rd.gbp_audit.photo_count || '0', rd.gbp_audit.photo_count >= 10 ? GRN : rd.gbp_audit.photo_count >= 5 ? AMB : R],
                      ['Status', rd.gbp_audit.business_status === 'OPERATIONAL' ? 'Active' : rd.gbp_audit.business_status || 'Unknown', rd.gbp_audit.business_status === 'OPERATIONAL' ? GRN : R],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Passes */}
                  {rd.gbp_audit.audit.passes?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {rd.gbp_audit.audit.passes.map((p, i) => (
                        <span key={i} style={{ padding: '4px 10px', borderRadius: 6, background: GRN + '12', color: GRN, fontSize: 11, fontWeight: 600 }}>✓ {p}</span>
                      ))}
                    </div>
                  )}

                  {/* Fails with fix suggestions */}
                  {rd.gbp_audit.audit.fails?.length > 0 && (
                    <div style={{ padding: '14px 18px', borderRadius: 8, background: R + '06', border: `1px solid ${R}15` }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: FH }}>Needs attention</div>
                      {rd.gbp_audit.audit.fails.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                          <span style={{ color: R, fontSize: 12, flexShrink: 0 }}>✕</span>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{f.label}</span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}> — {f.fix}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent reviews preview */}
                  {rd.gbp_audit.recent_reviews?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, fontFamily: FH }}>Recent Reviews</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {rd.gbp_audit.recent_reviews.slice(0, 3).map((r, i) => (
                          <div key={i} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, borderLeft: `3px solid ${r.rating >= 4 ? GRN : r.rating >= 3 ? AMB : R}` }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: r.rating >= 4 ? GRN : r.rating >= 3 ? AMB : R }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                            {r.text && <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, marginTop: 4 }}>{r.text}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 12, fontSize: 10, color: '#9ca3af' }}>Source: Google Places API (New) — verified GBP listing data</div>
                </div>
              )}

              {/* 04e — Real User Speed (CrUX) */}
              {rd.crux_data && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: GRN + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: GRN }}>04e</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Real user speed data</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Chrome UX Report — actual speed measurements from real visitors (75th percentile, mobile)</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      ['LCP', rd.crux_data.lcp_ms, 'ms', 2500, 4000, 'Largest Contentful Paint'],
                      ['FCP', rd.crux_data.fcp_ms, 'ms', 1800, 3000, 'First Contentful Paint'],
                      ['INP', rd.crux_data.inp_ms, 'ms', 200, 500, 'Interaction to Next Paint'],
                      ['CLS', rd.crux_data.cls, '', 0.1, 0.25, 'Cumulative Layout Shift'],
                      ['TTFB', rd.crux_data.ttfb_ms, 'ms', 800, 1800, 'Time to First Byte'],
                      ['FID', rd.crux_data.fid_ms, 'ms', 100, 300, 'First Input Delay'],
                    ].filter(([,v]) => v != null).map(([label, val, unit, good, poor, full]) => {
                      const color = unit === '' ? (val <= good ? GRN : val <= poor ? AMB : R) : (val <= good ? GRN : val <= poor ? AMB : R)
                      return (
                        <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>
                            {unit === 'ms' ? (val >= 1000 ? `${(val/1000).toFixed(1)}s` : `${Math.round(val)}ms`) : (typeof val === 'number' ? val.toFixed(2) : val)}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginTop: 4, fontFamily: FH }}>{label}</div>
                          <div style={{ fontSize: 9, color: '#d1d5db', marginTop: 2 }}>{full}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 11, color: '#166534', lineHeight: 1.5 }}>
                    This data is from <strong>real Chrome users</strong> visiting your site — more accurate than lab tests. Green = good, amber = needs work, red = hurting conversions.
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10, color: '#9ca3af' }}>Source: {rd.crux_data.source}</div>
                </div>
              )}

              {/* 04f — Data Sources Badge */}
              {rd.data_enrichment_sources?.length > 0 && (
                <div style={{ padding: '12px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontFamily: FH }}>
                    Verified Data Sources ({rd.data_enrichment_sources.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {rd.data_enrichment_sources.map((src, i) => (
                      <span key={i} style={{ padding: '3px 10px', borderRadius: 5, background: '#fff', border: '1px solid #e5e7eb', fontSize: 10, color: '#6b7280', fontWeight: 500 }}>{src}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Security, Email Auth, Schema, Social, Carbon, W3C, Domain, Files, Knowledge Graph */}
              {rd && <DataEnrichmentSections rd={rd} />}

              {/* 05 — Budget Optimizer */}
              {report?.id && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: T + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: T }}>05</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Budget optimizer</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Drag the slider to see projected leads at any budget level</div>
                    </div>
                  </div>
                  <BudgetSlider
                    reportId={report.id}
                    initialBudget={parseInt(String(report?.inputs?.budget || budget || '2000').replace(/\D/g, '')) || 2000}
                    industry={report?.inputs?.industry || industry}
                  />
                </div>
              )}

              {/* 05b — Unified ROI Calculator Suite */}
              {rd && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: GRN + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: GRN }}>05b</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>ROI Calculator Suite</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Three interactive calculators — Maps ROI, Ads Budget, PPC Efficiency — powered by your data</div>
                    </div>
                  </div>
                  <UnifiedCalculator reportData={rd} reportInputs={report?.inputs} />
                </div>
              )}

              {/* 06 — Recommendations */}
              {rd.recommendations && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: R + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontSize: 12, fontWeight: 900, color: R }}>06</div>
                    <div>
                      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK }}>Action plan</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Prioritized recommendations with expected impact</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rd.recommendations.map((rec, i) => {
                      const pColor = rec.priority === 'high' ? R : rec.priority === 'medium' ? AMB : '#6b7280'
                      return (
                        <div key={i} style={{ padding: '16px 20px', borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: `4px solid ${pColor}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: pColor + '15', color: pColor, textTransform: 'uppercase' }}>{rec.priority}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af' }}>{rec.timeline}</span>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: BLK, fontFamily: FH, marginBottom: 4 }}>{rec.title}</div>
                          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{rec.detail}</div>
                          {rec.expected_impact && (
                            <div style={{ fontSize: 12, color: GRN, fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <ArrowUpRight size={12} /> {rec.expected_impact}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Industry Benchmarks with Sources */}
              {rd.industry_benchmarks && (
                <div style={card}>
                  <div style={sectionTitle}><BarChart2 size={18} color={T} /> Industry Benchmarks — {report?.inputs?.industry || industry}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      ['Avg CPL', rd.industry_benchmarks.avg_cpl, DollarSign, '$'],
                      ['Avg Close Rate', rd.industry_benchmarks.avg_close_rate, Target, ''],
                      ['Avg Response Time', rd.industry_benchmarks.avg_response_time, Clock, ''],
                      ['Avg Monthly Leads', rd.industry_benchmarks.avg_monthly_leads, Users, ''],
                      ['Avg Reviews', rd.industry_benchmarks.avg_review_count, Star, ''],
                      ['Avg Rating', rd.industry_benchmarks.avg_rating, Star, ''],
                    ].map(([label, data, Icon, prefix]) => {
                      const val = typeof data === 'object' ? data.value : data
                      const src = typeof data === 'object' ? data.source : null
                      return (
                        <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Icon size={16} color={T} />
                            <div style={{ fontSize: 18, fontWeight: 900, color: BLK, fontFamily: FH }}>{prefix}{val}</div>
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FH }}>{label}</div>
                          {src && <div style={{ fontSize: 10, color: T, marginTop: 4, fontStyle: 'italic' }}>{src}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Data Sources & Citations */}
              {rd.data_sources && rd.data_sources.length > 0 && (
                <div style={card}>
                  <div style={sectionTitle}><Shield size={18} color={'#6b7280'} /> Data Sources & Citations</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                    Every metric in this report is sourced from industry research. Use these in client conversations to support your recommendations.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rd.data_sources.map((ds, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: '#f9fafb', borderRadius: 10, border: '1px solid #f3f4f6' }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: T + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 900, color: T }}>{i + 1}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: BLK, fontFamily: FH }}>{ds.metric}</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: T, fontFamily: FH, margin: '2px 0' }}>{ds.value}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            <span style={{ fontWeight: 700 }}>{ds.source}</span>
                            {ds.year && <span> ({ds.year})</span>}
                          </div>
                          {ds.context && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{ds.context}</div>}
                          {ds.url && (
                            <a href={ds.url} target="_blank" rel="noopener" style={{ fontSize: 11, color: T, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4, textDecoration: 'none' }}>
                              <ExternalLink size={10} /> View source
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
