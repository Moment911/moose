"use client"
import { useMemo } from 'react'
import { CheckCircle, Circle } from 'lucide-react'
// Cal-AI tokens
const T = '#5aa0ff'
const BLK = '#0a0a0a'
const GRN = '#16a34a'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — WorkoutLogGrid.
//
// Summary-level grid indexed by session_day_number.  Shows logged / total sets,
// last-logged timestamp, and opens the WorkoutAccordion to that session when
// clicked.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#ececef'
const BRD_LT = '#f1f1f6'
const GRY5 = '#6b7280'
const GRY7 = '#374151'

export default function WorkoutLogGrid({ workoutPlan, logs = [], onOpenSession, adherence }) {
  const rows = useMemo(() => {
    if (!workoutPlan) return []
    const weeks = Array.isArray(workoutPlan.weeks) ? workoutPlan.weeks : []
    // Aggregate sessions across weeks, keyed by day_number.
    const byDay = new Map()
    for (const week of weeks) {
      for (const s of week.sessions || []) {
        const dn = s.day_number ?? 0
        if (!byDay.has(dn)) {
          const totalSets = (s.blocks || []).reduce((a, b) => {
            return a + (b.exercises || []).reduce((x, ex) => x + (Number(ex.sets) || 0), 0)
          }, 0)
          byDay.set(dn, {
            day_number: dn,
            day_label: s.day_label || `Day ${dn}`,
            session_name: s.session_name || 'Session',
            total_sets: totalSets,
          })
        }
      }
    }
    // Index logs by day_number.
    const logsByDay = new Map()
    for (const log of logs) {
      const dn = log.session_day_number
      if (!logsByDay.has(dn)) logsByDay.set(dn, { count: 0, latest: null })
      const bucket = logsByDay.get(dn)
      bucket.count += 1
      const lastAt = log.logged_at || log.created_at || null
      if (lastAt && (!bucket.latest || new Date(lastAt) > new Date(bucket.latest))) {
        bucket.latest = lastAt
      }
    }
    return Array.from(byDay.values())
      .sort((a, b) => a.day_number - b.day_number)
      .map((row) => {
        const agg = logsByDay.get(row.day_number) || { count: 0, latest: null }
        return { ...row, logged_sets: agg.count, last_logged_at: agg.latest }
      })
  }, [workoutPlan, logs])

  if (!workoutPlan) return null

  return (
    <section style={cardStyle}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={titleStyle}>Workout log</h2>
          <div style={{ color: GRY5, fontSize: 12, marginTop: 4 }}>
            Tap a row to jump to that session
          </div>
        </div>
        {adherence && (
          <div
            style={{
              padding: '8px 14px',
              background: '#f0fdf4',
              border: `1px solid ${GRN}40`,
              borderRadius: 8,
              color: GRY7,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Adherence: <span style={{ color: GRN }}>{Math.round(adherence.adherence_pct ?? 0)}%</span>
            <span style={{ color: GRY5, fontWeight: 600, marginLeft: 6 }}>
              ({adherence.logged_sessions ?? 0}/{adherence.scheduled_sessions ?? 0} sessions)
            </span>
          </div>
        )}
      </header>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: `1px solid ${BRD}` }}>
              <Th>Day</Th>
              <Th>Session</Th>
              <Th>Logged sets</Th>
              <Th>Last logged</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pct = row.total_sets ? Math.min(100, Math.round((row.logged_sets / row.total_sets) * 100)) : 0
              const complete = pct >= 100
              return (
                <tr
                  key={row.day_number}
                  onClick={() => onOpenSession?.(row.day_number)}
                  style={{
                    borderBottom: `1px solid ${BRD_LT}`,
                    cursor: 'pointer',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={td}>
                    <span style={{ color: GRY5, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                      {row.day_label}
                    </span>
                  </td>
                  <td style={{ ...td, color: BLK, fontWeight: 700 }}>{row.session_name}</td>
                  <td style={td}>
                    <span style={{ color: BLK, fontWeight: 700 }}>{row.logged_sets}</span>
                    <span style={{ color: GRY5 }}> / {row.total_sets}</span>
                    <div style={{ marginTop: 4, height: 4, width: 120, background: BRD_LT, borderRadius: 999 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: complete ? GRN : T, borderRadius: 999 }} />
                    </div>
                  </td>
                  <td style={{ ...td, color: GRY7 }}>
                    {row.last_logged_at ? new Date(row.last_logged_at).toLocaleString() : '—'}
                  </td>
                  <td style={td}>
                    {complete ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: GRN, fontWeight: 700 }}>
                        <CheckCircle size={14} /> Complete
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: GRY5 }}>
                        <Circle size={14} /> {row.logged_sets > 0 ? 'In progress' : 'Not started'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 20, color: GRY5, fontSize: 13, textAlign: 'center' }}>
                  No sessions in this block yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Th({ children }) {
  return (
    <th style={{ textAlign: 'left', padding: '10px 14px', color: GRY5, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>
      {children}
    </th>
  )
}

const td = { padding: '10px 14px', verticalAlign: 'top' }

const cardStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}

const titleStyle = { margin: 0, fontSize: 13, fontWeight: 800, color: T, letterSpacing: '.05em', textTransform: 'uppercase' }
