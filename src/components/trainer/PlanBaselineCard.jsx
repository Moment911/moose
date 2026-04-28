"use client"
import { AlertTriangle, Target, Dumbbell, Utensils, Flame, Loader2 } from 'lucide-react'
// Cal-AI tokens — warm neutral palette
const INK = '#0a0a0a'
const INK2 = '#1f1f22'
const INK3 = '#6b6b70'
const ACCENT = '#d89a6a'
const ACCENT_BG = 'rgba(216,154,106,0.10)'
const GRN = '#10b981'
const RED = '#e9695c'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

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

const FITNESS_LABELS = {
  deconditioned: 'Deconditioned',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const FITNESS_COLORS = {
  deconditioned: '#f0b400',
  beginner: ACCENT,
  intermediate: GRN,
  advanced: RED,
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
            padding: '4px 12px',
            borderRadius: 999,
            background: (FITNESS_COLORS[baseline.starting_fitness_level] || ACCENT) + '15',
            color: FITNESS_COLORS[baseline.starting_fitness_level] || ACCENT,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.03em',
            textTransform: 'uppercase',
            fontFamily: FONT,
          }}
        >
          {FITNESS_LABELS[baseline.starting_fitness_level] || baseline.starting_fitness_level || '—'}
        </span>
      </header>

      {/* Body composition line */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, color: INK2, fontSize: 13, fontFamily: FONT }}>
        <span>
          <strong style={{ color: INK }}>BMI:</strong>{' '}
          {bc.bmi_or_null ?? '—'}
        </span>
        <span style={{ color: INK3 }}>·</span>
        <span>
          <strong style={{ color: INK }}>Category:</strong>{' '}
          {CATEGORY_LABELS[bc.category] || bc.category || '—'}
        </span>
        {bc.notes && (
          <>
            <span style={{ color: INK3 }}>·</span>
            <span style={{ color: INK3, fontStyle: 'italic' }}>{bc.notes}</span>
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
        <Tile icon={<Flame size={14} />} label="kcal / day" value={fmtInt(baseline.calorie_target_kcal)} highlight={true} />
        <Tile icon={<Dumbbell size={14} />} label="Protein" value={`${fmtInt(macros.protein_g)} g`} />
        <Tile icon={<Utensils size={14} />} label="Fat" value={`${fmtInt(macros.fat_g)} g`} />
        <Tile icon={<Utensils size={14} />} label="Carbs" value={`${fmtInt(macros.carb_g)} g`} />
      </div>

      {/* Top 3 focus areas — hero */}
      {focus.length > 0 && (
        <div
          style={{
            background: '#fff',
            border: `1px solid ${BRD}`,
            borderLeft: `4px solid ${INK}`,
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: INK, fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', fontFamily: FONT }}>
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
                    background: INK,
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
                <span style={{ color: INK, fontSize: 14, lineHeight: 1.45, fontFamily: FONT }}>{f}</span>
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
            padding: '14px 18px',
            borderLeft: `3px solid ${ACCENT}`,
            background: ACCENT_BG,
            borderRadius: '0 12px 12px 0',
            fontSize: 14,
            color: INK2,
            fontStyle: 'italic',
            lineHeight: 1.55,
            fontFamily: FONT,
          }}
        >
          "{baseline.coach_summary}"
          <footer style={{ marginTop: 6, fontSize: 12, color: INK3, fontStyle: 'normal' }}>
            — Your Coach
          </footer>
        </blockquote>
      )}

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: INK3, fontSize: 11, maxWidth: 520 }}>
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

function Tile({ icon, label, value, highlight }) {
  return (
    <div
      style={{
        background: highlight ? ACCENT_BG : '#f9fafb',
        border: `1px solid ${highlight ? ACCENT + '30' : BRD}`,
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: INK3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, fontFamily: FONT }}>
        {icon} {label}
      </div>
      <div style={{ color: INK, fontSize: 20, fontWeight: 700, fontFamily: FONT }}>{value}</div>
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
  borderRadius: 16,
  padding: 22,
  marginBottom: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
  fontFamily: FONT,
}

const titleStyle = { margin: 0, fontSize: 13, fontWeight: 700, color: INK3, letterSpacing: '.04em', textTransform: 'uppercase', fontFamily: FONT }

function btnSecondary(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: '#fff',
    color: disabled ? '#c8c8cc' : INK2,
    border: `1px solid ${BRD}`,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: FONT,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
