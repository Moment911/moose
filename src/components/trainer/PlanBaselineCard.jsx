"use client"
import { AlertTriangle, Target, Dumbbell, Utensils, Flame, Loader2 } from 'lucide-react'
import { R, T, BLK, GRN } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — PlanBaselineCard.
//
// Renders a BaselineOutput:
//   - body composition line (BMI + category)
//   - starting fitness pill
//   - training readiness block (prominent red panel when ok_to_train=false)
//   - 4 calorie/macro tiles
//   - top 3 focus areas (the visual hero)
//   - coach summary quote
//   - disclaimer + regenerate CTA
//
// Voice: "$150/hour personal trainer + nutritionist."  UI copy matches —
// specific, outcome-oriented, no friendly-fluff.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#ececef'
const GRY7 = '#374151'
const GRY5 = '#6b7280'

const FITNESS_LABELS = {
  deconditioned: 'Deconditioned',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const FITNESS_COLORS = {
  deconditioned: '#f59e0b',
  beginner: T,
  intermediate: GRN,
  advanced: R,
}

const CATEGORY_LABELS = {
  underweight: 'Underweight',
  normal: 'Normal',
  overweight: 'Overweight',
  obese: 'Obese',
  unknown: 'Unknown (height not recorded)',
}

export default function PlanBaselineCard({ baseline, onRegenerate, regenerating = false }) {
  if (!baseline) return null

  const bc = baseline.body_composition || {}
  const tr = baseline.training_readiness || {}
  const okToTrain = tr.ok_to_train !== false
  const macros = baseline.macro_targets_g || {}
  const focus = Array.isArray(baseline.top_3_focus_areas) ? baseline.top_3_focus_areas : []

  return (
    <section style={cardStyle}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={titleStyle}>Baseline</h2>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 20,
            background: (FITNESS_COLORS[baseline.starting_fitness_level] || T) + '15',
            color: FITNESS_COLORS[baseline.starting_fitness_level] || T,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
          }}
        >
          {FITNESS_LABELS[baseline.starting_fitness_level] || baseline.starting_fitness_level || '—'}
        </span>
      </header>

      {/* Body composition line */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, color: GRY7, fontSize: 13 }}>
        <span>
          <strong style={{ color: BLK }}>BMI:</strong>{' '}
          {bc.bmi_or_null ?? '—'}
        </span>
        <span style={{ color: GRY5 }}>·</span>
        <span>
          <strong style={{ color: BLK }}>Category:</strong>{' '}
          {CATEGORY_LABELS[bc.category] || bc.category || '—'}
        </span>
        {bc.notes && (
          <>
            <span style={{ color: GRY5 }}>·</span>
            <span style={{ color: GRY5, fontStyle: 'italic' }}>{bc.notes}</span>
          </>
        )}
      </div>

      {/* Training readiness — red panel if not ok */}
      {!okToTrain && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#991b1b', fontWeight: 800, fontSize: 14 }}>
            <AlertTriangle size={16} />
            Not cleared to train — route to physician
          </div>
          {Array.isArray(tr.red_flags) && tr.red_flags.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 20, color: '#991b1b', fontSize: 13 }}>
              {tr.red_flags.map((f, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{f}</li>
              ))}
            </ul>
          )}
          {Array.isArray(tr.modifications_required) && tr.modifications_required.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#7f1d1d' }}>
              <strong>Modifications required:</strong>{' '}
              {tr.modifications_required.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* When ok_to_train but modifications exist, render quieter amber note */}
      {okToTrain && Array.isArray(tr.modifications_required) && tr.modifications_required.length > 0 && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 18,
            color: '#92400e',
            fontSize: 13,
          }}
        >
          <strong>Programming modifications:</strong>{' '}
          {tr.modifications_required.join(', ')}
        </div>
      )}

      {/* Calorie + macro tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <Tile icon={<Flame size={14} />} label="kcal / day" value={fmtInt(baseline.calorie_target_kcal)} />
        <Tile icon={<Dumbbell size={14} />} label="Protein" value={`${fmtInt(macros.protein_g)} g`} />
        <Tile icon={<Utensils size={14} />} label="Fat" value={`${fmtInt(macros.fat_g)} g`} />
        <Tile icon={<Utensils size={14} />} label="Carbs" value={`${fmtInt(macros.carb_g)} g`} />
      </div>

      {/* Top 3 focus areas — hero */}
      {focus.length > 0 && (
        <div
          style={{
            background: '#fafbfd',
            border: `1px solid ${BRD}`,
            borderLeft: `4px solid ${R}`,
            borderRadius: 10,
            padding: '16px 18px',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: R, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            <Target size={14} /> Top 3 focus areas
          </div>
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', counterReset: 'focus' }}>
            {focus.map((f, i) => (
              <li
                key={i}
                style={{
                  counterIncrement: 'focus',
                  padding: '8px 0',
                  borderBottom: i < focus.length - 1 ? `1px solid ${BRD}` : 'none',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    minWidth: 24,
                    height: 24,
                    borderRadius: 12,
                    background: R,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ color: BLK, fontSize: 14, lineHeight: 1.45 }}>{f}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Coach summary quote */}
      {baseline.coach_summary && (
        <blockquote
          style={{
            margin: '0 0 16px',
            padding: '12px 16px',
            borderLeft: `3px solid ${T}`,
            background: '#f0fbfc',
            borderRadius: '0 10px 10px 0',
            fontSize: 14,
            color: GRY7,
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          “{baseline.coach_summary}”
          <footer style={{ marginTop: 6, fontSize: 12, color: GRY5, fontStyle: 'normal' }}>
            — Alex, Koto Trainer
          </footer>
        </blockquote>
      )}

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: GRY5, fontSize: 11, maxWidth: 520 }}>
          {baseline.disclaimer || 'Not medical advice. Consult your physician before starting any new program.'}
        </span>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            style={btnSecondary(regenerating)}
          >
            {regenerating ? <Loader2 size={13} /> : null}
            {regenerating ? 'Regenerating…' : 'Regenerate baseline'}
          </button>
        )}
      </footer>
    </section>
  )
}

function Tile({ icon, label, value }) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${BRD}`,
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: GRY5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
        {icon} {label}
      </div>
      <div style={{ color: BLK, fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

function fmtInt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Math.round(Number(n)).toLocaleString()
}

const cardStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}

const titleStyle = { margin: 0, fontSize: 13, fontWeight: 800, color: T, letterSpacing: '.05em', textTransform: 'uppercase' }

function btnSecondary(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: '#fff',
    color: disabled ? '#9ca3af' : GRY7,
    border: `1px solid ${BRD}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
