"use client"
import { useEffect, useState } from 'react'
import { Loader2, ChevronDown, Award, MapPin, Users } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { useAuth } from '../../hooks/useAuth'
// Cal-AI tokens
const R = '#e9695c'
const T = '#5aa0ff'
const BLK = '#0a0a0a'
const GRN = '#16a34a'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/propath — ProPath Score results page.
//
// Select a trainee, then view their program-fit scores grouped by category:
// Dream / Target / Safety / Long Shot.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#ececef'

const CATEGORY_META = {
  dream:     { label: 'Dream Schools',  color: '#7c3aed', bg: '#7c3aed10', order: 0 },
  target:    { label: 'Target Schools', color: '#059669', bg: '#05966910', order: 1 },
  safety:    { label: 'Safety Schools', color: '#0891b2', bg: '#0891b210', order: 2 },
  long_shot: { label: 'Long Shots',    color: '#6b7280', bg: '#6b728010', order: 3 },
}

function scoreColor(score) {
  if (score >= 80) return GRN
  if (score >= 60) return '#059669'
  if (score >= 40) return '#f59e0b'
  if (score >= 20) return '#ea580c'
  return '#ef4444'
}

function gradeColor(grade) {
  if (grade === 'A') return GRN
  if (grade === 'B') return '#059669'
  if (grade === 'C') return '#f59e0b'
  return '#ef4444'
}

function divisionColor(div) {
  if (div === 'D1' || div === 'NCAA D1') return R
  if (div === 'D2' || div === 'NCAA D2') return T
  return '#6b7280'
}

