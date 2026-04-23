"use client"
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Star, ChevronDown, Plus, Edit2, Trash2, Check, X, Loader2, ExternalLink, Mail, Phone, Globe, Save, Users, MapPin, Trophy, Building, Newspaper } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { useAuth } from '../../hooks/useAuth'
import { GRN } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/recruiting — College recruiting database.
//
// Browse/search/filter D1/D2/D3 programs, view + edit coach contact info,
// manage hot list per trainee.
//
// Design: dark premium aesthetic — ESPN analytics meets Stripe.
// Palette: blacks, whites, greys only. Red + blue accents.
// ─────────────────────────────────────────────────────────────────────────────

const RED = '#dc2626'
const BLUE = '#2563eb'
const AMBER = '#f59e0b'
const BLK = '#0a0a0a'
const DARK = '#1a1a1a'
const CARD = '#ffffff'
const BODY_BG = '#f3f4f6'
const BORDER_DARK = '#2a2a2a'
const BORDER_LIGHT = '#e5e7eb'
const TEXT_PRIMARY = '#111111'
const TEXT_SECONDARY = '#6b7280'
const TEXT_MUTED = '#9ca3af'

function divisionColor(div) {
  if (div === 'D1') return RED
  if (div === 'D2') return BLUE
  if (div === 'JUCO') return AMBER
  return TEXT_SECONDARY // D3, NAIA, etc.
}

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
      <div style={{ minHeight: '100vh', background: BODY_BG }}>
        {/* Dark gradient header */}
        <div style={{
          background: `linear-gradient(180deg, ${BLK} 0%, ${DARK} 100%)`,
          padding: '32px 40px 28px',
          borderBottom: `1px solid ${BORDER_DARK}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>Programs</h1>
              <p style={{ margin: '6px 0 0', color: TEXT_MUTED, fontSize: 14 }}>
                {loading ? 'Loading...' : `${programs.length} baseball programs`}
              </p>
            </div>
          </div>

          {/* Filters bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#141414', border: `1px solid ${BORDER_DARK}`,
              borderRadius: 10, padding: '8px 14px', flex: '1 1 280px', maxWidth: 400,
            }}>
              <Search size={15} color={TEXT_MUTED} />
              <input
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search schools..."
                style={{
                  flex: 1, border: 'none', outline: 'none', fontSize: 13,
                  color: '#ffffff', background: 'transparent',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <FilterSelect label="Division" value={division} onChange={setDivision} options={filters.divisions || []} />
            <FilterSelect label="Conference" value={conference} onChange={setConference} options={filters.conferences || []} />
            <FilterSelect label="State" value={state} onChange={setState} options={filters.states || []} />
          </div>
        </div>

        {/* Programs list */}
        <div style={{ padding: '24px 40px 40px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: TEXT_SECONDARY, padding: 60, justifyContent: 'center' }}>
              <Loader2 size={18} className="spin" /> Loading programs...
              <style>{'@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}'}</style>
            </div>
          ) : programs.length === 0 ? (
            <div style={{
              background: CARD, border: `1px solid ${BORDER_LIGHT}`, borderRadius: 12,
              padding: 60, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 14,
            }}>
              No programs found. Run the seed script or adjust your filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {programs.map((p) => (
                <ProgramCard
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

// Module-level cache so news is only fetched once per school per session.
const _newsCache = {}

function ProgramCard({ program: p, isExpanded, onToggle, editingCoach, setEditingCoach, addingCoach, setAddingCoach, onRefresh }) {
  const coaches = p.koto_recruiting_coaches || []
  const divColor = divisionColor(p.division)
  const [hovered, setHovered] = useState(false)

  // Recent news for this school
  const [news, setNews] = useState(null) // null = not loaded, [] = loaded empty
  const [newsLoading, setNewsLoading] = useState(false)

  useEffect(() => {
    if (!isExpanded) return
    if (_newsCache[p.school_name]) { setNews(_newsCache[p.school_name]); return }
    if (news !== null) return // already fetched this mount
    setNewsLoading(true)
    fetch(`/api/trainer/news?school=${encodeURIComponent(p.school_name)}`)
      .then(r => r.json())
      .then(d => {
        const articles = (d.articles || []).slice(0, 5)
        _newsCache[p.school_name] = articles
        setNews(articles)
      })
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false))
  }, [isExpanded, p.school_name]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div style={{
      background: CARD,
      borderRadius: 12,
      border: `1px solid ${BORDER_LIGHT}`,
      overflow: 'hidden',
      boxShadow: hovered && !isExpanded
        ? '0 4px 16px rgba(0,0,0,0.08)'
        : '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s ease',
    }}>
      {/* Card header row */}
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', padding: '14px 20px',
          cursor: 'pointer', gap: 16,
        }}
      >
        {/* Logo */}
        <div style={{ flexShrink: 0 }}>
          {p.logo_url ? (
            <img src={p.logo_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: divColor + '12', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 16, fontWeight: 800, color: divColor,
            }}>
              {p.school_name[0]}
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>{p.school_name}</span>
            {p.team_name && <span style={{ fontSize: 13, color: TEXT_MUTED }}>{p.team_name}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3 }}>
            {p.conference && <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{p.conference}</span>}
            {p.state && <span style={{ fontSize: 12, color: TEXT_MUTED }}>{p.state}</span>}
          </div>
        </div>

        {/* Division badge */}
        <div style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800,
          background: divColor + '14', color: divColor,
          textTransform: 'uppercase', letterSpacing: '.06em',
        }}>
          {p.division}
        </div>

        {/* Coach count badge */}
        {coaches.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: '#f3f4f6', color: TEXT_SECONDARY,
          }}>
            <Users size={11} />
            {coaches.length}
          </div>
        )}

        {/* Chevron */}
        <ChevronDown
          size={16} color={TEXT_MUTED}
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform .2s ease',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${BORDER_LIGHT}`, padding: '20px 24px' }}>
          {/* Program info row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: TEXT_SECONDARY, alignItems: 'center', marginBottom: 16 }}>
            {p.city && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} color={TEXT_MUTED} /> {p.city}, {p.state}
              </span>
            )}
            {p.website && (
              <a href={p.website} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 4, color: BLUE, textDecoration: 'none', fontWeight: 500 }}>
                <Globe size={12} /> Website <ExternalLink size={10} />
              </a>
            )}
            {p.scholarship_available && (
              <span style={{ color: GRN, fontWeight: 700, fontSize: 12 }}>Scholarships available</span>
            )}
          </div>

          {/* CWS / Regional highlight bar */}
          {hasCWSOrRegional && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {p.cws_appearances && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', background: AMBER + '10', border: `1px solid ${AMBER}30`,
                  borderRadius: 10,
                }}>
                  <Trophy size={16} color={AMBER} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em' }}>College World Series</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>{p.cws_appearances}</div>
                  </div>
                </div>
              )}
              {p.regional_appearances_5yr > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', background: AMBER + '10', border: `1px solid ${AMBER}30`,
                  borderRadius: 10,
                }}>
                  <Trophy size={16} color={AMBER} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em' }}>Regional Appearances (5yr)</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#78350f' }}>{p.regional_appearances_5yr}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            {p.enrollment > 0 && <StatBox label="Enrollment" value={p.enrollment.toLocaleString()} />}
            {p.tuition_in_state > 0 && <StatBox label="Tuition (in-state)" value={`$${(p.tuition_in_state).toLocaleString()}`} />}
            {p.tuition_out_of_state > 0 && p.tuition_out_of_state !== p.tuition_in_state && <StatBox label="Tuition (out-of-state)" value={`$${(p.tuition_out_of_state).toLocaleString()}`} />}
            {p.roster_size > 0 && <StatBox label="Roster size" value={String(p.roster_size)} />}
            {p.mlb_draft_picks_5yr > 0 && <StatBox label="MLB draft picks (5yr)" value={String(p.mlb_draft_picks_5yr)} highlight />}
            {p.apr_score > 0 && <StatBox label="APR score" value={String(p.apr_score)} />}
            {p.graduation_rate > 0 && <StatBox label="Grad rate" value={`${p.graduation_rate}%`} />}
            {scholarshipInfo && <StatBox label="Scholarships" value={scholarshipInfo} />}
          </div>

          {/* Notable */}
          {p.notable && (
            <div style={{
              padding: '12px 16px', background: '#f9fafb', border: `1px solid ${BORDER_LIGHT}`,
              borderRadius: 10, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6, marginBottom: 16,
              borderLeft: `3px solid ${BLUE}`,
            }}>
              {p.notable}
            </div>
          )}

          {/* Facilities notes */}
          {p.facilities_notes && (
            <div style={{
              padding: '12px 16px', background: '#f9fafb', border: `1px solid ${BORDER_LIGHT}`,
              borderRadius: 10, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6, marginBottom: 16,
              borderLeft: `3px solid ${TEXT_MUTED}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Building size={12} color={TEXT_MUTED} />
                <span style={{ fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: TEXT_SECONDARY }}>Facilities</span>
              </div>
              <div>{p.facilities_notes}</div>
            </div>
          )}

          {/* Recent News */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Newspaper size={12} color={TEXT_MUTED} />
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY, textTransform: 'uppercase', letterSpacing: '.06em' }}>Recent News</h4>
            </div>
            {newsLoading ? (
              <div style={{ fontSize: 12, color: TEXT_MUTED, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
                <Loader2 size={12} className="spin" /> Loading news...
              </div>
            ) : news && news.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {news.map((article, i) => (
                  <a
                    key={i}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      gap: 12, padding: '8px 12px', background: '#f9fafb',
                      border: `1px solid ${BORDER_LIGHT}`, borderRadius: 8,
                      textDecoration: 'none', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f1f3'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f9fafb'}
                  >
                    <span style={{ fontSize: 13, color: BLUE, fontWeight: 500, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
                      {article.title}
                    </span>
                    <span style={{ fontSize: 11, color: TEXT_MUTED, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {article.source}{article.date ? ` \u00B7 ${new Date(article.date).toLocaleDateString()}` : ''}
                    </span>
                  </a>
                ))}
              </div>
            ) : news && news.length === 0 ? (
              <div style={{ fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic', padding: '4px 0' }}>No recent news found.</div>
            ) : null}
          </div>

          {/* Coaches */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY, textTransform: 'uppercase', letterSpacing: '.06em' }}>Coaching Staff</h4>
              <button
                onClick={(e) => { e.stopPropagation(); setAddingCoach(addingCoach === p.id ? null : p.id) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', background: 'none',
                  border: `1px solid ${BORDER_LIGHT}`, borderRadius: 8,
                  fontSize: 12, fontWeight: 600, color: BLUE, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = BLUE + '08'; e.currentTarget.style.borderColor = BLUE + '40' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = BORDER_LIGHT }}
              >
                <Plus size={12} /> Add coach
              </button>
            </div>

            {coaches.length === 0 && addingCoach !== p.id && (
              <div style={{ fontSize: 13, color: TEXT_MUTED, fontStyle: 'italic', padding: '12px 0' }}>No coaches on file yet.</div>
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
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Your Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: TEXT_MUTED, fontSize: 11 }}>(private)</span>
            </h4>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add private notes about this program..."
              style={{
                width: '100%', minHeight: 64, padding: '10px 12px',
                border: `1px solid ${BORDER_LIGHT}`, borderRadius: 10,
                fontSize: 13, color: TEXT_PRIMARY, resize: 'vertical',
                outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                background: '#fafafa',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button
                onClick={saveNote}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', background: 'none',
                  border: `1px solid ${BORDER_LIGHT}`, borderRadius: 8,
                  fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, cursor: 'pointer',
                }}
              >
                <Save size={12} /> Save note
              </button>
              {noteSaved && <span style={{ fontSize: 12, color: GRN, fontWeight: 600 }}>Saved</span>}
            </div>
          </div>

          {/* Source link */}
          {p.source_url && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
              <a href={p.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: TEXT_MUTED, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
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
  'Head Coach': RED,
  'Recruiting Coordinator': '#7c3aed',
  'Pitching Coach': BLUE,
  'Hitting Coach': '#ea580c',
  'Associate Head Coach': '#0369a1',
}

function CoachRow({ coach: c, onEdit, onDelete }) {
  const titleColor = TITLE_COLORS[c.title] || TEXT_SECONDARY
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, color: TEXT_PRIMARY }}>{c.full_name}</span>
        {c.title && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: titleColor, marginLeft: 10,
            padding: '3px 10px', background: titleColor + '12', borderRadius: 12,
          }}>
            {c.title}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: TEXT_SECONDARY, flexShrink: 0 }}>
        {c.email && (
          <a href={`mailto:${c.email}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: BLUE, textDecoration: 'none', fontWeight: 500 }}>
            <Mail size={12} /> {c.email}
          </a>
        )}
        {c.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {c.phone}</span>}
        {c.twitter && <span style={{ color: TEXT_MUTED }}>@{c.twitter.replace('@', '')}</span>}
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button onClick={onEdit} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED, borderRadius: 6, transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = TEXT_PRIMARY}
          onMouseLeave={e => e.currentTarget.style.color = TEXT_MUTED}
        ><Edit2 size={13} /></button>
        <button onClick={onDelete} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED, borderRadius: 6, transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = RED}
          onMouseLeave={e => e.currentTarget.style.color = TEXT_MUTED}
        ><Trash2 size={13} /></button>
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
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto',
      gap: 8, padding: '10px 0', borderBottom: '1px solid #f3f4f6', alignItems: 'center',
    }}>
      <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Name *" style={miniInput} />
      <select value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...miniInput, cursor: 'pointer' }}>
        <option value="">Title...</option>
        {BASEBALL_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" style={miniInput} />
      <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" style={miniInput} />
      <input value={form.twitter} onChange={e => setForm({ ...form, twitter: e.target.value })} placeholder="@twitter" style={miniInput} />
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={handleSave} disabled={saving} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: GRN }}><Check size={15} /></button>
        <button onClick={onCancel} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED }}><X size={15} /></button>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '8px 12px', border: `1px solid ${BORDER_DARK}`,
        borderRadius: 10, fontSize: 12, fontWeight: 500,
        color: value ? '#ffffff' : TEXT_MUTED,
        background: '#141414', cursor: 'pointer', outline: 'none', minWidth: 110,
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 28,
      }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function StatBox({ label, value, highlight }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: highlight ? AMBER + '10' : '#f9fafb',
      borderRadius: 10,
      border: `1px solid ${highlight ? AMBER + '25' : '#e5e7eb'}`,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: highlight ? '#92400e' : TEXT_MUTED,
        textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: highlight ? '#78350f' : TEXT_PRIMARY, fontFamily: '"Barlow Condensed", system-ui, sans-serif', letterSpacing: '-.02em' }}>{value}</div>
    </div>
  )
}

const miniInput = {
  padding: '7px 10px', fontSize: 13, border: `1px solid ${BORDER_LIGHT}`, borderRadius: 8,
  color: TEXT_PRIMARY, outline: 'none', width: '100%', fontFamily: 'inherit',
}
