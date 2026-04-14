"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import {
  Search, Play, Loader2, ChevronRight, BarChart2, TrendingUp, Users, DollarSign,
  Target, Globe, Star, Phone, MapPin, ExternalLink, AlertCircle, CheckCircle,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Trash2, Clock, FileText,
  Zap, Shield, Eye, Activity, ChevronDown, ChevronUp, Sliders
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../lib/theme'

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
  const { agencyId, agency } = useAuth()
  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

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

          {/* ══════ SCANNING ══════ */}
          {view === 'scanning' && (
            <div style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
              <Loader2 size={48} color={T} style={{ animation: 'spin 1s linear infinite', marginBottom: 20 }} />
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: BLK, marginBottom: 8 }}>Running KotoIntel Scan</div>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>Crawling website, finding competitors, analyzing keywords, building strategy...</div>
              <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${scanProgress}%`, background: T, borderRadius: 4, transition: 'width .3s' }} />
              </div>
              <div style={{ fontSize: 13, color: T, fontWeight: 700, fontFamily: FH }}>{Math.round(scanProgress)}%</div>
            </div>
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

              {/* Industry Benchmarks */}
              {rd.industry_benchmarks && (
                <div style={card}>
                  <div style={sectionTitle}><BarChart2 size={18} color={T} /> Industry Benchmarks — {report?.inputs?.industry || industry}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      ['Avg CPL', `$${rd.industry_benchmarks.avg_cpl}`, DollarSign],
                      ['Avg Close Rate', rd.industry_benchmarks.avg_close_rate, Target],
                      ['Avg Response Time', rd.industry_benchmarks.avg_response_time, Clock],
                      ['Avg Monthly Leads', rd.industry_benchmarks.avg_monthly_leads, Users],
                      ['Avg Reviews', rd.industry_benchmarks.avg_review_count, Star],
                      ['Avg Rating', rd.industry_benchmarks.avg_rating, Star],
                    ].map(([label, value, Icon]) => (
                      <div key={label} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon size={16} color={T} />
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: BLK, fontFamily: FH }}>{value}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FH }}>{label}</div>
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
