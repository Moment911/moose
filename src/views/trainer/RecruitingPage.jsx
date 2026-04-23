"use client"
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Star, ChevronDown, Plus, Edit2, Trash2, Check, X, Loader2, ExternalLink, Mail, Phone, Globe, Save } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { useAuth } from '../../hooks/useAuth'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/recruiting — College recruiting database.
// Color scheme: black/white/grey + red/blue (matches portal shell + dashboard)
// ─────────────────────────────────────────────────────────────────────────────

const RED = '#dc2626'
const BLUE = '#2563eb'
const BLK = '#0a0a0a'
const BRD = '#e5e7eb'
const GRN = '#16a34a'

async function recruitingFetch(body) {
  const res = await fetch('/api/trainer/recruiting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default function RecruitingPage() {
  const { agencyId } = useAuth()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [division, setDivision] = useState('')
  const [conference, setConference] = useState('')
  const [state, setState] = useState('')
  const [filters, setFilters] = useState({ divisions: [], conferences: [], states: [] })
  const [expanded, setExpanded] = useState(null) // program id
  const [editingCoach, setEditingCoach] = useState(null) // coach id being edited
  const [addingCoach, setAddingCoach] = useState(null) // program id

  // Load filter options.
  useEffect(() => {
    recruitingFetch({ action: 'filters', sport: 'baseball' }).then(setFilters)
  }, [])

  // Load programs.
  const loadPrograms = useCallback(async () => {
    setLoading(true)
    const body = { action: 'list', sport: 'baseball', limit: 500 }
    if (query.trim()) body.query = query.trim()
    if (division) body.division = division
    if (conference) body.conference = conference
    if (state) body.state = state
    const data = await recruitingFetch(body)
    setPrograms(data.programs || [])
    setLoading(false)
  }, [query, division, conference, state])

  useEffect(() => { loadPrograms() }, [loadPrograms])

  // Debounced search.
  const [searchTimeout, setSearchTimeout] = useState(null)
  function handleSearchChange(val) {
    setQuery(val)
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(setTimeout(() => loadPrograms(), 300))
  }

  return (
    <TrainerPortalShell>
      <div style={{ background: '#f3f4f6', minHeight: '100vh' }}>
        {/* Dark header */}
        <div style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', padding: '28px 40px 20px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-.5px' }}>Programs</h1>
          <p style={{ margin: '0 0 18px', fontSize: 14, color: '#6b7280' }}>
            {programs.length} baseball programs across D1, D2, D3 & JUCO
          </p>

          {/* Search + filters on dark bg */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '8px 12px', flex: '1 1 240px', maxWidth: 400 }}>
              <Search size={14} color="#6b7280" />
              <input
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search schools..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#fff', background: 'transparent' }}
              />
            </div>
            <FilterSelect label="Division" value={division} onChange={setDivision} options={filters.divisions || []} dark />
            <FilterSelect label="Conference" value={conference} onChange={setConference} options={filters.conferences || []} dark />
            <FilterSelect label="State" value={state} onChange={setState} options={filters.states || []} dark />
          </div>
        </div>

        <div style={{ padding: '20px 40px 40px' }}>

        {/* Programs list */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', padding: 40 }}>
            <Loader2 size={16} className="spin" /> Loading programs...
            <style>{'@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}'}</style>
          </div>
        ) : programs.length === 0 ? (
          <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
            No programs found. Run the seed script or adjust your filters.
          </div>
        ) : (
          <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 140px 80px 40px', padding: '10px 16px', borderBottom: `1px solid ${BRD}`, background: '#fafafa', fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>School</span>
              <span>Division</span>
              <span>Conference</span>
              <span>State</span>
              <span></span>
            </div>

            {/* Rows */}
            {programs.map((p) => (
              <ProgramRow
                key={p.id}
                program={p}
                isExpanded={expanded === p.id}
                onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                editingCoach={editingCoach}
                setEditingCoach={setEditingCoach}
                addingCoach={addingCoach}
                setAddingCoach={setAddingCoach}
                onRefresh={loadPrograms}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </TrainerPortalShell>
  )
}

function scholarshipLabel(division) {
  if (division === 'D1') return '11.7 scholarships / ~35 roster spots'
  if (division === 'D2') return '9.0 scholarships'
  if (division === 'D3') return 'No athletic scholarships'
  return null
}

function ProgramRow({ program: p, isExpanded, onToggle, editingCoach, setEditingCoach, addingCoach, setAddingCoach, onRefresh }) {
  const coaches = p.koto_recruiting_coaches || []
  const divColor = p.division === 'D1' ? RED : p.division === 'D2' ? BLUE : p.division === 'JUCO' ? '#f59e0b' : '#6b7280'

  // Private notes — localStorage for now
  const notesKey = `recruiting_note_${p.id}`
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)

  useEffect(() => {
    if (isExpanded) {
      const saved = localStorage.getItem(notesKey)
      if (saved) setNote(saved)
    }
  }, [isExpanded, notesKey])

  function saveNote() {
    localStorage.setItem(notesKey, note)
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 1500)
  }

  const scholarshipInfo = scholarshipLabel(p.division)
  const hasCWSOrRegional = p.cws_appearances || p.regional_appearances_5yr

  return (
    <div style={{ borderBottom: `1px solid #f3f4f6` }}>
      <div
        onClick={onToggle}
        style={{ display: 'grid', gridTemplateColumns: '2fr 80px 140px 80px 40px', padding: '12px 16px', cursor: 'pointer', alignItems: 'center', transition: 'background .1s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
        onMouseLeave={e => e.currentTarget.style.background = ''}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {p.logo_url ? (
            <img src={p.logo_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: 6, background: divColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: divColor, flexShrink: 0 }}>
              {p.school_name[0]}
            </div>
          )}
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: BLK }}>{p.school_name}</span>
            {p.team_name && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>{p.team_name}</span>}
            {coaches.length > 0 && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{coaches.length} coach{coaches.length !== 1 ? 'es' : ''}</span>}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: divColor }}>{p.division}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{p.conference || '—'}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{p.state || '—'}</span>
        <ChevronDown size={14} color="#9ca3af" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s' }} />
      </div>

      {isExpanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
          {/* Program info */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '12px 0', fontSize: 12, color: '#6b7280', alignItems: 'center' }}>
            {p.city && <span>{p.city}, {p.state}</span>}
            {p.website && (
              <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, color: T, textDecoration: 'none' }}>
                <Globe size={11} /> Website <ExternalLink size={9} />
              </a>
            )}
            {p.scholarship_available && <span style={{ color: GRN, fontWeight: 600 }}>Scholarships available</span>}
          </div>

          {/* CWS / Regional highlight bar */}
          {hasCWSOrRegional && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 0 4px' }}>
              {p.cws_appearances && (
                <div style={{ padding: '6px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                  CWS: {p.cws_appearances}
                </div>
              )}
              {p.regional_appearances_5yr > 0 && (
                <div style={{ padding: '6px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                  Regional appearances (5yr): {p.regional_appearances_5yr}
                </div>
              )}
            </div>
          )}

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, padding: '8px 0 12px' }}>
            {p.enrollment > 0 && <StatBox label="Enrollment" value={p.enrollment.toLocaleString()} />}
            {p.tuition_in_state > 0 && <StatBox label="Tuition (in-state)" value={`$${(p.tuition_in_state).toLocaleString()}`} />}
            {p.tuition_out_of_state > 0 && p.tuition_out_of_state !== p.tuition_in_state && <StatBox label="Tuition (out-of-state)" value={`$${(p.tuition_out_of_state).toLocaleString()}`} />}
            {p.roster_size > 0 && <StatBox label="Roster size" value={String(p.roster_size)} />}
            {p.mlb_draft_picks_5yr > 0 && <StatBox label="MLB draft picks (5yr)" value={String(p.mlb_draft_picks_5yr)} highlight />}
            {p.apr_score > 0 && <StatBox label="APR score" value={String(p.apr_score)} />}
            {p.graduation_rate > 0 && <StatBox label="Grad rate" value={`${p.graduation_rate}%`} />}
            {scholarshipInfo && <StatBox label="Scholarships" value={scholarshipInfo} />}
          </div>

          {/* Notable — split into chips */}
          {p.notable && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {p.notable.split(',').map((item, i) => (
                <span key={i} style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: i === 0 ? '#fef3c7' : '#f3f4f6',
                  color: i === 0 ? '#92400e' : '#374151',
                  border: `1px solid ${i === 0 ? '#fde68a' : '#e5e7eb'}`,
                }}>
                  {item.trim()}
                </span>
              ))}
            </div>
          )}

          {/* Facilities notes */}
          {p.facilities_notes && (
            <div style={{ padding: '8px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 12, color: '#0c4a6e', lineHeight: 1.5, marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: '#0369a1' }}>Facilities</span>
              <div style={{ marginTop: 4 }}>{p.facilities_notes}</div>
            </div>
          )}

          {/* Coaches */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: BLK, textTransform: 'uppercase', letterSpacing: '.06em' }}>Coaches</h4>
              <button
                onClick={(e) => { e.stopPropagation(); setAddingCoach(addingCoach === p.id ? null : p.id) }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'none', border: `1px solid ${BRD}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: T, cursor: 'pointer' }}
              >
                <Plus size={11} /> Add coach
              </button>
            </div>

            {coaches.length === 0 && addingCoach !== p.id && (
              <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', padding: '8px 0' }}>No coaches on file yet.</div>
            )}

            {coaches.map((c) => (
              editingCoach === c.id
                ? <CoachEditRow key={c.id} coach={c} onSave={() => { setEditingCoach(null); onRefresh() }} onCancel={() => setEditingCoach(null)} />
                : <CoachRow key={c.id} coach={c} onEdit={() => setEditingCoach(c.id)} onDelete={async () => { await recruitingFetch({ action: 'delete_coach', coach_id: c.id }); onRefresh() }} />
            ))}

            {addingCoach === p.id && (
              <CoachEditRow coach={{ program_id: p.id }} isNew onSave={() => { setAddingCoach(null); onRefresh() }} onCancel={() => setAddingCoach(null)} />
            )}
          </div>

          {/* Private Notes */}
          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: BLK, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Your Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#9ca3af', fontSize: 11 }}>(private — only you can see this)</span>
            </h4>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add private notes about this program..."
              style={{ width: '100%', minHeight: 64, padding: '8px 10px', border: `1px solid ${BRD}`, borderRadius: 8, fontSize: 12, color: BLK, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, background: '#fafafa' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <button
                onClick={saveNote}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'none', border: `1px solid ${BRD}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: BLK, cursor: 'pointer' }}
              >
                <Save size={11} /> Save note
              </button>
              {noteSaved && <span style={{ fontSize: 11, color: GRN, fontWeight: 600 }}>Saved</span>}
            </div>
          </div>

          {/* Source link */}
          {p.source_url && (
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
              <a href={p.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                Data source <ExternalLink size={9} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const TITLE_COLORS = {
  'Head Coach': R,
  'Recruiting Coordinator': '#7c3aed',
  'Pitching Coach': T,
  'Hitting Coach': '#ea580c',
  'Associate Head Coach': '#0369a1',
}

function CoachRow({ coach: c, onEdit, onDelete }) {
  const titleColor = TITLE_COLORS[c.title] || '#6b7280'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f9fafb', fontSize: 13 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, color: BLK }}>{c.full_name}</span>
        {c.title && <span style={{ fontSize: 11, fontWeight: 600, color: titleColor, marginLeft: 8, padding: '2px 8px', background: titleColor + '10', borderRadius: 10 }}>{c.title}</span>}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#6b7280', flexShrink: 0 }}>
        {c.email && <a href={`mailto:${c.email}`} style={{ display: 'flex', alignItems: 'center', gap: 3, color: T, textDecoration: 'none' }}><Mail size={11} /> {c.email}</a>}
        {c.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} /> {c.phone}</span>}
        {c.twitter && <span>@{c.twitter.replace('@', '')}</span>}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={onEdit} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><Edit2 size={12} /></button>
        <button onClick={onDelete} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

const BASEBALL_TITLES = [
  'Head Coach',
  'Associate Head Coach',
  'Assistant Coach',
  'Pitching Coach',
  'Hitting Coach',
  'Recruiting Coordinator',
  'Director of Player Development',
  'Director of Baseball Operations',
  'Volunteer Assistant Coach',
  'Catching Coach',
  'Infield Coach',
  'Outfield Coach',
  'Strength & Conditioning Coach',
  'Sports Information Director',
]

function CoachEditRow({ coach, isNew, onSave, onCancel }) {
  const [form, setForm] = useState({
    full_name: coach.full_name || '',
    title: coach.title || '',
    email: coach.email || '',
    phone: coach.phone || '',
    twitter: coach.twitter || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.full_name.trim()) return
    setSaving(true)
    if (isNew) {
      await recruitingFetch({ action: 'add_coach', program_id: coach.program_id, ...form })
    } else {
      await recruitingFetch({ action: 'update_coach', coach_id: coach.id, ...form })
    }
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 6, padding: '8px 0', borderBottom: '1px solid #f9fafb', alignItems: 'center' }}>
      <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Name *" style={miniInput} />
      <select value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...miniInput, cursor: 'pointer' }}>
        <option value="">Title...</option>
        {BASEBALL_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" style={miniInput} />
      <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" style={miniInput} />
      <input value={form.twitter} onChange={e => setForm({ ...form, twitter: e.target.value })} placeholder="@twitter" style={miniInput} />
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={handleSave} disabled={saving} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: GRN }}><Check size={14} /></button>
        <button onClick={onCancel} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, dark }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '8px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer', outline: 'none', minWidth: 100,
        background: dark ? 'rgba(255,255,255,.08)' : '#fff',
        border: dark ? '1px solid rgba(255,255,255,.12)' : `1px solid ${BRD}`,
        color: value ? (dark ? '#fff' : BLK) : '#6b7280',
      }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function StatBox({ label, value, highlight }) {
  return (
    <div style={{ padding: '8px 10px', background: highlight ? '#fef3c7' : '#f9fafb', borderRadius: 6, border: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: highlight ? '#92400e' : BLK }}>{value}</div>
    </div>
  )
}

const miniInput = {
  padding: '6px 8px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6,
  color: BLK, outline: 'none', width: '100%',
}
