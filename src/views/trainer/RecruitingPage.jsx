"use client"
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Star, ChevronDown, Plus, Edit2, Trash2, Check, X, Loader2, ExternalLink, Mail, Phone, Globe } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../hooks/useAuth'
import { R, T, BLK, GRN } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/recruiting — College recruiting database.
//
// Browse/search/filter D1/D2/D3 programs, view + edit coach contact info,
// manage hot list per trainee.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'

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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 40px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, color: BLK }}>Recruiting</h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
              {programs.length} baseball programs loaded
            </p>
          </div>
        </header>

        {/* Filters bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${BRD}`, borderRadius: 8, padding: '6px 10px', flex: '1 1 240px', maxWidth: 360 }}>
            <Search size={14} color="#9ca3af" />
            <input
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search schools..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: BLK, background: 'transparent' }}
            />
          </div>
          <FilterSelect label="Division" value={division} onChange={setDivision} options={filters.divisions || []} />
          <FilterSelect label="Conference" value={conference} onChange={setConference} options={filters.conferences || []} />
          <FilterSelect label="State" value={state} onChange={setState} options={filters.states || []} />
        </div>

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
      </main>
    </div>
  )
}

function ProgramRow({ program: p, isExpanded, onToggle, editingCoach, setEditingCoach, addingCoach, setAddingCoach, onRefresh }) {
  const coaches = p.koto_recruiting_coaches || []
  const divColor = p.division === 'D1' ? R : p.division === 'D2' ? T : '#6b7280'

  return (
    <div style={{ borderBottom: `1px solid #f3f4f6` }}>
      <div
        onClick={onToggle}
        style={{ display: 'grid', gridTemplateColumns: '2fr 80px 140px 80px 40px', padding: '12px 16px', cursor: 'pointer', alignItems: 'center', transition: 'background .1s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
        onMouseLeave={e => e.currentTarget.style.background = ''}
      >
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: BLK }}>{p.school_name}</span>
          {p.team_name && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>{p.team_name}</span>}
          {coaches.length > 0 && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{coaches.length} coach{coaches.length !== 1 ? 'es' : ''}</span>}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: divColor }}>{p.division}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{p.conference || '—'}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{p.state || '—'}</span>
        <ChevronDown size={14} color="#9ca3af" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s' }} />
      </div>

      {isExpanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
          {/* Program info */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '12px 0', fontSize: 12, color: '#6b7280' }}>
            {p.city && <span>{p.city}, {p.state}</span>}
            {p.website && (
              <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, color: T, textDecoration: 'none' }}>
                <Globe size={11} /> Website
              </a>
            )}
            {p.scholarship_available && <span style={{ color: GRN, fontWeight: 600 }}>Scholarships available</span>}
          </div>

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
        </div>
      )}
    </div>
  )
}

function CoachRow({ coach: c, onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f9fafb', fontSize: 13 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, color: BLK }}>{c.full_name}</span>
        {c.title && <span style={{ color: '#9ca3af', marginLeft: 6 }}>— {c.title}</span>}
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
      <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" style={miniInput} />
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

function FilterSelect({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: '8px 10px', border: `1px solid ${BRD}`, borderRadius: 8, fontSize: 12, color: value ? BLK : '#9ca3af', background: '#fff', cursor: 'pointer', outline: 'none', minWidth: 100 }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

const miniInput = {
  padding: '6px 8px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6,
  color: BLK, outline: 'none', width: '100%',
}
