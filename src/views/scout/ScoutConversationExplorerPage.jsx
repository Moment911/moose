"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, X, Phone, MessageSquare, Brain, Hash, Edit2, Trash2, Save,
  Check, ChevronDown, ChevronRight, Filter, Loader2, AlertCircle,
  Target, Sparkles, Eye, EyeOff, ArrowUpDown,
} from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../hooks/useAuth'
import { useMobile } from '../../hooks/useMobile'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../../lib/theme'

const API = '/api/scout/voice/explorer'

async function apiGet(params) {
  const url = new URL(API, window.location.origin)
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, String(v))
  const res = await fetch(url, { credentials: 'include' })
  return res.json()
}
async function apiPatch(body) {
  const res = await fetch(API, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
  return res.json()
}
async function apiDelete(body) {
  const res = await fetch(API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
  return res.json()
}

function fmtRelative(iso) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function fmtDur(s) { if (!s) return '—'; const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}` }

function Highlight({ text, term }) {
  if (!term || !text) return <>{text || ''}</>
  const t = String(text)
  const idx = t.toLowerCase().indexOf(term.toLowerCase())
  if (idx < 0) return <>{t}</>
  return (
    <>
      {t.slice(0, idx)}
      <mark style={{ background: '#fef08a', padding: '0 2px', borderRadius: 2 }}>{t.slice(idx, idx + term.length)}</mark>
      {t.slice(idx + term.length)}
    </>
  )
}

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

const TABS = [
  { id: 'call', label: 'Transcripts', icon: Phone },
  { id: 'qa', label: 'Q&A pairs', icon: MessageSquare },
  { id: 'fact', label: 'Brain facts', icon: Brain },
]

// ═══════════════════════════════════════════════════════════════════
export default function ScoutConversationExplorerPage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const [tab, setTab] = useState('call')
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q, 220)
  const [sort, setSort] = useState('recent')

  // Filters (per-tab)
  const [industry, setIndustry] = useState('')
  const [outcome, setOutcome] = useState('')
  const [scope, setScope] = useState('')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!agencyId) return
    setLoading(true)
    setError(null)
    const params = { agency_id: agencyId, entity: tab, q: qDebounced, sort, limit: 200 }
    if (tab === 'call') { params.industry = industry; params.outcome = outcome }
    if (tab === 'fact') { params.scope = scope }
    apiGet(params)
      .then(r => {
        if (r.error) { setError(r.error); setRows([]) }
        else setRows(r.data || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [agencyId, tab, qDebounced, sort, industry, outcome, scope])

  const headerText = useMemo(() => {
    if (tab === 'call') return 'Every call transcript — search across what was actually said'
    if (tab === 'qa') return 'Every question the agent asked and the answer it got'
    return 'Every fact the brain has learned — adjust, delete, or override'
  }, [tab])

  async function onEdit(entity, id, patch) {
    const r = await apiPatch({ entity, id, patch, agency_id: agencyId })
    if (r.error) { toast.error(r.error); return false }
    toast.success('Saved')
    return true
  }

  async function onDelete(entity, id, mode = 'hard') {
    const word = mode === 'soft' ? 'mark irrelevant' : 'permanently delete'
    if (!confirm(`Are you sure you want to ${word}?`)) return
    const r = await apiDelete({ entity, id, mode, agency_id: agencyId })
    if (r.error) { toast.error(r.error); return }
    toast.success(mode === 'soft' ? 'Marked irrelevant' : 'Deleted')
    setRows(prev => prev.filter(row => row.id !== id))
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fafafa', fontFamily: FB }}>
      <Sidebar />
      <main style={{ flex: 1, padding: isMobile ? 14 : 26, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Scout · Conversation Brain</div>
          <h1 style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, color: BLK, margin: 0 }}>Explorer</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0', maxWidth: 680 }}>{headerText}</p>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 14, overflowX: 'auto',
        }}>
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setQ(''); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 14px', background: 'transparent',
                  border: 'none', borderBottom: active ? `2px solid ${T}` : '2px solid transparent',
                  color: active ? BLK : '#6b7280',
                  fontSize: 13, fontWeight: active ? 700 : 600,
                  fontFamily: FH, cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* Search + filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={14} color="#9ca3af" style={{ position: 'absolute', top: 12, left: 12 }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={tab === 'call' ? 'Search transcripts, companies, pitch angles…' : tab === 'qa' ? 'Search questions or answers…' : 'Search facts, scope values, categories…'}
              style={{
                width: '100%', padding: '10px 12px 10px 34px', fontSize: 13,
                borderRadius: 8, border: '1px solid #e5e7eb', background: W, fontFamily: FB,
              }}
            />
            {q && (
              <button onClick={() => setQ('')} style={{ position: 'absolute', top: 10, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <select value={sort} onChange={e => setSort(e.target.value)} style={selectStyle}>
            {tab === 'fact' ? (
              <>
                <option value="recent">Recently updated</option>
                <option value="confidence">Confidence (high → low)</option>
                <option value="confirmed">Most confirmed</option>
                <option value="oldest">Oldest</option>
              </>
            ) : tab === 'qa' ? (
              <>
                <option value="recent">Recent first</option>
                <option value="oldest">Oldest first</option>
                <option value="question">By question text</option>
              </>
            ) : (
              <>
                <option value="recent">Recent first</option>
                <option value="oldest">Oldest first</option>
                <option value="duration">Longest calls</option>
                <option value="appt">Appointments first</option>
                <option value="company">By company</option>
              </>
            )}
          </select>

          {tab === 'call' && (
            <>
              <input placeholder="Industry" value={industry} onChange={e => setIndustry(e.target.value)} style={{ ...selectStyle, width: 140 }} />
              <select value={outcome} onChange={e => setOutcome(e.target.value)} style={selectStyle}>
                <option value="">Any outcome</option>
                <option value="appointment_set">Appointment set</option>
                <option value="qualified">Qualified</option>
                <option value="callback">Callback</option>
                <option value="not_interested">Not interested</option>
                <option value="dnc_requested">DNC requested</option>
                <option value="voicemail">Voicemail</option>
                <option value="no_answer">No answer</option>
              </select>
            </>
          )}

          {tab === 'fact' && (
            <select value={scope} onChange={e => setScope(e.target.value)} style={selectStyle}>
              <option value="">All scopes</option>
              <option value="global_pattern">Global pattern</option>
              <option value="industry">Industry</option>
              <option value="sic">SIC</option>
              <option value="gap">Gap</option>
              <option value="company">Company</option>
              <option value="objection">Objection</option>
            </select>
          )}
        </div>

        {/* Result count + indicators */}
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading ? <><Loader2 size={13} className="animate-spin" /> Searching…</> : (
            <>
              <span><strong>{rows.length}</strong> {tab === 'call' ? 'call' : tab === 'qa' ? 'Q&A pair' : 'fact'}{rows.length === 1 ? '' : 's'}</span>
              {qDebounced && <span>matching "<strong>{qDebounced}</strong>"</span>}
            </>
          )}
        </div>

        {error && (
          <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Rows */}
        {tab === 'call' && <CallsList rows={rows} term={qDebounced} onEdit={onEdit} onDelete={onDelete} />}
        {tab === 'qa' && <QAList rows={rows} term={qDebounced} onEdit={onEdit} onDelete={onDelete} />}
        {tab === 'fact' && <FactList rows={rows} term={qDebounced} onEdit={onEdit} onDelete={onDelete} />}
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CALLS
// ═══════════════════════════════════════════════════════════════════
function CallsList({ rows, term, onEdit, onDelete }) {
  const [open, setOpen] = useState(() => new Set())
  const toggle = (id) => setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  if (rows.length === 0) {
    return <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', padding: 20 }}>No calls match.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(c => {
        const isOpen = open.has(c.id)
        const tsnippet = (() => {
          if (!c.transcript || !term) return null
          const idx = c.transcript.toLowerCase().indexOf(term.toLowerCase())
          if (idx < 0) return null
          const start = Math.max(0, idx - 60)
          const end = Math.min(c.transcript.length, idx + term.length + 120)
          return (start > 0 ? '…' : '') + c.transcript.slice(start, end) + (end < c.transcript.length ? '…' : '')
        })()

        return (
          <div key={c.id} style={{ background: W, borderRadius: 12, border: '1px solid #eef0f2', overflow: 'hidden' }}>
            <button onClick={() => toggle(c.id)} style={{
              display: 'flex', width: '100%', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              {isOpen ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK }}>
                    <Highlight text={c.company_name} term={term} />
                  </span>
                  {c.appointment_set && <Pill label="appt" color={GRN} />}
                  {c.outcome && <Pill label={c.outcome.replace(/_/g, ' ')} color={c.outcome === 'not_interested' ? '#6b7280' : T} />}
                  {c.sentiment && <span style={{ fontSize: 12 }}>{c.sentiment === 'Positive' ? '😊' : c.sentiment === 'Negative' ? '😟' : '😐'}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {c.industry && <span><Highlight text={c.industry} term={term} /></span>}
                  {c.contact_name && <span>· <Highlight text={c.contact_name} term={term} /></span>}
                  {c.duration_seconds != null && <span>· {fmtDur(c.duration_seconds)}</span>}
                  <span>· {fmtRelative(c.ended_at || c.created_at)}</span>
                </div>
                {tsnippet && (
                  <div style={{ fontSize: 12, color: '#4b5563', marginTop: 6, padding: '6px 10px', background: '#f9fafb', borderRadius: 6, lineHeight: 1.5 }}>
                    <Highlight text={tsnippet} term={term} />
                  </div>
                )}
              </div>
            </button>
            {isOpen && (
              <div style={{ borderTop: '1px solid #eef0f2', padding: '12px 14px', background: '#fafbfc' }}>
                <CallEditor call={c} onEdit={onEdit} onDelete={onDelete} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CallEditor({ call, onEdit, onDelete }) {
  const [pitch, setPitch] = useState(call.pitch_angle || '')
  const [gap, setGap] = useState(call.biggest_gap || '')
  const [outcome, setOutcome] = useState(call.outcome || '')
  const [appt, setAppt] = useState(!!call.appointment_set)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const ok = await onEdit('call', call.id, { pitch_angle: pitch, biggest_gap: gap, outcome, appointment_set: appt })
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
        <label>
          <SmallLabel>Pitch angle</SmallLabel>
          <textarea value={pitch} onChange={e => setPitch(e.target.value)} rows={2} style={textareaStyle} />
        </label>
        <label>
          <SmallLabel>Biggest gap</SmallLabel>
          <textarea value={gap} onChange={e => setGap(e.target.value)} rows={2} style={textareaStyle} />
        </label>
        <label>
          <SmallLabel>Outcome</SmallLabel>
          <select value={outcome} onChange={e => setOutcome(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            <option value="appointment_set">Appointment set</option>
            <option value="qualified">Qualified</option>
            <option value="callback">Callback</option>
            <option value="not_interested">Not interested</option>
            <option value="dnc_requested">DNC requested</option>
            <option value="voicemail">Voicemail</option>
            <option value="no_answer">No answer</option>
            <option value="gatekeeper">Gatekeeper</option>
            <option value="wrong_contact">Wrong contact</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 22 }}>
          <input type="checkbox" checked={appt} onChange={e => setAppt(e.target.checked)} />
          <span style={{ fontSize: 13 }}>Appointment booked</span>
        </label>
      </div>

      {call.transcript && (
        <details>
          <summary style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer', marginBottom: 6 }}>Full transcript</summary>
          <pre style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, padding: 10, background: W, borderRadius: 6, border: '1px solid #eef0f2', maxHeight: 300, overflow: 'auto' }}>{call.transcript}</pre>
        </details>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </button>
        {call.opportunity_id && (
          <Link to={`/scout/opportunities/${call.opportunity_id}`} style={btnGhost}>
            Open opportunity
          </Link>
        )}
        <button onClick={() => onDelete('call', call.id, 'soft')} style={btnGhost}>
          <EyeOff size={13} /> Clear transcript
        </button>
        <button onClick={() => onDelete('call', call.id, 'hard')} style={{ ...btnGhost, color: R, borderColor: '#fecaca' }}>
          <Trash2 size={13} /> Delete call
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Q&A
// ═══════════════════════════════════════════════════════════════════
function QAList({ rows, term, onEdit, onDelete }) {
  if (rows.length === 0) return <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', padding: 20 }}>No Q&A pairs match.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => <QARow key={r.id} row={r} term={term} onEdit={onEdit} onDelete={onDelete} />)}
    </div>
  )
}

function QARow({ row, term, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [q, setQ] = useState(row.question_text || '')
  const [a, setA] = useState(row.answer_text || '')
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    const ok = await onEdit('qa', row.id, { question_text: q, answer_text: a })
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <div style={{ background: W, borderRadius: 10, border: '1px solid #eef0f2', padding: '12px 14px' }}>
      {!editing ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 4 }}>
            <Highlight text={row.question_text} term={term} />
          </div>
          <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 6 }}>
            <span style={{ color: '#9ca3af' }}>→ </span>
            <Highlight text={row.answer_text || '(no answer recorded)'} term={term} />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {row.call?.company_name && <span>{row.call.company_name}</span>}
            {row.call?.industry && <span>· {row.call.industry}</span>}
            {row.call?.outcome && <span>· {row.call.outcome.replace(/_/g, ' ')}</span>}
            {row.call?.appointment_set && <Pill label="appt" color={GRN} />}
            <span>· {fmtRelative(row.created_at)}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={() => setEditing(true)} style={btnGhost}><Edit2 size={12} /> Edit</button>
            <button onClick={() => onDelete('qa', row.id, 'hard')} style={{ ...btnGhost, color: R }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      ) : (
        <>
          <SmallLabel>Question</SmallLabel>
          <textarea value={q} onChange={e => setQ(e.target.value)} rows={2} style={textareaStyle} />
          <SmallLabel>Answer</SmallLabel>
          <textarea value={a} onChange={e => setA(e.target.value)} rows={2} style={textareaStyle} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={save} disabled={saving} style={btnPrimary}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
            </button>
            <button onClick={() => setEditing(false)} style={btnGhost}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// FACTS (brain)
// ═══════════════════════════════════════════════════════════════════
function FactList({ rows, term, onEdit, onDelete }) {
  if (rows.length === 0) return <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', padding: 20 }}>No facts match.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => <FactRow key={r.id} row={r} term={term} onEdit={onEdit} onDelete={onDelete} />)}
    </div>
  )
}

function FactRow({ row, term, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [fact, setFact] = useState(row.fact || '')
  const [category, setCategory] = useState(row.fact_category || '')
  const [confidence, setConfidence] = useState(row.confidence_score ?? 0.5)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const ok = await onEdit('fact', row.id, { fact, fact_category: category, confidence_score: Number(confidence) })
    setSaving(false)
    if (ok) setEditing(false)
  }

  const scopeLabel = row.scope === 'global_pattern' ? 'Global pattern' : row.scope
  const scopeColor = row.scope === 'global_pattern' ? T
    : row.scope === 'industry' ? '#7c3aed'
    : row.scope === 'sic' ? AMB
    : row.scope === 'gap' ? R
    : row.scope === 'objection' ? '#dc2626'
    : '#6b7280'

  return (
    <div style={{ background: W, borderRadius: 10, border: '1px solid #eef0f2', padding: '12px 14px' }}>
      {!editing ? (
        <>
          <div style={{ fontSize: 13, color: BLK, lineHeight: 1.5, marginBottom: 6 }}>
            <Highlight text={row.fact} term={term} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: '#6b7280' }}>
            <Pill label={scopeLabel} color={scopeColor} />
            {row.scope_value && <span><Highlight text={row.scope_value} term={term} /></span>}
            {row.fact_category && <span>· <Highlight text={row.fact_category} term={term} /></span>}
            {row.direction && row.direction !== 'both' && <span>· {row.direction}</span>}
            <span>· {Math.round((row.confidence_score || 0) * 100)}% confidence</span>
            <span>· {row.times_confirmed || 0} confirmations</span>
            {row.times_contradicted > 0 && <span style={{ color: R }}>· {row.times_contradicted} contradicted</span>}
            {row.agency_id === null && <span style={{ color: T }}>· platform</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button onClick={() => setEditing(true)} style={btnGhost}><Edit2 size={12} /> Edit</button>
            <button onClick={() => onDelete('fact', row.id, 'soft')} style={btnGhost}>
              <EyeOff size={12} /> Mark irrelevant
            </button>
            <button onClick={() => onDelete('fact', row.id, 'hard')} style={{ ...btnGhost, color: R }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      ) : (
        <>
          <SmallLabel>Fact</SmallLabel>
          <textarea value={fact} onChange={e => setFact(e.target.value)} rows={3} style={textareaStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginTop: 6 }}>
            <label>
              <SmallLabel>Category</SmallLabel>
              <input value={category} onChange={e => setCategory(e.target.value)} style={inputStyle} placeholder="pitch_angle | pain_point | objection_response | timing | decision_maker | hot_button" />
            </label>
            <label>
              <SmallLabel>Confidence</SmallLabel>
              <input type="number" min={0} max={1} step={0.05} value={confidence} onChange={e => setConfidence(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={save} disabled={saving} style={btnPrimary}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
            </button>
            <button onClick={() => setEditing(false)} style={btnGhost}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Shared UI bits
// ═══════════════════════════════════════════════════════════════════
function Pill({ label, color = '#6b7280' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
      background: color + '15', color,
    }}>{label}</span>
  )
}

function SmallLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{children}</div>
}

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 12px', background: BLK, color: W,
  border: 'none', borderRadius: 7,
  fontSize: 12, fontWeight: 700, fontFamily: FH,
  cursor: 'pointer',
}
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 10px', background: W, color: '#4b5563',
  border: '1px solid #e5e7eb', borderRadius: 7,
  fontSize: 12, fontWeight: 600,
  cursor: 'pointer', textDecoration: 'none',
}
const selectStyle = {
  padding: '8px 10px', fontSize: 12, fontWeight: 600,
  borderRadius: 7, border: '1px solid #e5e7eb', background: W, color: '#4b5563', fontFamily: FB,
}
const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  borderRadius: 7, border: '1px solid #e5e7eb', background: W, fontFamily: FB,
}
const textareaStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  borderRadius: 7, border: '1px solid #e5e7eb', background: W, fontFamily: FB,
  resize: 'vertical',
}
