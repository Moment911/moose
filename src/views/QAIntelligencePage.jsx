"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Brain, TrendingUp, BarChart2, MessageSquare, Target,
  Edit2, Flag, Check, X, ChevronRight, ChevronDown, Plus, Loader2,
  AlertTriangle, Star, Zap, RefreshCw, ArrowUpRight, Award, Clock,
  Upload, Download, FileDown, CheckSquare, Square, Trash2
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { generateQATemplateCSV, EXPERT_QA_SEED_DATA, QA_TYPE_OPTIONS } from '../data/qaImportTemplate'

const R   = '#ea2729'
const T   = '#5bc6d0'
const BLK = '#0a0a0a'
const GRY = '#f2f2f0'
const W   = '#ffffff'
const GRN = '#16a34a'
const AMB = '#f59e0b'
const FH  = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB  = "'Raleway','Helvetica Neue',sans-serif"

const API = '/api/qa-intelligence'

async function api(action, params = {}) {
  const url = new URL(API, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString())
  return res.json()
}

async function apiPost(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

const QUESTION_TYPES = [
  { key: '', label: 'All' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'objection', label: 'Objection' },
  { key: 'closing', label: 'Closing' },
  { key: 'price', label: 'Price' },
  { key: 'timing', label: 'Timing' },
  { key: 'competitor', label: 'Competitor' },
  { key: 'situational', label: 'Situational' },
]

const SORT_OPTIONS = [
  { key: 'most_asked', label: 'Most Asked' },
  { key: 'best_rate', label: 'Best Rate' },
  { key: 'worst_rate', label: 'Worst Rate' },
  { key: 'newest', label: 'Newest' },
]

const TYPE_COLORS = {
  discovery: { bg: '#dbeafe', color: '#1d4ed8' },
  objection: { bg: '#fef2f2', color: R },
  closing: { bg: '#dcfce7', color: GRN },
  price: { bg: '#fef3c7', color: AMB },
  timing: { bg: '#f3e8ff', color: '#7c3aed' },
  competitor: { bg: '#fce7f3', color: '#be185d' },
  situational: { bg: '#f0fdfa', color: '#0d9488' },
  clarification: { bg: '#f1f5f9', color: '#475569' },
  personal: { bg: '#fff7ed', color: '#c2410c' },
}

const ANSWER_TYPE_COLORS = {
  acceptance: { bg: '#dcfce7', color: GRN },
  commitment: { bg: '#d1fae5', color: '#059669' },
  interest: { bg: '#dbeafe', color: '#2563eb' },
  question: { bg: '#fef3c7', color: AMB },
  deflection: { bg: '#f3f4f6', color: '#6b7280' },
  objection: { bg: '#fef2f2', color: R },
  neutral: { bg: '#f1f5f9', color: '#64748b' },
}

function TypeBadge({ type, map }) {
  const c = (map || TYPE_COLORS)[type] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, fontFamily: FB, textTransform: 'uppercase',
      letterSpacing: '.05em', background: c.bg, color: c.color,
    }}>
      {type || 'unknown'}
    </span>
  )
}

