import { useState, useEffect, useRef } from 'react'
import { Check, Circle } from 'lucide-react'
import { cmToFeetInches, kgToLbs } from '../../lib/trainer/units'

// ─────────────────────────────────────────────────────────────────────────────
// IntakeLiveCard — real-time field display (Cal-AI restyle).
// ─────────────────────────────────────────────────────────────────────────────

// Cal-AI tokens
const INK = '#0a0a0a'
const INK3 = '#6b6b70'
const ACCENT = '#d89a6a'
const GRN = '#10b981'
const BRD = '#ececef'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

const GOAL_LABELS = { lose_fat: 'Lose fat', gain_muscle: 'Gain muscle', maintain: 'Maintain', performance: 'Performance', recomp: 'Recomp' }
const EQUIPMENT_LABELS = { none: 'None', bands: 'Bands', home_gym: 'Home gym', full_gym: 'Full gym' }
const DIET_LABELS = { none: 'No preference', vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', keto: 'Keto', paleo: 'Paleo', custom: 'Custom' }
const OCCUPATION_LABELS = { sedentary: 'Sedentary', light: 'Light', moderate: 'Moderate', heavy: 'Heavy' }

const FIELD_DEFS = [
  { key: 'full_name', label: 'Name' },
  { key: 'age', label: 'Age', suffix: ' yrs' },
  { key: 'sex', label: 'Sex', map: { M: 'Male', F: 'Female', Other: 'Other' } },
  { key: 'height_cm', label: 'Height', format: 'height' },
  { key: 'current_weight_kg', label: 'Weight', format: 'weight' },
  { key: 'primary_goal', label: 'Goal', map: GOAL_LABELS },
  { key: 'training_experience_years', label: 'Experience', suffix: ' yrs' },
  { key: 'training_days_per_week', label: 'Days/week', suffix: ' days' },
  { key: 'equipment_access', label: 'Equipment', map: EQUIPMENT_LABELS },
  { key: 'medical_flags', label: 'Medical' },
  { key: 'injuries', label: 'Injuries' },
  { key: 'dietary_preference', label: 'Diet', map: DIET_LABELS },
  { key: 'allergies', label: 'Allergies' },
  { key: 'sleep_hours_avg', label: 'Sleep', suffix: ' hrs' },
  { key: 'stress_level', label: 'Stress', suffix: '/10' },
  { key: 'occupation_activity', label: 'Activity', map: OCCUPATION_LABELS },
  { key: 'meals_per_day', label: 'Meals/day' },
]

function formatValue(def, value) {
  if (value === null || value === undefined || value === '') return null
  if (def.format === 'height') return cmToFeetInches(value)
  if (def.format === 'weight') return `${kgToLbs(value)} lbs`
  if (def.map) return def.map[value] || String(value)
  if (def.suffix) return `${value}${def.suffix}`
  return String(value)
}

function FieldRow({ def, value, flash }) {
  const display = formatValue(def, value)
  const filled = display !== null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 6,
        background: flash ? '#f0fdf4' : 'transparent',
        transition: 'background-color 0.6s ease',
      }}
    >
      {filled
        ? <Check size={13} color={GRN} strokeWidth={3} />
        : <Circle size={13} color="#d1d5db" strokeWidth={1.5} />
      }
      <span style={{ fontSize: 12, fontWeight: 600, color: INK3, minWidth: 80, fontFamily: FONT }}>
        {def.label}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: filled ? 700 : 400,
        color: filled ? INK : '#d1d5db',
        flex: 1,
        fontFamily: FONT,
      }}>
        {display ?? '---'}
      </span>
    </div>
  )
}

export default function IntakeLiveCard({ extracted, missingFields, onGenerate, generating, generateError }) {
  const filledCount = FIELD_DEFS.length - missingFields.length
  const allComplete = missingFields.length === 0
  const pct = Math.round((filledCount / FIELD_DEFS.length) * 100)

  // Track which fields just changed for the flash effect.
  const [flashFields, setFlashFields] = useState({})
  const prevExtracted = useRef({})

  useEffect(() => {
    const flashes = {}
    for (const def of FIELD_DEFS) {
      const prev = prevExtracted.current[def.key]
      const curr = extracted[def.key]
      if (curr !== undefined && curr !== null && curr !== '' && curr !== prev) {
        flashes[def.key] = true
      }
    }
    if (Object.keys(flashes).length > 0) {
      setFlashFields(flashes)
      const timer = setTimeout(() => setFlashFields({}), 800)
      prevExtracted.current = { ...extracted }
      return () => clearTimeout(timer)
    }
    prevExtracted.current = { ...extracted }
  }, [extracted])

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BRD}`,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
      fontFamily: FONT,
    }}>
      {/* Header + progress */}
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${BRD}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: INK, letterSpacing: '.03em', textTransform: 'uppercase' }}>
            Your Profile
          </h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: allComplete ? GRN : INK3 }}>
            {filledCount} / {FIELD_DEFS.length}
          </span>
        </div>
        <div style={{ height: 4, background: '#f1f1f6', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: allComplete ? GRN : ACCENT,
            borderRadius: 2,
            transition: 'width 0.4s ease, background-color 0.4s ease',
          }} />
        </div>
      </div>

      {/* Field grid */}
      <div style={{ padding: '6px 6px 10px' }}>
        {FIELD_DEFS.map((def) => (
          <FieldRow
            key={def.key}
            def={def}
            value={extracted[def.key]}
            flash={!!flashFields[def.key]}
          />
        ))}
      </div>

      {/* Generate button */}
      <div style={{ padding: '10px 16px 16px' }}>
        {generateError && (
          <div style={{ marginBottom: 8, padding: '8px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
            {generateError}
          </div>
        )}
        <button
          onClick={onGenerate}
          disabled={!allComplete || generating}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: allComplete ? INK : '#ececef',
            color: allComplete ? '#fff' : '#c8c8cc',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: FONT,
            cursor: allComplete ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.2s ease',
          }}
        >
          {generating ? 'Generating...' : 'Generate my plan'}
        </button>
        {!allComplete && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
            {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} remaining
          </div>
        )}
      </div>
    </div>
  )
}
