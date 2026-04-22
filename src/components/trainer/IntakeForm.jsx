"use client"
import { useState } from 'react'
import {
  PRIMARY_GOALS,
  EQUIPMENT_ACCESS,
  DIETARY_PREFERENCES,
  OCCUPATION_ACTIVITIES,
  validateIntake,
} from '../../lib/trainer/intakeSchema'
import { feetInchesToCm, lbsToKg } from '../../lib/trainer/units'

import { R, T, BLK } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 03 — IntakeForm component.
//
// Controlled form bound to the same hand-rolled intakeSchema validators the
// API dispatcher uses (src/lib/trainer/intakeSchema.ts).  7-section layout
// per CONTEXT D-15.  Disclaimer pinned at top per D-20.  On submit, the
// parent view fetches POST /api/trainer/trainees?action=create and handles
// the response.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const GRY400 = '#9ca3af'
const GRY700 = '#374151'

const DISCLAIMER =
  'Not medical advice. Consult your physician before starting any new program.'

const GOAL_LABELS = {
  lose_fat: 'Lose fat',
  gain_muscle: 'Gain muscle',
  maintain: 'Maintain',
  performance: 'Performance',
  recomp: 'Recomposition (lose fat + gain muscle)',
}

const EQUIPMENT_LABELS = {
  none: 'None',
  bands: 'Resistance bands',
  home_gym: 'Home gym (dumbbells / adjustable)',
  full_gym: 'Full gym',
}

const DIET_LABELS = {
  none: 'No preference',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  keto: 'Keto',
  paleo: 'Paleo',
  custom: 'Custom',
}

const OCCUPATION_LABELS = {
  sedentary: 'Sedentary (desk job)',
  light: 'Light (some walking)',
  moderate: 'Moderate (on feet most of day)',
  heavy: 'Heavy (physical labor)',
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: BLK, marginBottom: 6 }
const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  border: `1px solid ${BRD}`,
  borderRadius: 8,
  background: '#fff',
  color: BLK,
}
const errStyle = { color: '#dc2626', fontSize: 12, marginTop: 4 }
const unitBadge = {
  position: 'absolute',
  right: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: 12,
  color: GRY400,
  fontWeight: 600,
  pointerEvents: 'none',
}

