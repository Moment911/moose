"use client"
import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// IntakeFormFields — hardcoded intake fields with pill buttons.
//
// Replaces AI-driven question-by-question for discrete profile fields.
// No AI calls needed — just tapping pills and typing numbers.
// After completion, hands off to AI chat for free-text (about_you, sport
// details, recruiting, injuries narrative).
//
// Props:
//   extracted     — current field values
//   onComplete    — (fields) => void — fires when all required fields filled
//   userName      — pre-filled name
// ─────────────────────────────────────────────────────────────────────────────

const INK = '#0a0a0a'
const INK2 = '#1f1f22'
const INK3 = '#6b6b70'
const INK4 = '#a1a1a6'
const GRN = '#10b981'
const BRD = '#ececef'
const CARD = '#f1f1f6'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"

const FIELD_GROUPS = [
  {
    title: 'Basics',
    fields: [
      { key: 'age', label: 'Age', type: 'number', placeholder: 'e.g. 28', inputMode: 'numeric' },
      { key: 'sex', label: 'Sex', type: 'pills', options: [
        { value: 'M', label: 'Male' },
        { value: 'F', label: 'Female' },
        { value: 'Other', label: 'Other' },
      ]},
      { key: 'height_display', label: 'Height', type: 'height' },
      { key: 'weight_display', label: 'Weight (lbs)', type: 'number', placeholder: 'e.g. 185', inputMode: 'decimal' },
    ],
  },
  {
    title: 'Goals & Training',
    fields: [
      { key: 'primary_goal', label: 'Primary goal', type: 'pills', options: [
        { value: 'gain_muscle', label: 'Gain muscle' },
        { value: 'lose_fat', label: 'Lose weight' },
        { value: 'performance', label: 'Performance' },
        { value: 'recomp', label: 'Recomp' },
        { value: 'maintain', label: 'Stay healthy' },
      ]},
      { key: 'training_days_per_week', label: 'Training days per week', type: 'pills', options: [
        { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' },
        { value: 5, label: '5' }, { value: 6, label: '6' },
      ]},
      { key: 'equipment_access', label: 'Equipment access', type: 'pills', options: [
        { value: 'full_gym', label: 'Full gym' },
        { value: 'home_gym', label: 'Home gym' },
        { value: 'bands', label: 'Bands only' },
        { value: 'none', label: 'No equipment' },
      ]},
      { key: 'training_experience_years', label: 'Training experience', type: 'pills', options: [
        { value: 0, label: 'Less than 1 year' },
        { value: 1.5, label: '1-2 years' },
        { value: 4, label: '3-5 years' },
        { value: 7, label: '5+ years' },
      ]},
    ],
  },
  {
    title: 'Nutrition',
    fields: [
      { key: 'dietary_preference', label: 'Dietary preference', type: 'pills', options: [
        { value: 'none', label: 'No preference' },
        { value: 'vegetarian', label: 'Vegetarian' },
        { value: 'vegan', label: 'Vegan' },
        { value: 'keto', label: 'Keto' },
        { value: 'paleo', label: 'Paleo' },
      ]},
      { key: 'meals_per_day', label: 'Meals per day', type: 'pills', options: [
        { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }, { value: 6, label: '6' },
      ]},
    ],
  },
  {
    title: 'Lifestyle',
    fields: [
      { key: 'sleep_hours_avg', label: 'Average sleep (hours)', type: 'pills', options: [
        { value: 5.5, label: '5-6' }, { value: 7, label: '7' }, { value: 8, label: '8' }, { value: 9, label: '9+' },
      ]},
      { key: 'stress_level', label: 'Stress level (1-10)', type: 'pills', options: [
        { value: 2, label: '1-3 (low)' }, { value: 5, label: '4-6 (moderate)' },
        { value: 7.5, label: '7-8 (high)' }, { value: 9.5, label: '9-10 (very high)' },
      ]},
      { key: 'occupation_activity', label: 'Daily activity level', type: 'pills', options: [
        { value: 'sedentary', label: 'Desk / school' },
        { value: 'light', label: 'Light activity' },
        { value: 'moderate', label: 'On my feet' },
        { value: 'heavy', label: 'Physical labor' },
      ]},
    ],
  },
]

export default function IntakeFormFields({ extracted = {}, onComplete, userName = '' }) {
  const [fields, setFields] = useState(() => ({
    full_name: userName || extracted.full_name || '',
    ...extracted,
  }))
  const [textInputs, setTextInputs] = useState({}) // for pills_or_text "Yes" mode
  const [showText, setShowText] = useState({})

  function setField(key, value) {
    setFields((prev) => {
      const next = { ...prev, [key]: value }
      // Height conversion: store as height_cm
      if (key === 'height_ft' || key === 'height_in') {
        const ft = Number(key === 'height_ft' ? value : (prev.height_ft || 0))
        const inches = Number(key === 'height_in' ? value : (prev.height_in || 0))
        if (ft > 0) next.height_cm = Math.round((ft * 12 + inches) * 2.54)
      }
      // Weight conversion: store as current_weight_kg
      if (key === 'weight_display') {
        const lbs = Number(value)
        if (lbs > 0) next.current_weight_kg = Math.round(lbs / 2.20462 * 10) / 10
      }
      return next
    })
  }

  // Count filled required fields — medical/injury already handled by compliance gate
  const required = ['age', 'sex', 'height_cm', 'current_weight_kg', 'primary_goal',
    'training_days_per_week', 'equipment_access']
  const filledCount = required.filter((k) => {
    const v = fields[k]
    return v !== undefined && v !== null && v !== ''
  }).length
  const allRequired = filledCount === required.length
  const pct = Math.round((filledCount / required.length) * 100)

  function handleContinue() {
    if (!allRequired) return
    // Default medical/injury to "None" since compliance gate already screened
    const output = { ...fields }
    if (!output.medical_flags) output.medical_flags = 'None'
    if (!output.injuries) output.injuries = 'None'
    onComplete(output)
  }

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: INK3 }}>Profile</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: allRequired ? GRN : INK3 }}>{filledCount}/{required.length}</span>
        </div>
        <div style={{ height: 4, background: CARD, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: allRequired ? GRN : INK, borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Name field */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Your name</label>
        <input
          type="text"
          value={fields.full_name || ''}
          onChange={(e) => setField('full_name', e.target.value)}
          placeholder="First and last name"
          autoComplete="name"
          style={inputStyle}
        />
      </div>

      {/* Field groups */}
      {FIELD_GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: INK3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
            {group.title}
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            {group.fields.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                value={fields[field.key]}
                heightFt={fields.height_ft}
                heightIn={fields.height_in}
                weightDisplay={fields.weight_display}
                onSet={setField}
                showText={showText[field.key]}
                textValue={textInputs[field.key] || ''}
                onToggleText={(show) => setShowText((p) => ({ ...p, [field.key]: show }))}
                onTextChange={(v) => setTextInputs((p) => ({ ...p, [field.key]: v }))}
                onTextSubmit={(v) => { setField(field.key, v); setShowText((p) => ({ ...p, [field.key]: false })) }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Continue button */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={!allRequired}
        style={{
          width: '100%', padding: '16px 20px',
          background: allRequired ? INK : '#ececef',
          color: allRequired ? '#fff' : '#c8c8cc',
          border: 'none', borderRadius: 14,
          fontSize: 16, fontWeight: 600, fontFamily: FONT,
          cursor: allRequired ? 'pointer' : 'not-allowed',
          marginBottom: 8,
        }}
      >
        {allRequired ? 'Continue to coach chat' : `${required.length - filledCount} fields remaining`}
      </button>
      {!allRequired && (
        <p style={{ textAlign: 'center', fontSize: 12, color: INK4, margin: 0 }}>
          Fill in the required fields above to continue
        </p>
      )}
    </div>
  )
}

function FieldRow({ field, value, heightFt, heightIn, weightDisplay, onSet, showText, textValue, onToggleText, onTextChange, onTextSubmit }) {
  const isFilled = value !== undefined && value !== null && value !== ''

  if (field.type === 'height') {
    return (
      <div>
        <label style={labelStyle}>{field.label}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <input
              type="number"
              inputMode="numeric"
              value={heightFt || ''}
              onChange={(e) => onSet('height_ft', e.target.value)}
              placeholder="ft"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="number"
              inputMode="numeric"
              value={heightIn || ''}
              onChange={(e) => onSet('height_in', e.target.value)}
              placeholder="in"
              style={inputStyle}
            />
          </div>
        </div>
      </div>
    )
  }

  if (field.type === 'number') {
    const displayKey = field.key
    return (
      <div>
        <label style={labelStyle}>{field.label}</label>
        <input
          type="number"
          inputMode={field.inputMode || 'numeric'}
          value={displayKey === 'weight_display' ? (weightDisplay || '') : (value || '')}
          onChange={(e) => onSet(displayKey, e.target.value)}
          placeholder={field.placeholder}
          style={inputStyle}
        />
      </div>
    )
  }

  if (field.type === 'pills') {
    return (
      <div>
        <label style={labelStyle}>{field.label}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {field.options.map((opt) => {
            const selected = value === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSet(field.key, opt.value)}
                style={{
                  padding: '10px 18px',
                  background: selected ? INK : '#fff',
                  color: selected ? '#fff' : INK,
                  border: `1.5px solid ${selected ? INK : BRD}`,
                  borderRadius: 999,
                  fontSize: 14, fontWeight: selected ? 600 : 500,
                  fontFamily: FONT, cursor: 'pointer',
                  transition: 'all .12s',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (field.type === 'pills_or_text') {
    return (
      <div>
        <label style={labelStyle}>{field.label}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {field.options.map((opt) => {
            const selected = value === opt.value && !showText
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onSet(field.key, opt.value); onToggleText(false) }}
                style={{
                  padding: '10px 18px',
                  background: selected ? INK : '#fff',
                  color: selected ? '#fff' : INK,
                  border: `1.5px solid ${selected ? INK : BRD}`,
                  borderRadius: 999,
                  fontSize: 14, fontWeight: selected ? 600 : 500,
                  fontFamily: FONT, cursor: 'pointer',
                  transition: 'all .12s',
                }}
              >
                {opt.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => onToggleText(true)}
            style={{
              padding: '10px 18px',
              background: showText ? INK : '#fff',
              color: showText ? '#fff' : INK,
              border: `1.5px solid ${showText ? INK : BRD}`,
              borderRadius: 999,
              fontSize: 14, fontWeight: showText ? 600 : 500,
              fontFamily: FONT, cursor: 'pointer',
              transition: 'all .12s',
            }}
          >
            {field.textOption}
          </button>
        </div>
        {showText && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={textValue}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && textValue.trim()) onTextSubmit(textValue.trim()) }}
              placeholder={field.textPlaceholder}
              autoFocus
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => { if (textValue.trim()) onTextSubmit(textValue.trim()) }}
              disabled={!textValue.trim()}
              style={{
                padding: '10px 16px',
                background: textValue.trim() ? INK : '#ececef',
                color: textValue.trim() ? '#fff' : '#c8c8cc',
                border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 600, fontFamily: FONT,
                cursor: textValue.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Save
            </button>
          </div>
        )}
        {isFilled && value !== 'None' && !showText && (
          <div style={{ marginTop: 6, fontSize: 13, color: INK2, fontStyle: 'italic' }}>
            {value}
          </div>
        )}
      </div>
    )
  }

  return null
}

const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 600, color: INK,
  marginBottom: 6, fontFamily: FONT,
}

const inputStyle = {
  width: '100%', padding: '12px 14px', fontSize: 15, fontWeight: 500,
  border: `1px solid ${BRD}`, borderRadius: 10,
  background: CARD, color: INK, fontFamily: FONT,
  outline: 'none', boxSizing: 'border-box',
}