async function recruitingFetch(body) {
  const res = await fetch('/api/trainer/recruiting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default function ProPathPage() {
  const { agencyId } = useAuth()
  const [trainees, setTrainees] = useState([])
  const [traineesLoading, setTraineesLoading] = useState(true)
  const [selectedTrainee, setSelectedTrainee] = useState('')
  const [results, setResults] = useState(null)
  const [profileUsed, setProfileUsed] = useState(null)
  const [totalPrograms, setTotalPrograms] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load trainees list.
  useEffect(() => {
    if (!agencyId) return
    async function load() {
      try {
        const res = await trainerFetch({ action: 'list' }, { agencyId })
        if (!res.ok) { setTraineesLoading(false); return }
        const data = await res.json()
        setTrainees(data.trainees || data || [])
      } catch (err) {
        console.error('Failed to load trainees', err)
      } finally {
        setTraineesLoading(false)
      }
    }
    load()
  }, [agencyId])

  // Fetch ProPath scores when a trainee is selected.
  useEffect(() => {
    if (!selectedTrainee) {
      setResults(null)
      return
    }
    let cancelled = false
    async function fetch_() {
      setLoading(true)
      setError(null)
      try {
        const data = await recruitingFetch({
          action: 'propath_score',
          trainee_id: selectedTrainee,
        })
        if (cancelled) return
        if (data.error) {
          setError(data.error)
          setResults(null)
        } else {
          setResults(data.results || [])
          setProfileUsed(data.profile_used || null)
          setTotalPrograms(data.total_programs || 0)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch_()
    return () => { cancelled = true }
  }, [selectedTrainee])

  // Group results by category.
  const grouped = {}
  if (results) {
    for (const r of results) {
      const cat = r.category || 'long_shot'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(r)
    }
    // Sort each group by score descending.
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => b.score - a.score)
    }
  }

  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (CATEGORY_META[a]?.order ?? 99) - (CATEGORY_META[b]?.order ?? 99)
  )

  const selectedTraineeObj = trainees.find(t => t.id === selectedTrainee)

  return (
    <TrainerPortalShell>
      <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
        {/* Header */}
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: BLK }}>ProPath Score</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            AI-powered program fit analysis for your athletes
          </p>
        </header>

        {/* Trainee selector */}
        <div style={{
          background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10,
          padding: '16px 20px', marginBottom: 24,
        }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, display: 'block' }}>
            Select Athlete
          </label>
          {traineesLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: 13, padding: '6px 0' }}>
              <Loader2 size={14} className="spin" /> Loading athletes...
              <style>{'@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}'}</style>
            </div>
          ) : (
            <div style={{ position: 'relative', maxWidth: 400 }}>
              <select
                value={selectedTrainee}
                onChange={e => setSelectedTrainee(e.target.value)}
                style={{
                  width: '100%', padding: '10px 36px 10px 12px', fontSize: 14, fontWeight: 600,
                  border: `1px solid ${BRD}`, borderRadius: 8, color: selectedTrainee ? BLK : '#9ca3af',
                  background: '#fff', cursor: 'pointer', outline: 'none',
                  appearance: 'none', WebkitAppearance: 'none',
                }}
              >
                <option value="">Choose a trainee...</option>
                {trainees.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.full_name || t.email || 'Unnamed'}{t.grad_year ? ` (${t.grad_year})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} color="#9ca3af" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', padding: 40, justifyContent: 'center' }}>
            <Loader2 size={18} className="spin" />
            <span style={{ fontSize: 14 }}>Analyzing program fit...</span>
            <style>{'@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}'}</style>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', color: '#991b1b', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Profile summary */}
        {profileUsed && !loading && results && (
          <div style={{
            background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10,
            padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              <span style={{ fontWeight: 700, color: BLK }}>{selectedTraineeObj?.first_name} {selectedTraineeObj?.last_name}</span>
              {' '}scored against <span style={{ fontWeight: 700, color: BLK }}>{totalPrograms}</span> programs
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sortedCategories.map(cat => {
                const meta = CATEGORY_META[cat] || CATEGORY_META.long_shot
                return (
                  <span key={cat} style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: meta.bg, color: meta.color,
                  }}>
                    {grouped[cat].length} {meta.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && selectedTrainee && results && results.length === 0 && (
          <div style={{
            background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10,
            padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 14,
          }}>
            No program matches found. Make sure the athlete profile has enough data for scoring.
          </div>
        )}

        {/* No selection prompt */}
        {!selectedTrainee && !loading && (
          <div style={{
            background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10,
            padding: 60, textAlign: 'center',
          }}>
            <Users size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#6b7280' }}>Select an athlete above to see their ProPath scores</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>We will analyze their profile against every program in the database</p>
          </div>
        )}

        {/* Results grouped by category */}
        {!loading && results && results.length > 0 && sortedCategories.map(cat => {
          const meta = CATEGORY_META[cat] || CATEGORY_META.long_shot
          const items = grouped[cat]
          return (
            <CategorySection key={cat} meta={meta} items={items} />
          )
        })}
      </div>
    </TrainerPortalShell>
  )
}

// ── Category section ────────────────────────────────────────────────────────

function CategorySection({ meta, items }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 16px', marginBottom: collapsed ? 0 : 12,
          background: meta.bg, border: `1px solid ${meta.color}20`,
          borderRadius: collapsed ? 10 : '10px 10px 0 0',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0,
        }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: meta.color, flex: 1 }}>
          {meta.label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, opacity: 0.7 }}>
          {items.length} program{items.length !== 1 ? 's' : ''}
        </span>
        <ChevronDown size={14} color={meta.color} style={{
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform .15s',
        }} />
      </button>

      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {items.map(r => (
            <ResultCard key={r.program_id} result={r} catColor={meta.color} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Result card ─────────────────────────────────────────────────────────────

function ResultCard({ result: r, catColor }) {
  const sc = scoreColor(r.score)
  const gc = gradeColor(r.grade)
  const dc = divisionColor(r.division)

  return (
    <div style={{
      background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10,
      padding: '16px 18px', transition: 'box-shadow .12s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.06)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Top row: school name + score */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: BLK, lineHeight: 1.3 }}>
            {r.school_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {/* Division badge */}
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
              background: dc + '15', color: dc, letterSpacing: '.03em',
            }}>
              {r.division}
            </span>
            {/* Conference */}
            {r.conference && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>{r.conference}</span>
            )}
            {/* State */}
            {r.state && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#9ca3af' }}>
                <MapPin size={10} /> {r.state}
              </span>
            )}
          </div>
        </div>

        {/* Score + grade */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: sc + '12', border: `2px solid ${sc}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: sc,
          }}>
            {r.score}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 800, color: gc, marginTop: 3,
            padding: '1px 8px', borderRadius: 10, background: gc + '10',
          }}>
            {r.grade}
          </span>
        </div>
      </div>

      {/* Reasons */}
      {r.reasons && r.reasons.length > 0 && (
        <ul style={{
          margin: 0, padding: '0 0 0 16px', fontSize: 12, lineHeight: 1.7,
          color: '#4b5563',
        }}>
          {r.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