export default function IntakeForm({ onSubmit, submitting = false, topError = null }) {
  // UI state is imperial (height_ft / height_in / current_weight_lbs /
  // target_weight_lbs).  We convert to metric (height_cm / current_weight_kg /
  // target_weight_kg) at submit time so the DB + Phase 2 Sonnet prompts keep
  // using the metric formulas they're designed for.
  const [values, setValues] = useState({ full_name: '' })
  const [imperial, setImperial] = useState({ height_ft: '', height_in: '', current_weight_lbs: '', target_weight_lbs: '' })
  const [errors, setErrors] = useState({})

  const setField = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))
  const setImp = (k) => (e) => setImperial((prev) => ({ ...prev, [k]: e.target.value }))
  const setNum = (k) => (e) => {
    const raw = e.target.value
    if (raw === '') return setField(k, null)
    const n = Number(raw)
    setField(k, Number.isFinite(n) ? n : raw)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Convert imperial inputs to metric before validation.
    const clean = {}
    for (const [k, v] of Object.entries(values)) {
      if (v === '' || v === null || v === undefined) continue
      clean[k] = v
    }
    const ft = imperial.height_ft === '' ? null : Number(imperial.height_ft)
    const inches = imperial.height_in === '' ? null : Number(imperial.height_in)
    if (ft !== null || inches !== null) {
      clean.height_cm = feetInchesToCm(ft || 0, inches || 0)
    }
    if (imperial.current_weight_lbs !== '') {
      const n = Number(imperial.current_weight_lbs)
      if (Number.isFinite(n)) clean.current_weight_kg = lbsToKg(n)
    }
    if (imperial.target_weight_lbs !== '') {
      const n = Number(imperial.target_weight_lbs)
      if (Number.isFinite(n)) clean.target_weight_kg = lbsToKg(n)
    }
    const result = validateIntake(clean)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
      <div
        style={{
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 24,
          fontSize: 13,
          color: '#92400e',
        }}
      >
        {DISCLAIMER}
      </div>

      {topError && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 24,
            fontSize: 13,
            color: '#991b1b',
          }}
        >
          {topError}
        </div>
      )}

      <Section title="Tell us who you are, what you do, what you want">
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10, lineHeight: 1.55 }}>
          Write it like you&apos;d tell a private coach over coffee. Your sport, your job, what a
          normal day looks like, what you&apos;re chasing, what&apos;s gotten in the way before.
          The more context you give, the better every workout, meal plan, and coaching note gets
          tailored to <em>you</em>.
        </div>
        <Field label="About you" error={errors.about_you}>
          <textarea
            style={{
              ...inputStyle,
              minHeight: 160,
              fontFamily: 'inherit',
              lineHeight: 1.55,
            }}
            placeholder="Example: I'm a 16-year-old high school baseball player — outfielder and pitcher. My main goal is muscle gain this offseason, especially shoulder and core. I can train 4 days a week for about 45 minutes and have access to a decent school weight room. I played through a minor elbow flare last spring so I want to protect the arm. I'd love to hit my first over-the-fence home run this year."
            value={values.about_you || ''}
            onChange={(e) => setField('about_you', e.target.value || null)}
          />
        </Field>
      </Section>

      <Section title="1. Identity">
        <Field label="Full name *" error={errors.full_name}>
          <input
            style={inputStyle}
            value={values.full_name || ''}
            onChange={(e) => setField('full_name', e.target.value)}
          />
        </Field>
        <Row2>
          <Field label="Email" error={errors.email}>
            <input
              style={inputStyle}
              type="email"
              value={values.email || ''}
              onChange={(e) => setField('email', e.target.value || null)}
            />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input
              style={inputStyle}
              value={values.phone || ''}
              onChange={(e) => setField('phone', e.target.value || null)}
            />
          </Field>
        </Row2>
      </Section>

      <Section title="2. About you">
        <Row2>
          <Field label="Age" error={errors.age}>
            <input style={inputStyle} type="number" min="10" max="120" value={values.age ?? ''} onChange={setNum('age')} />
          </Field>
          <Field label="Sex" error={errors.sex}>
            <input style={inputStyle} value={values.sex || ''} onChange={(e) => setField('sex', e.target.value || null)} />
          </Field>
        </Row2>
        <Field label="Height" error={errors.height_cm}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 36 }}
                type="number"
                min="0"
                max="9"
                placeholder="5"
                value={imperial.height_ft}
                onChange={setImp('height_ft')}
              />
              <span style={unitBadge}>ft</span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 36 }}
                type="number"
                min="0"
                max="11"
                placeholder="10"
                value={imperial.height_in}
                onChange={setImp('height_in')}
              />
              <span style={unitBadge}>in</span>
            </div>
          </div>
        </Field>
        <Row2>
          <Field label="Current weight" error={errors.current_weight_kg}>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 44 }}
                type="number"
                step="0.1"
                min="0"
                value={imperial.current_weight_lbs}
                onChange={setImp('current_weight_lbs')}
              />
              <span style={unitBadge}>lbs</span>
            </div>
          </Field>
          <Field label="Target weight" error={errors.target_weight_kg}>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 44 }}
                type="number"
                step="0.1"
                min="0"
                value={imperial.target_weight_lbs}
                onChange={setImp('target_weight_lbs')}
              />
              <span style={unitBadge}>lbs</span>
            </div>
          </Field>
        </Row2>
      </Section>

      <Section title="3. Your goal">
        <Field label="Primary goal" error={errors.primary_goal}>
          <RadioGroup
            name="primary_goal"
            value={values.primary_goal || ''}
            options={PRIMARY_GOALS}
            labels={GOAL_LABELS}
            onChange={(v) => setField('primary_goal', v)}
          />
        </Field>
        <Row2>
          <Field label="Training experience (years)" error={errors.training_experience_years}>
            <input
              style={inputStyle}
              type="number"
              step="0.5"
              min="0"
              value={values.training_experience_years ?? ''}
              onChange={setNum('training_experience_years')}
            />
          </Field>
          <Field label="Training days per week" error={errors.training_days_per_week}>
            <input
              style={inputStyle}
              type="number"
              min="0"
              max="7"
              value={values.training_days_per_week ?? ''}
              onChange={setNum('training_days_per_week')}
            />
          </Field>
        </Row2>
        <Field label="Equipment access" error={errors.equipment_access}>
          <RadioGroup
            name="equipment_access"
            value={values.equipment_access || ''}
            options={EQUIPMENT_ACCESS}
            labels={EQUIPMENT_LABELS}
            onChange={(v) => setField('equipment_access', v)}
          />
        </Field>
      </Section>

      <Section title="4. Health check">
        <Field label="Medical flags" error={errors.medical_flags}>
          <textarea
            style={{ ...inputStyle, minHeight: 60, fontFamily: 'inherit' }}
            placeholder="Anything your coach should know — cardiac, hypertension, surgery, meds, eating disorder history"
            value={values.medical_flags || ''}
            onChange={(e) => setField('medical_flags', e.target.value || null)}
          />
        </Field>
        <Field label="Injuries" error={errors.injuries}>
          <textarea
            style={{ ...inputStyle, minHeight: 60, fontFamily: 'inherit' }}
            placeholder="Current or chronic injuries affecting training"
            value={values.injuries || ''}
            onChange={(e) => setField('injuries', e.target.value || null)}
          />
        </Field>
        <Field label="Pregnancy or nursing" error={errors.pregnancy_or_nursing}>
          <RadioGroup
            name="pregnancy_or_nursing"
            value={values.pregnancy_or_nursing === null || values.pregnancy_or_nursing === undefined ? '' : String(values.pregnancy_or_nursing)}
            options={['true', 'false']}
            labels={{ true: 'Yes', false: 'No' }}
            onChange={(v) => setField('pregnancy_or_nursing', v === 'true')}
          />
        </Field>
        <Row2>
          <Field label="Average sleep (hours/night)" error={errors.sleep_hours_avg}>
            <input style={inputStyle} type="number" step="0.5" min="0" max="16" value={values.sleep_hours_avg ?? ''} onChange={setNum('sleep_hours_avg')} />
          </Field>
          <Field label="Stress level (1-10)" error={errors.stress_level}>
            <input style={inputStyle} type="number" min="1" max="10" value={values.stress_level ?? ''} onChange={setNum('stress_level')} />
          </Field>
        </Row2>
      </Section>

      <Section title="5. Food (hard constraints only — preferences come later)">
        <Field label="Dietary preference" error={errors.dietary_preference}>
          <RadioGroup
            name="dietary_preference"
            value={values.dietary_preference || ''}
            options={DIETARY_PREFERENCES}
            labels={DIET_LABELS}
            onChange={(v) => setField('dietary_preference', v)}
          />
        </Field>
        <Field label="Allergies / intolerances" error={errors.allergies}>
          <textarea
            style={{ ...inputStyle, minHeight: 50, fontFamily: 'inherit' }}
            placeholder="e.g. shellfish, tree nuts, dairy"
            value={values.allergies || ''}
            onChange={(e) => setField('allergies', e.target.value || null)}
          />
        </Field>
        <Field label="Grocery budget (USD / week)" error={errors.grocery_budget_usd_per_week}>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingLeft: 26 }}
              type="number"
              min="0"
              step="5"
              value={values.grocery_budget_usd_per_week ?? ''}
              onChange={setNum('grocery_budget_usd_per_week')}
            />
            <span style={{ ...unitBadge, left: 10, right: 'auto' }}>$</span>
          </div>
        </Field>
      </Section>

      <Section title="6. Lifestyle">
        <Field label="Occupation activity level" error={errors.occupation_activity}>
          <RadioGroup
            name="occupation_activity"
            value={values.occupation_activity || ''}
            options={OCCUPATION_ACTIVITIES}
            labels={OCCUPATION_LABELS}
            onChange={(v) => setField('occupation_activity', v)}
          />
        </Field>
      </Section>

      <Section title="7. Trainer notes (internal — not shared with trainee)">
        <Field label="Notes" error={errors.trainer_notes}>
          <textarea
            style={{ ...inputStyle, minHeight: 80, fontFamily: 'inherit' }}
            value={values.trainer_notes || ''}
            onChange={(e) => setField('trainer_notes', e.target.value || null)}
          />
        </Field>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 24px',
            background: submitting ? GRY400 : R,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Saving…' : 'Save trainee'}
        </button>
      </div>
    </form>
  )
}

// ── Small layout primitives (kept local so this component is self-contained)

function Section({ title, children }) {
  return (
    <fieldset style={{ border: `1px solid ${BRD}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
      <legend style={{ fontSize: 13, fontWeight: 700, color: T, padding: '0 8px' }}>{title}</legend>
      {children}
    </fieldset>
  )
}

function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <div style={errStyle}>{error}</div>}
    </div>
  )
}

function Row2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function RadioGroup({ name, value, options, labels, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = String(value) === String(opt)
        return (
          <label
            key={opt}
            style={{
              padding: '7px 12px',
              border: `1px solid ${active ? R : BRD}`,
              borderRadius: 8,
              background: active ? R + '10' : '#fff',
              color: active ? R : GRY700,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
            }}
          >
            <input
              type="radio"
              name={name}
              value={opt}
              checked={active}
              onChange={(e) => onChange(e.target.value)}
              style={{ display: 'none' }}
            />
            {labels?.[opt] || opt}
          </label>
        )
      })}
    </div>
  )
}