function RateBar({ rate, height = 6 }) {
  const color = rate >= 50 ? GRN : rate >= 25 ? AMB : R
  return (
    <div style={{ width: '100%', height, borderRadius: 99, background: '#e5e7eb', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, rate)}%`, height: '100%', borderRadius: 99, background: color, transition: 'width .3s' }} />
    </div>
  )
}

function StatBox({ label, value, sub, accent = T }) {
  return (
    <div style={{
      flex: 1, minWidth: 120, padding: '14px 16px', background: W, borderRadius: 10,
      borderTop: `3px solid ${accent}`, boxShadow: '0 1px 4px rgba(0,0,0,.05)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FB, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, color: BLK }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */

export default function QAIntelligencePage() {
  const { user } = useAuth()

  // Global stats
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Search state
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('most_asked')
  const [questions, setQuestions] = useState([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [totalShown, setTotalShown] = useState(20)

  // Selected question
  const [selectedId, setSelectedId] = useState(null)
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Edit state
  const [editingAnswerId, setEditingAnswerId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editingQuestionText, setEditingQuestionText] = useState(false)
  const [questionEditText, setQuestionEditText] = useState('')

  // Flag state
  const [flaggingAnswerId, setFlaggingAnswerId] = useState(null)
  const [flagReason, setFlagReason] = useState('')

  // Add manual Q&A
  const [showAddQA, setShowAddQA] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [newIndustry, setNewIndustry] = useState('')

  // Right panel tab
  const [rightTab, setRightTab] = useState('detail') // detail | lead_model

  // Import state
  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState(1) // 1=instructions, 2=upload, 3=preview, 4=importing
  const [importRows, setImportRows] = useState([])
  const [importValidation, setImportValidation] = useState(null)
  const [importOverwrite, setImportOverwrite] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [importingNow, setImportingNow] = useState(false)

  // Bulk edit state
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const debounceRef = useRef(null)

  // Load stats
  useEffect(() => {
    api('get_stats').then(r => { setStats(r.data); setLoadingStats(false) })
  }, [])

  // Search questions with debounce
  const doSearch = useCallback(() => {
    setLoadingQuestions(true)
    api('search', {
      q: query,
      type: typeFilter || undefined,
      limit: totalShown,
    }).then(r => {
      let results = r.data || []
      if (sortBy === 'best_rate') results.sort((a, b) => (b.appointment_rate_when_asked || 0) - (a.appointment_rate_when_asked || 0))
      if (sortBy === 'worst_rate') results.sort((a, b) => (a.appointment_rate_when_asked || 0) - (b.appointment_rate_when_asked || 0))
      if (sortBy === 'newest') results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setQuestions(results)
      setLoadingQuestions(false)
    })
  }, [query, typeFilter, sortBy, totalShown])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(doSearch, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [doSearch])

  // Load question detail
  useEffect(() => {
    if (!selectedId) { setSelectedQuestion(null); return }
    setLoadingDetail(true)
    api('get_question', { question_id: selectedId }).then(r => {
      setSelectedQuestion(r.data)
      setLoadingDetail(false)
    })
  }, [selectedId])

  // Handlers
  async function handleEditAnswer() {
    if (!editText.trim()) return
    const res = await apiPost({ action: 'edit_answer', answer_id: editingAnswerId, new_text: editText, notes: editNotes })
    if (res.success) { toast.success('Answer updated'); setEditingAnswerId(null); setSelectedId(s => s) /* refresh */ }
    else toast.error(res.error || 'Failed')
    // Refresh detail
    if (selectedId) api('get_question', { question_id: selectedId }).then(r => setSelectedQuestion(r.data))
  }

  async function handleFlagAnswer() {
    const res = await apiPost({ action: 'flag_answer', answer_id: flaggingAnswerId, reason: flagReason })
    if (res.success) { toast.success('Answer flagged'); setFlaggingAnswerId(null) }
    else toast.error(res.error || 'Failed')
    if (selectedId) api('get_question', { question_id: selectedId }).then(r => setSelectedQuestion(r.data))
  }

  async function handleEditQuestion() {
    if (!questionEditText.trim()) return
    const res = await apiPost({ action: 'edit_question', question_id: selectedId, new_text: questionEditText })
    if (res.success) { toast.success('Question updated'); setEditingQuestionText(false); doSearch() }
    else toast.error(res.error || 'Failed')
    if (selectedId) api('get_question', { question_id: selectedId }).then(r => setSelectedQuestion(r.data))
  }

  async function handleAddQA() {
    if (!newQuestion.trim() || !newAnswer.trim()) { toast.error('Question and answer required'); return }
    const res = await apiPost({ action: 'add_manual_qa', question: newQuestion, answer: newAnswer, industry_sic_code: newIndustry || undefined })
    if (res.success) { toast.success('Q&A added'); setShowAddQA(false); setNewQuestion(''); setNewAnswer(''); doSearch() }
    else toast.error(res.error || 'Failed')
  }

  // Download CSV template
  function downloadTemplate() {
    const csv = generateQATemplateCSV()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'qa-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Template downloaded')
  }

  // Export all Q&A
  async function exportAll() {
    window.open('/api/qa-intelligence?action=export', '_blank')
    toast.success('Export started')
  }

  // Parse CSV file
  function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const vals = []
      let current = '', inQuote = false
      for (const ch of lines[i]) {
        if (ch === '"') { inQuote = !inQuote; continue }
        if (ch === ',' && !inQuote) { vals.push(current.trim()); current = ''; continue }
        current += ch
      }
      vals.push(current.trim())
      // Skip instruction row (starts with REQUIRED or OPTIONAL)
      if (vals[0]?.startsWith('REQUIRED') || vals[0]?.startsWith('OPTIONAL')) continue
      const row = {}
      headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
      if (row.question_text) rows.push(row)
    }
    return rows
  }

  // Handle file upload
  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      const rows = parseCSV(text)
      setImportRows(rows)
      if (rows.length > 0) {
        setImportStep(3)
        // Validate
        apiPost({ action: 'validate_import', rows }).then(r => {
          setImportValidation(r.data)
        })
      } else {
        toast.error('No valid rows found in file')
      }
    }
    reader.readAsText(file)
  }

  // Run import
  async function runImport() {
    setImportingNow(true)
    setImportStep(4)
    const res = await apiPost({ action: 'batch_import', rows: importRows, overwrite_existing: importOverwrite })
    setImportProgress(res.data)
    setImportingNow(false)
    if (res.success) {
      toast.success(`Imported ${res.data.imported} questions`)
      doSearch()
      api('get_stats').then(r => setStats(r.data))
    }
  }

  // Seed expert data
  async function seedExpertData() {
    const res = await apiPost({ action: 'batch_import', rows: EXPERT_QA_SEED_DATA, overwrite_existing: false })
    if (res.success) {
      toast.success(`Seeded ${res.data.imported} expert Q&A pairs`)
      doSearch()
      api('get_stats').then(r => setStats(r.data))
    } else toast.error(res.error || 'Seed failed')
  }

  // Bulk handlers
  function toggleSelectAll() {
    if (selectedIds.size === questions.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(questions.map(q => q.id)))
  }

  function toggleSelect(id) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} questions? This cannot be undone.`)) return
    const res = await apiPost({ action: 'bulk_delete', question_ids: Array.from(selectedIds) })
    if (res.success) { toast.success(`Deleted ${res.data.deleted} questions`); setSelectedIds(new Set()); doSearch(); api('get_stats').then(r => setStats(r.data)) }
    else toast.error(res.error || 'Failed')
  }

  async function bulkChangeType(newType) {
    const updates = Array.from(selectedIds).map(id => ({ id, field: 'question_type', value: newType, table: 'question' }))
    const res = await apiPost({ action: 'bulk_edit', updates })
    if (res.success) { toast.success(`Updated ${res.data.updated} questions`); setSelectedIds(new Set()); doSearch() }
    else toast.error(res.error || 'Failed')
  }

  const sq = selectedQuestion

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: GRY }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* ── Dark Header ──────────────────────────────────────── */}
        <div style={{ background: BLK, padding: '36px 40px 28px', borderBottom: `3px solid ${R}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${R},${T})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={22} color={W} />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, color: W, margin: 0, letterSpacing: '-.03em' }}>Q&A Intelligence Engine</h1>
              <p style={{ fontFamily: FB, fontSize: 13, color: 'rgba(255,255,255,.4)', margin: 0 }}>Every question asked. Every answer given. Every outcome tracked.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowImport(true); setImportStep(1) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: GRN, color: W, fontSize: 12, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>
                <Upload size={14} /> Import Q&A
              </button>
              <button onClick={exportAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: W, fontSize: 12, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>
                <Download size={14} /> Export All
              </button>
              <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: W, fontSize: 12, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>
                <FileDown size={14} /> Template
              </button>
              <button onClick={seedExpertData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: T, color: W, fontSize: 12, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>
                <Zap size={14} /> Seed 30 Expert Q&A
              </button>
            </div>
          </div>

          {/* Stats strip */}
          {!loadingStats && stats && (
            <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
              <MiniStat label="Total Questions" value={stats.total_questions} />
              <MiniStat label="Total Answers" value={stats.total_answers} />
              <MiniStat label="Instances Tracked" value={stats.total_instances} />
              <MiniStat label="Avg Appt Rate" value={`${Number(stats.avg_appointment_rate || 0).toFixed(1)}%`} accent={GRN} />
              <MiniStat label="Top Industry" value={stats.top_industries?.[0]?.name || 'None yet'} accent={T} />
            </div>
          )}
        </div>

        {/* ── Main 2-Panel Layout ──────────────────────────────── */}
        <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 160px)' }}>

          {/* ── Left Panel: Question Explorer ── */}
          <div style={{ width: 400, minWidth: 400, borderRight: '1px solid #e5e7eb', background: W, display: 'flex', flexDirection: 'column' }}>

            {/* Search */}
            <div style={{ padding: '16px 16px 12px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: 14, top: 13 }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search any question ever asked..."
                  style={{
                    width: '100%', padding: '11px 14px 11px 40px', borderRadius: 10,
                    border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB,
                    outline: 'none', boxSizing: 'border-box', background: '#f9fafb',
                  }}
                />
                {loadingQuestions && <Loader2 size={14} color={R} style={{ position: 'absolute', right: 14, top: 14, animation: 'spin 1s linear infinite' }} />}
              </div>

              {/* Type filter pills */}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {QUESTION_TYPES.map(t => (
                  <button key={t.key} onClick={() => setTypeFilter(t.key)} style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, fontFamily: FB,
                    border: 'none', cursor: 'pointer',
                    background: typeFilter === t.key ? BLK : '#f3f4f6',
                    color: typeFilter === t.key ? W : '#6b7280',
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sort + Add + Bulk */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                    padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 11,
                    fontFamily: FB, color: '#6b7280', background: W, cursor: 'pointer',
                  }}>
                    {SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <button onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()) }} style={{
                    padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 10, fontWeight: 600,
                    fontFamily: FB, cursor: 'pointer', background: bulkMode ? BLK : W, color: bulkMode ? W : '#6b7280',
                  }}>
                    {bulkMode ? 'Exit Bulk' : 'Bulk'}
                  </button>
                </div>
                <button onClick={() => setShowAddQA(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
                  border: 'none', background: R, color: W, fontSize: 11, fontWeight: 700, fontFamily: FB,
                  cursor: 'pointer',
                }}>
                  <Plus size={12} /> Add Q&A
                </button>
              </div>
              {/* Bulk select all */}
              {bulkMode && questions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <button onClick={toggleSelectAll} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: W, fontSize: 10, fontFamily: FB, cursor: 'pointer', color: '#6b7280' }}>
                    {selectedIds.size === questions.length ? <CheckSquare size={12} /> : <Square size={12} />}
                    {selectedIds.size === questions.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedIds.size > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: FB, color: R }}>{selectedIds.size} selected</span>
                  )}
                </div>
              )}
            </div>

            {/* Question list */}
            <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
              {questions.length === 0 && !loadingQuestions && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: 13, fontFamily: FB }}>
                  {query ? 'No questions match your search' : 'No questions in database yet. They appear after calls are analyzed.'}
                </div>
              )}

              {questions.map(q => (
                <div
                  key={q.id}
                  onClick={() => bulkMode ? toggleSelect(q.id) : setSelectedId(q.id)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                    border: selectedId === q.id ? `2px solid ${R}` : selectedIds.has(q.id) ? `2px solid ${T}` : '1.5px solid #e5e7eb',
                    background: selectedId === q.id ? '#fef2f2' : selectedIds.has(q.id) ? '#f0fdfa' : W,
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {bulkMode && (
                      <div style={{ marginTop: 2, flexShrink: 0 }}>
                        {selectedIds.has(q.id) ? <CheckSquare size={16} color={T} /> : <Square size={16} color="#d1d5db" />}
                      </div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FH, color: BLK, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {q.question_text}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <TypeBadge type={q.question_type} />
                    {q.industry_sic_code && q.industry_sic_code !== 'unknown' && (
                      <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: FB }}>{q.industry_sic_code}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FB }}>Asked {q.times_asked}x</span>
                    <div style={{ flex: 1 }}>
                      <RateBar rate={q.appointment_rate_when_asked || 0} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FH, color: (q.appointment_rate_when_asked || 0) >= 50 ? GRN : (q.appointment_rate_when_asked || 0) >= 25 ? AMB : R }}>
                      {Number(q.appointment_rate_when_asked || 0).toFixed(0)}%
                    </span>
                  </div>
                  {q.koto_answer_intelligence?.[0] && (
                    <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, marginTop: 6, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Top answer: {q.koto_answer_intelligence[0].answer_text?.slice(0, 60)}...
                    </div>
                  )}
                </div>
              ))}

              {questions.length >= totalShown && (
                <button onClick={() => setTotalShown(t => t + 20)} style={{
                  width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb',
                  background: '#f9fafb', fontSize: 12, fontWeight: 600, fontFamily: FB,
                  color: '#6b7280', cursor: 'pointer', marginTop: 8,
                }}>
                  Load More
                </button>
              )}

              <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, textAlign: 'center', marginTop: 8 }}>
                Showing {questions.length} question{questions.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* ── Right Panel ── */}
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>

            {/* Loading */}
            {loadingDetail && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                <Loader2 size={28} color={R} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {/* No selection — show global overview */}
            {!selectedId && !loadingDetail && (
              <GlobalOverview stats={stats} loadingStats={loadingStats} onSelectIndustry={code => { setTypeFilter(''); setQuery(''); }} />
            )}

            {/* Question detail */}
            {sq && !loadingDetail && (
              <div>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                  {[{ key: 'detail', label: 'Question Detail' }, { key: 'lead_model', label: 'Lead Score Impact' }].map(tab => (
                    <button key={tab.key} onClick={() => setRightTab(tab.key)} style={{
                      padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
                      fontFamily: FB, cursor: 'pointer',
                      background: rightTab === tab.key ? BLK : '#f3f4f6',
                      color: rightTab === tab.key ? W : '#6b7280',
                    }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {rightTab === 'detail' && (
                  <>
                    {/* Question Header */}
                    <div style={{ background: W, borderRadius: 14, padding: '24px 28px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e5e7eb', marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        {editingQuestionText ? (
                          <div style={{ flex: 1 }}>
                            <textarea
                              value={questionEditText}
                              onChange={e => setQuestionEditText(e.target.value)}
                              rows={3}
                              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 15, fontFamily: FH, resize: 'vertical', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button onClick={handleEditQuestion} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: GRN, color: W, fontSize: 12, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>
                                <Check size={12} /> Save
                              </button>
                              <button onClick={() => setEditingQuestionText(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: W, color: '#6b7280', fontSize: 12, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <h2 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: 0, lineHeight: 1.3, flex: 1, letterSpacing: '-.02em' }}>
                            {sq.question_text}
                          </h2>
                        )}
                        {!editingQuestionText && (
                          <button onClick={() => { setEditingQuestionText(true); setQuestionEditText(sq.question_text) }} style={{
                            width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                            background: W, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0,
                          }}>
                            <Edit2 size={14} color="#6b7280" />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <TypeBadge type={sq.question_type} />
                        {sq.industry_sic_code && <TypeBadge type={sq.industry_sic_code} map={{ [sq.industry_sic_code]: { bg: '#f0f9ff', color: '#0369a1' } }} />}
                      </div>

                      {/* 4 stat boxes */}
                      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                        <StatBox label="Times Asked" value={sq.times_asked || 0} accent={T} />
                        <StatBox label="Appt Rate" value={`${Number(sq.appointment_rate_when_asked || 0).toFixed(1)}%`} accent={GRN} />
                        <StatBox label="Avg Lead Score" value={Number(sq.avg_lead_score_when_asked || 0).toFixed(0)} accent={AMB} />
                        <StatBox label="Avg Position" value={`${Number(sq.avg_position_in_call || 0).toFixed(0)}%`} sub="into call" accent={R} />
                      </div>
                    </div>

                    {/* Performance Insight */}
                    {sq.total_calls_with_question > 0 && (
                      <PerformanceInsight rate={sq.appointment_rate_when_asked || 0} />
                    )}

                    {/* Best Call Position */}
                    <div style={{ background: W, borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #e5e7eb', marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: FB, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                        <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Optimal Call Position
                      </div>
                      <PositionTimeline actual={sq.avg_position_in_call || 0} best={sq.best_position_in_call || sq.avg_position_in_call || 0} />
                    </div>

                    {/* Answers Section */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, margin: 0 }}>
                          {(sq.koto_answer_intelligence || []).length} Answer{(sq.koto_answer_intelligence || []).length !== 1 ? 's' : ''} Given
                        </h3>
                      </div>

                      {(sq.koto_answer_intelligence || [])
                        .sort((a, b) => (b.effectiveness_score || 0) - (a.effectiveness_score || 0))
                        .map(ans => (
                          <AnswerCard
                            key={ans.id}
                            ans={ans}
                            editingId={editingAnswerId}
                            editText={editText}
                            editNotes={editNotes}
                            onStartEdit={() => { setEditingAnswerId(ans.id); setEditText(ans.answer_text); setEditNotes('') }}
                            onCancelEdit={() => setEditingAnswerId(null)}
                            onSaveEdit={handleEditAnswer}
                            onEditTextChange={setEditText}
                            onEditNotesChange={setEditNotes}
                            flaggingId={flaggingAnswerId}
                            flagReason={flagReason}
                            onStartFlag={() => { setFlaggingAnswerId(ans.id); setFlagReason('') }}
                            onCancelFlag={() => setFlaggingAnswerId(null)}
                            onSaveFlag={handleFlagAnswer}
                            onFlagReasonChange={setFlagReason}
                          />
                        ))}
                    </div>

                    {/* Outcome Correlation */}
                    {(sq.koto_answer_intelligence || []).length > 1 && (
                      <OutcomeCorrelation answers={sq.koto_answer_intelligence} />
                    )}
                  </>
                )}

                {rightTab === 'lead_model' && (
                  <LeadScoreImpact question={sq} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add Q&A Modal */}
        {showAddQA && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: W, borderRadius: 16, padding: 32, width: 480, maxWidth: '90vw' }}>
              <h3 style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, margin: '0 0 16px' }}>Add Q&A Pair</h3>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FB, marginBottom: 6, textTransform: 'uppercase' }}>Question</label>
              <textarea value={newQuestion} onChange={e => setNewQuestion(e.target.value)} rows={3} placeholder="What question should the agent ask?" style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FB, marginBottom: 6, textTransform: 'uppercase' }}>Best Answer / Response</label>
              <textarea value={newAnswer} onChange={e => setNewAnswer(e.target.value)} rows={3} placeholder="Ideal answer or response template..." style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FB, marginBottom: 6, textTransform: 'uppercase' }}>Industry SIC Code (optional)</label>
              <input value={newIndustry} onChange={e => setNewIndustry(e.target.value)} placeholder="e.g. 1711" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: FB, boxSizing: 'border-box', marginBottom: 20 }} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAddQA(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: W, fontSize: 13, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#6b7280' }}>Cancel</button>
                <button onClick={handleAddQA} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: R, color: W, fontSize: 13, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>Add Q&A</button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Action Bar */}
        {bulkMode && selectedIds.size > 0 && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: BLK, borderRadius: 14, padding: '12px 24px', display: 'flex',
            alignItems: 'center', gap: 16, zIndex: 9998, boxShadow: '0 8px 32px rgba(0,0,0,.3)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FH, color: W }}>{selectedIds.size} selected</span>
            <select onChange={e => { if (e.target.value) bulkChangeType(e.target.value); e.target.value = '' }} style={{
              padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: W, fontSize: 12, fontFamily: FB, cursor: 'pointer',
            }}>
              <option value="">Change Type...</option>
              {QA_TYPE_OPTIONS.question_types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={bulkDelete} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, border: 'none', background: R, color: W, fontSize: 12, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}

        {/* Import Modal */}
        {showImport && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: W, borderRadius: 16, padding: 0, width: 640, maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto' }}>
              {/* Modal header */}
              <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, margin: 0 }}>Import Q&A Data</h3>
                <button onClick={() => { setShowImport(false); setImportRows([]); setImportValidation(null); setImportProgress(null); setImportStep(1) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
              </div>

              {/* Step tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                {['Instructions', 'Upload', 'Preview', 'Import'].map((label, i) => (
                  <button key={label} onClick={() => { if (i + 1 <= importStep) setImportStep(i + 1) }} style={{
                    flex: 1, padding: '10px', fontSize: 12, fontWeight: importStep === i + 1 ? 700 : 500, fontFamily: FB,
                    border: 'none', borderBottom: importStep === i + 1 ? `2px solid ${R}` : '2px solid transparent',
                    background: 'none', cursor: i + 1 <= importStep ? 'pointer' : 'default', color: importStep === i + 1 ? BLK : '#9ca3af',
                  }}>
                    {i + 1}. {label}
                  </button>
                ))}
              </div>

              <div style={{ padding: '24px 28px' }}>
                {/* Step 1: Instructions */}
                {importStep === 1 && (
                  <div>
                    <h4 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 12px' }}>How to Import Q&A Pairs</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', fontFamily: FB, lineHeight: 1.6, margin: '0 0 16px' }}>
                      The Q&A database is the brain of your AI voice agent. Every question a prospect has ever asked,
                      and every great response, lives here. Import your own expert knowledge to instantly make the AI smarter.
                    </p>

                    <div style={{ fontSize: 12, fontFamily: FB, marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, color: BLK, marginBottom: 8 }}>Required Fields:</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <tbody>
                          {['question_text', 'question_type', 'industry_sic_code', 'industry_name', 'answer_text', 'answer_type'].map(f => (
                            <tr key={f} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 700, color: BLK, fontFamily: 'monospace', width: 140 }}>{f}</td>
                              <td style={{ padding: '6px 8px', color: '#6b7280' }}>{f === 'question_type' ? 'discovery, objection, closing, price, timing, competitor, rapport' : f === 'answer_type' ? 'acceptance, objection, interest, commitment, neutral, deflection' : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ fontSize: 12, fontFamily: FB, marginBottom: 16, padding: '12px 14px', background: '#f0fdfa', borderRadius: 8, borderLeft: `3px solid ${T}` }}>
                      <div style={{ fontWeight: 700, color: BLK, marginBottom: 4 }}>Common SIC Codes:</div>
                      <div style={{ color: '#6b7280', lineHeight: 1.8 }}>
                        1711 Plumbing | 1731 Electrical | 1521 Contractor | 1761 Roofing | 7389 Marketing | 8011 Medical | 8021 Dental | 8049 Chiropractic | 5812 Restaurant | Use "ALL" for universal
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button onClick={downloadTemplate} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: W, fontSize: 13, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileDown size={14} /> Download Template
                      </button>
                      <button onClick={() => setImportStep(2)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: R, color: W, fontSize: 13, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>
                        Next: Upload File
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Upload */}
                {importStep === 2 && (
                  <div>
                    <div style={{
                      border: '2px dashed #d1d5db', borderRadius: 12, padding: '40px 20px', textAlign: 'center',
                      cursor: 'pointer', background: '#f9fafb',
                    }}
                      onClick={() => document.getElementById('qa-import-file')?.click()}
                    >
                      <Upload size={32} color="#9ca3af" style={{ marginBottom: 12 }} />
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK, marginBottom: 4 }}>Drop your CSV file here</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>Or click to browse. Accepts .csv files up to 10MB</div>
                    </div>
                    <input id="qa-import-file" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                    {importRows.length > 0 && (
                      <div style={{ marginTop: 16, padding: '10px 14px', background: '#dcfce7', borderRadius: 8, fontSize: 13, fontFamily: FB, color: GRN }}>
                        <Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        {importRows.length} rows parsed from file
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Preview & Validate */}
                {importStep === 3 && (
                  <div>
                    {importValidation && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                          <div style={{ padding: '8px 14px', borderRadius: 8, background: '#dcfce7', fontSize: 12, fontWeight: 700, fontFamily: FB, color: GRN }}>
                            <Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {importValidation.valid} valid
                          </div>
                          {importValidation.invalid > 0 && (
                            <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fef2f2', fontSize: 12, fontWeight: 700, fontFamily: FB, color: R }}>
                              <X size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                              {importValidation.invalid} errors
                            </div>
                          )}
                          {importValidation.duplicates > 0 && (
                            <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fef3c7', fontSize: 12, fontWeight: 700, fontFamily: FB, color: AMB }}>
                              {importValidation.duplicates} duplicates
                            </div>
                          )}
                        </div>

                        {importValidation.duplicates > 0 && (
                          <div style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 8, marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: FB, color: BLK, marginBottom: 6 }}>Duplicate handling:</div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: FB, color: '#6b7280', cursor: 'pointer', marginBottom: 4 }}>
                              <input type="radio" checked={!importOverwrite} onChange={() => setImportOverwrite(false)} /> Skip duplicates (keep existing)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: FB, color: '#6b7280', cursor: 'pointer' }}>
                              <input type="radio" checked={importOverwrite} onChange={() => setImportOverwrite(true)} /> Update existing (overwrite)
                            </label>
                          </div>
                        )}

                        {importValidation.errors?.length > 0 && (
                          <div style={{ padding: '12px 14px', background: '#fef2f2', borderRadius: 8, maxHeight: 150, overflow: 'auto', marginBottom: 12 }}>
                            {importValidation.errors.slice(0, 10).map((e, i) => (
                              <div key={i} style={{ fontSize: 11, fontFamily: FB, color: R, lineHeight: 1.6 }}>
                                Row {e.row}: <strong>{e.field}</strong> — {e.message}
                              </div>
                            ))}
                            {importValidation.errors.length > 10 && (
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>...and {importValidation.errors.length - 10} more errors</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Preview table */}
                    <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: FB }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#6b7280' }}>Question</th>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#6b7280', width: 70 }}>Type</th>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#6b7280', width: 60 }}>SIC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.slice(0, 10).map((r, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '6px 8px', color: BLK, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.question_text}</td>
                              <td style={{ padding: '6px 8px' }}><TypeBadge type={r.question_type} /></td>
                              <td style={{ padding: '6px 8px', color: '#9ca3af' }}>{r.industry_sic_code}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button onClick={() => setImportStep(2)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: W, fontSize: 13, fontWeight: 600, fontFamily: FB, cursor: 'pointer', color: '#6b7280' }}>Back</button>
                      <button onClick={runImport} disabled={importingNow || (importValidation && importValidation.valid === 0)} style={{
                        padding: '10px 20px', borderRadius: 8, border: 'none', background: R, color: W, fontSize: 13, fontWeight: 700, fontFamily: FB, cursor: 'pointer',
                        opacity: importValidation && importValidation.valid === 0 ? 0.5 : 1,
                      }}>
                        Import {importValidation?.valid || importRows.length} Valid Rows
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 4: Results */}
                {importStep === 4 && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    {importingNow ? (
                      <div>
                        <Loader2 size={32} color={R} style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FH, color: BLK }}>Importing...</div>
                      </div>
                    ) : importProgress && (
                      <div>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                          <Check size={32} color={GRN} />
                        </div>
                        <h4 style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, margin: '0 0 12px' }}>Import Complete</h4>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
                          <div style={{ padding: '8px 14px', borderRadius: 8, background: '#dcfce7', fontSize: 13, fontWeight: 700, fontFamily: FB, color: GRN }}>
                            {importProgress.imported} imported
                          </div>
                          {importProgress.updated > 0 && (
                            <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fef3c7', fontSize: 13, fontWeight: 700, fontFamily: FB, color: AMB }}>
                              {importProgress.updated} updated
                            </div>
                          )}
                          {importProgress.skipped > 0 && (
                            <div style={{ padding: '8px 14px', borderRadius: 8, background: '#f3f4f6', fontSize: 13, fontWeight: 700, fontFamily: FB, color: '#6b7280' }}>
                              {importProgress.skipped} skipped
                            </div>
                          )}
                        </div>
                        <button onClick={() => { setShowImport(false); setImportRows([]); setImportValidation(null); setImportProgress(null); setImportStep(1) }} style={{
                          padding: '10px 24px', borderRadius: 8, border: 'none', background: BLK, color: W, fontSize: 13, fontWeight: 700, fontFamily: FB, cursor: 'pointer',
                        }}>
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

/* ─── Sub-components (module level) ──────────────────────────────────────── */

function MiniStat({ label, value, accent }) {
  return (
    <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,.06)', borderRadius: 8, minWidth: 100 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', fontFamily: FB, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: FH, color: accent || W, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function PerformanceInsight({ rate }) {
  const r = Number(rate)
  let bg, color, icon, text
  if (r >= 50) {
    bg = '#dcfce7'; color = GRN; icon = <Zap size={16} color={GRN} />
    text = 'High performer — this question consistently leads to appointments'
  } else if (r >= 25) {
    bg = '#fef3c7'; color = AMB; icon = <BarChart2 size={16} color={AMB} />
    text = 'Average performer — see which answers work best below'
  } else {
    bg = '#fef2f2'; color = R; icon = <AlertTriangle size={16} color={R} />
    text = 'Poor performer — consider rephrasing or removing this question'
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: bg, marginBottom: 20 }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FB, color }}>{text}</span>
    </div>
  )
}

function PositionTimeline({ actual, best }) {
  const a = Math.max(0, Math.min(100, actual))
  const b = Math.max(0, Math.min(100, best || actual))
  return (
    <div>
      <div style={{ position: 'relative', height: 24, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
        {/* Best marker */}
        <div style={{ position: 'absolute', left: `${b}%`, top: 0, bottom: 0, width: 3, background: GRN, borderRadius: 99, transform: 'translateX(-50%)' }} />
        {/* Actual marker */}
        <div style={{ position: 'absolute', left: `${a}%`, top: 2, width: 20, height: 20, borderRadius: '50%', background: R, border: `2px solid ${W}`, transform: 'translateX(-50%)', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
        {/* Labels */}
        <div style={{ position: 'absolute', left: 8, top: 4, fontSize: 10, color: '#9ca3af', fontFamily: FB }}>0%</div>
        <div style={{ position: 'absolute', right: 8, top: 4, fontSize: 10, color: '#9ca3af', fontFamily: FB }}>100%</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FB }}>
          Avg position: <strong style={{ color: R }}>{Number(a).toFixed(0)}%</strong> into call
        </span>
        {b !== a && (
          <span style={{ fontSize: 11, color: GRN, fontFamily: FB, fontWeight: 600 }}>
            Best at {Number(b).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}

function AnswerCard({
  ans, editingId, editText, editNotes, onStartEdit, onCancelEdit, onSaveEdit, onEditTextChange, onEditNotesChange,
  flaggingId, flagReason, onStartFlag, onCancelFlag, onSaveFlag, onFlagReasonChange,
}) {
  const isEditing = editingId === ans.id
  const isFlagging = flaggingId === ans.id
  const eff = Number(ans.effectiveness_score || 0)

  return (
    <div style={{ background: W, borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #e5e7eb', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          {isEditing ? (
            <div>
              <textarea value={editText} onChange={e => onEditTextChange(e.target.value)} rows={3} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: FB, resize: 'vertical', boxSizing: 'border-box' }} />
              <input value={editNotes} onChange={e => onEditNotesChange(e.target.value)} placeholder="Why are you editing?" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: FB, marginTop: 6, boxSizing: 'border-box' }} />
              {ans.is_edited && ans.original_text && (
                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, marginTop: 6, fontStyle: 'italic' }}>Originally: {ans.original_text.slice(0, 80)}...</div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={onSaveEdit} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: GRN, color: W, fontSize: 11, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>Save</button>
                <button onClick={onCancelEdit} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: W, color: '#6b7280', fontSize: 11, fontFamily: FB, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, fontFamily: FH, color: BLK, lineHeight: 1.5 }}>{ans.answer_text}</div>
          )}
        </div>
        {!isEditing && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={onStartEdit} title="Edit" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: W, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Edit2 size={12} color="#6b7280" />
            </button>
            <button onClick={onStartFlag} title="Flag" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: W, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Flag size={12} color={ans.is_flagged ? AMB : '#6b7280'} />
            </button>
          </div>
        )}
      </div>

      {/* Flag inline */}
      {isFlagging && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#fef3c7', borderRadius: 8 }}>
          <input value={flagReason} onChange={e => onFlagReasonChange(e.target.value)} placeholder="Reason for flagging..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: FB, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={onSaveFlag} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: AMB, color: W, fontSize: 11, fontWeight: 700, fontFamily: FB, cursor: 'pointer' }}>Flag</button>
            <button onClick={onCancelFlag} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: W, color: '#6b7280', fontSize: 11, fontFamily: FB, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <TypeBadge type={ans.answer_type} map={ANSWER_TYPE_COLORS} />
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FB }}>Used {ans.times_used}x</span>
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FB }}>Appt: {Number(ans.appointment_rate || 0).toFixed(0)}%</span>
        {ans.is_top_performer && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, fontFamily: FB, background: '#dcfce7', color: GRN }}>
            <Award size={10} /> TOP
          </span>
        )}
        {ans.is_flagged && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, fontFamily: FB, background: '#fef3c7', color: AMB }}>
            <Flag size={10} /> FLAGGED
          </span>
        )}
        {ans.is_edited && (
          <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: FB, fontStyle: 'italic' }}>edited</span>
        )}
      </div>

      {/* Effectiveness bar */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: FB }}>Effectiveness</span>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FH, color: eff >= 75 ? GRN : eff >= 40 ? AMB : R }}>{eff.toFixed(0)}/100</span>
        </div>
        <RateBar rate={eff} height={4} />
      </div>
    </div>
  )
}

function OutcomeCorrelation({ answers }) {
  const byType = {}
  for (const a of answers) {
    const t = a.answer_type || 'neutral'
    if (!byType[t]) byType[t] = { total: 0, apptSum: 0 }
    byType[t].total++
    byType[t].apptSum += Number(a.appointment_rate || 0)
  }

  const bars = Object.entries(byType).map(([type, v]) => ({
    type,
    rate: v.total > 0 ? v.apptSum / v.total : 0,
  })).sort((a, b) => b.rate - a.rate)

  const maxRate = Math.max(...bars.map(b => b.rate), 1)
  const bestType = bars[0]?.type || 'unknown'

  return (
    <div style={{ background: W, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #e5e7eb', marginBottom: 20 }}>
      <h4 style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, margin: '0 0 16px' }}>Outcome Correlation by Answer Type</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bars.map(b => {
          const c = ANSWER_TYPE_COLORS[b.type] || { bg: '#f3f4f6', color: '#6b7280' }
          return (
            <div key={b.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 80, fontSize: 11, fontWeight: 600, fontFamily: FB, color: c.color, textTransform: 'capitalize' }}>{b.type}</span>
              <div style={{ flex: 1, height: 16, borderRadius: 99, background: '#f3f4f6', overflow: 'hidden' }}>
                <div style={{ width: `${(b.rate / maxRate) * 100}%`, height: '100%', borderRadius: 99, background: c.color, transition: 'width .3s' }} />
              </div>
              <span style={{ width: 40, fontSize: 11, fontWeight: 700, fontFamily: FH, color: BLK, textAlign: 'right' }}>{b.rate.toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB, marginTop: 12, fontStyle: 'italic' }}>
        Appointments most likely after <strong style={{ color: BLK }}>{bestType}</strong> responses
      </div>
    </div>
  )
}

function LeadScoreImpact({ question }) {
  const q = question
  const avgScore = Number(q.avg_lead_score_when_asked || 0)
  const position = Number(q.avg_position_in_call || 0)
  const highScoreCount = q.high_score_leads_asked || 0
  const lowScoreCount = q.low_score_leads_asked || 0
  const totalCalls = q.total_calls_with_question || 0

  return (
    <div>
      <div style={{ background: W, borderRadius: 14, padding: '24px 28px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e5e7eb', marginBottom: 20 }}>
        <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, margin: '0 0 16px' }}>Lead Score Impact Analysis</h3>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <StatBox label="Avg Lead Score When Asked" value={avgScore.toFixed(0)} accent={avgScore >= 60 ? GRN : avgScore >= 40 ? AMB : R} />
          <StatBox label="High Score Leads (70+)" value={highScoreCount} sub={`of ${totalCalls} calls`} accent={GRN} />
          <StatBox label="Low Score Leads (<40)" value={lowScoreCount} sub={`of ${totalCalls} calls`} accent={R} />
        </div>

        <div style={{ padding: '16px 20px', background: '#f9fafb', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontFamily: FB, color: '#374151', lineHeight: 1.6 }}>
            Asking this question at <strong style={{ color: R }}>{position.toFixed(0)}%</strong> into the call correlates with an average lead score of <strong style={{ color: avgScore >= 60 ? GRN : AMB }}>{avgScore.toFixed(0)}/100</strong>.
          </div>
        </div>

        {totalCalls >= 5 && (
          <div style={{ padding: '12px 16px', background: avgScore >= 60 ? '#dcfce7' : '#fef3c7', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FB, color: avgScore >= 60 ? GRN : AMB }}>
              {avgScore >= 60
                ? 'This question is strongly correlated with high-scoring leads. Keep using it.'
                : 'This question appears in calls with moderate lead scores. Consider when and how it is asked.'}
            </div>
          </div>
        )}
      </div>

      {/* Position vs Score */}
      <div style={{ background: W, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #e5e7eb' }}>
        <h4 style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, margin: '0 0 14px' }}>Position vs Outcome</h4>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1, textAlign: 'center', padding: 16, background: '#f9fafb', borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FB, textTransform: 'uppercase', marginBottom: 4 }}>Early (0-33%)</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: T }}>
              {position <= 33 ? 'Current' : '--'}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: 16, background: '#f9fafb', borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FB, textTransform: 'uppercase', marginBottom: 4 }}>Mid (34-66%)</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: AMB }}>
              {position > 33 && position <= 66 ? 'Current' : '--'}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: 16, background: '#f9fafb', borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FB, textTransform: 'uppercase', marginBottom: 4 }}>Late (67-100%)</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, color: R }}>
              {position > 66 ? 'Current' : '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GlobalOverview({ stats, loadingStats }) {
  if (loadingStats || !stats) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader2 size={28} color={R} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      <h2 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, margin: '0 0 20px', letterSpacing: '-.02em' }}>Platform Overview</h2>

      {/* 4 big stat cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatBox label="Unique Questions" value={stats.total_questions} accent={T} />
        <StatBox label="Answer Variants" value={stats.total_answers} accent={R} />
        <StatBox label="Q&A Instances" value={stats.total_instances} accent={AMB} />
        <StatBox label="Overall Appt Rate" value={`${Number(stats.avg_appointment_rate || 0).toFixed(1)}%`} accent={GRN} />
      </div>

      {/* Most asked question */}
      {stats.most_asked_question && (
        <div style={{ background: W, borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FB, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
            <Star size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Most Asked Question
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: BLK, lineHeight: 1.4 }}>
            {stats.most_asked_question.question_text}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>Asked {stats.most_asked_question.times_asked}x</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: FH, color: GRN }}>{Number(stats.most_asked_question.appointment_rate_when_asked || 0).toFixed(1)}% appt rate</span>
          </div>
        </div>
      )}

      {/* Industry Breakdown */}
      {stats.top_industries?.length > 0 && (
        <div style={{ background: W, borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h3 style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, margin: '0 0 12px' }}>Industry Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.top_industries.map((ind, i) => (
              <div key={ind.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 8, background: i % 2 === 0 ? '#f9fafb' : W }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: FH, color: T, width: 24 }}>#{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FH, color: BLK, flex: 1 }}>{ind.name || ind.code}</span>
                <span style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>{ind.count} questions</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.total_questions === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Brain size={48} color="#d1d5db" style={{ marginBottom: 16 }} />
          <h3 style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, margin: '0 0 8px' }}>No Q&A Data Yet</h3>
          <p style={{ fontSize: 14, color: '#6b7280', fontFamily: FB, lineHeight: 1.5, maxWidth: 400, margin: '0 auto' }}>
            As your AI voice agents make calls, every question asked and every answer given will be automatically tracked, analyzed, and scored here.
          </p>
        </div>
      )}
    </div>
  )
}
