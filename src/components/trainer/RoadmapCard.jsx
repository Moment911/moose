"use client"
import { CheckCircle, TrendingUp } from 'lucide-react'
import { R, T, BLK, GRN } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — RoadmapCard.
//
// Three 30-day phase columns.  Current phase elevates.  Clicking a non-current
// phase fires onSelectPhase(N) so the operator can regenerate workouts for
// that phase.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const GRY5 = '#6b7280'
const GRY7 = '#374151'

export default function RoadmapCard({ roadmap, currentPhase = 1, onSelectPhase }) {
  if (!roadmap) return null
  const phases = Array.isArray(roadmap.phases) ? roadmap.phases : []

  return (
    <section style={cardStyle}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={titleStyle}>90-Day Roadmap</h2>
        <span style={{ color: GRY5, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <TrendingUp size={13} /> Three 30-day blocks
        </span>
      </header>

      {roadmap.client_context_summary && (
        <p style={{ margin: '0 0 18px', color: GRY7, fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>
          {roadmap.client_context_summary}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {phases.map((p) => {
          const n = p.phase_number ?? 1
          const isCurrent = n === currentPhase
          return (
            <button
              key={n}
              type="button"
              onClick={() => !isCurrent && onSelectPhase?.(n)}
              disabled={isCurrent}
              style={{
                textAlign: 'left',
                background: isCurrent ? '#f0fbfc' : '#fafbfd',
                border: `${isCurrent ? 2 : 1}px solid ${isCurrent ? T : BRD}`,
                borderRadius: 12,
                padding: 16,
                cursor: isCurrent ? 'default' : 'pointer',
                boxShadow: isCurrent ? '0 1px 3px rgba(0,194,203,.15)' : 'none',
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) e.currentTarget.style.borderColor = T
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) e.currentTarget.style.borderColor = BRD
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: 20,
                    background: isCurrent ? T : BRD,
                    color: isCurrent ? '#fff' : GRY7,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Phase {n}
                </span>
                {isCurrent && (
                  <span style={{ color: T, fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    Current
                  </span>
                )}
              </div>

              <h3 style={{ margin: '0 0 4px', fontSize: 16, color: BLK, fontWeight: 800 }}>
                {p.phase_name || `Phase ${n}`}
              </h3>
              <div style={{ color: GRY5, fontSize: 11, fontWeight: 700, marginBottom: 12, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                {p.days_range?.start && p.days_range?.end
                  ? `Days ${p.days_range.start}–${p.days_range.end}`
                  : `Days ${(n - 1) * 30 + 1}–${n * 30}`}
              </div>

              <LineLabel label="Training" value={p.training_theme} />
              <LineLabel label="Nutrition" value={p.nutrition_theme} />

              {p.progression_description && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: GRY7, lineHeight: 1.45 }}>
                  {p.progression_description}
                </p>
              )}

              {Array.isArray(p.end_of_phase_milestones) && p.end_of_phase_milestones.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={subLabel}>Milestones</div>
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                    {p.end_of_phase_milestones.map((m, i) => (
                      <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '3px 0', fontSize: 12, color: GRY7 }}>
                        <CheckCircle size={13} color={GRN} style={{ flex: '0 0 auto', marginTop: 2 }} />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(p.recovery_focus) && p.recovery_focus.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={subLabel}>Recovery</div>
                  <ul style={{ margin: 0, paddingLeft: 16, color: GRY5, fontSize: 12 }}>
                    {p.recovery_focus.map((r, i) => (
                      <li key={i} style={{ padding: '2px 0' }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!isCurrent && (
                <div style={{ marginTop: 12, fontSize: 11, color: R, fontWeight: 700 }}>
                  Click to generate workout for this phase →
                </div>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function LineLabel({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8, padding: '2px 0', fontSize: 12 }}>
      <span style={{ color: GRY5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      <span style={{ color: BLK }}>{value}</span>
    </div>
  )
}

const subLabel = {
  color: GRY5,
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 4,
}

const cardStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 12,
  padding: 24,
  marginBottom: 18,
}

const titleStyle = { margin: 0, fontSize: 14, fontWeight: 800, color: T, letterSpacing: '.04em', textTransform: 'uppercase' }
