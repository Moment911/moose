import { describe, it, expect } from 'vitest'
import {
  validateIntake,
  validateIntakePartial,
  PRIMARY_GOALS,
  EQUIPMENT_ACCESS,
  DIETARY_PREFERENCES,
  OCCUPATION_ACTIVITIES,
} from '../../../src/lib/trainer/intakeSchema'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 02 — intake validation tests.
//
// Pure unit tests against the hand-rolled validators.  No DB, no network.
// ─────────────────────────────────────────────────────────────────────────────

describe('validateIntake — happy paths', () => {
  it('accepts the minimum payload (full_name + about_you)', () => {
    const r = validateIntake({ full_name: 'Jane Runner', about_you: 'Marathon-goal runner.' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.full_name).toBe('Jane Runner')
  })

  it('accepts a fully populated payload', () => {
    const full = {
      full_name: 'Jane Runner',
      about_you: 'Marathon goal in 6 months; former HS track athlete.',
      email: 'jane@example.com',
      phone: '+15555551234',
      age: 34,
      sex: 'F',
      height_cm: 168,
      current_weight_kg: 72.4,
      target_weight_kg: 65,
      primary_goal: 'lose_fat',
      training_experience_years: 3,
      training_days_per_week: 4,
      equipment_access: 'full_gym',
      medical_flags: null,
      injuries: 'prior right knee meniscus repair (2021)',
      pregnancy_or_nursing: false,
      dietary_preference: 'pescatarian',
      allergies: 'shellfish',
      grocery_budget_usd_per_week: 120,
      meals_per_day: 4,
      sleep_hours_avg: 7.5,
      stress_level: 5,
      occupation_activity: 'light',
      trainer_notes: 'Marathon goal in 6 months',
    }
    const r = validateIntake(full)
    expect(r.ok).toBe(true)
  })

  it('accepts every primary_goal enum value', () => {
    for (const g of PRIMARY_GOALS) {
      const r = validateIntake({ full_name: 'T', about_you: 'x', primary_goal: g })
      expect(r.ok).toBe(true)
    }
  })

  it('accepts every equipment_access enum value', () => {
    for (const e of EQUIPMENT_ACCESS) {
      const r = validateIntake({ full_name: 'T', about_you: 'x', equipment_access: e })
      expect(r.ok).toBe(true)
    }
  })

  it('accepts every dietary_preference enum value', () => {
    for (const d of DIETARY_PREFERENCES) {
      const r = validateIntake({ full_name: 'T', about_you: 'x', dietary_preference: d })
      expect(r.ok).toBe(true)
    }
  })

  it('accepts every occupation_activity enum value', () => {
    for (const o of OCCUPATION_ACTIVITIES) {
      const r = validateIntake({ full_name: 'T', about_you: 'x', occupation_activity: o })
      expect(r.ok).toBe(true)
    }
  })

  it('accepts null for optional fields (not just undefined)', () => {
    const r = validateIntake({
      full_name: 'T', about_you: 'x',
      email: null,
      age: null,
      primary_goal: null,
      equipment_access: null,
      pregnancy_or_nursing: null,
    })
    expect(r.ok).toBe(true)
  })
})

describe('validateIntake — rejections', () => {
  it('rejects non-object input', () => {
    expect(validateIntake(null)).toMatchObject({ ok: false })
    expect(validateIntake('not an object')).toMatchObject({ ok: false })
    expect(validateIntake(42)).toMatchObject({ ok: false })
    expect(validateIntake([])).toMatchObject({ ok: false }) // arrays rejected via missing full_name
  })

  it('rejects missing full_name with a field error', () => {
    const r = validateIntake({})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.full_name).toBeTruthy()
  })

  it('rejects empty-string full_name', () => {
    const r = validateIntake({ full_name: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.full_name).toBeTruthy()
  })

  it('rejects non-string full_name', () => {
    const r = validateIntake({ full_name: 42 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.full_name).toBeTruthy()
  })

  it('rejects invalid primary_goal enum', () => {
    const r = validateIntake({ full_name: 'T', about_you: 'x', primary_goal: 'moonshot' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.primary_goal).toMatch(/primary_goal must be one of/)
  })

  it('rejects training_days_per_week out of range', () => {
    const r = validateIntake({ full_name: 'T', about_you: 'x', training_days_per_week: 9 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.training_days_per_week).toBeTruthy()
  })

  it('rejects non-integer training_days_per_week', () => {
    const r = validateIntake({ full_name: 'T', about_you: 'x', training_days_per_week: 3.5 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.training_days_per_week).toBeTruthy()
  })

  it('rejects meals_per_day below 3 or above 6', () => {
    expect(validateIntake({ full_name: 'T', about_you: 'x', meals_per_day: 2 }).ok).toBe(false)
    expect(validateIntake({ full_name: 'T', about_you: 'x', meals_per_day: 7 }).ok).toBe(false)
  })

  it('rejects stress_level out of 1-10 range', () => {
    expect(validateIntake({ full_name: 'T', about_you: 'x', stress_level: 0 }).ok).toBe(false)
    expect(validateIntake({ full_name: 'T', about_you: 'x', stress_level: 11 }).ok).toBe(false)
  })

  it('rejects negative current_weight_kg', () => {
    const r = validateIntake({ full_name: 'T', about_you: 'x', current_weight_kg: -5 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.current_weight_kg).toBeTruthy()
  })

  it('rejects pregnancy_or_nursing as non-boolean', () => {
    const r = validateIntake({ full_name: 'T', about_you: 'x', pregnancy_or_nursing: 'yes' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.pregnancy_or_nursing).toBeTruthy()
  })

  it('accumulates multiple field errors in one pass', () => {
    const r = validateIntake({
      full_name: '',
      primary_goal: 'bad',
      meals_per_day: 99,
      stress_level: -1,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.errors).length).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('validateIntake — about_you required', () => {
  it('rejects missing about_you with a field error', () => {
    const r = validateIntake({ full_name: 'Jane Runner' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.about_you).toBeTruthy()
  })

  it('rejects empty-string about_you', () => {
    const r = validateIntake({ full_name: 'Jane', about_you: '   ' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.about_you).toBeTruthy()
  })

  it('rejects null about_you', () => {
    const r = validateIntake({ full_name: 'Jane', about_you: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.about_you).toBeTruthy()
  })
})

describe('validateIntakePartial', () => {
  it('accepts a partial patch without full_name', () => {
    const r = validateIntakePartial({ trainer_notes: 'updated note' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.full_name).toBeUndefined()
  })

  it('accepts a patch that omits about_you (does not force it required on update)', () => {
    const r = validateIntakePartial({ trainer_notes: 'just a note' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.about_you).toBeUndefined()
  })

  it('rejects a patch that sets about_you to empty-string', () => {
    const r = validateIntakePartial({ about_you: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.about_you).toBeTruthy()
  })

  it('accepts a patch that sets a new about_you', () => {
    const r = validateIntakePartial({ about_you: 'fresh context' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.about_you).toBe('fresh context')
  })

  it('accepts a patch that includes a valid full_name', () => {
    const r = validateIntakePartial({ full_name: 'New Name' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.full_name).toBe('New Name')
  })

  it('rejects a patch with an empty-string full_name', () => {
    const r = validateIntakePartial({ full_name: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.full_name).toBeTruthy()
  })

  it('still validates other fields in a patch (bad enum fails)', () => {
    const r = validateIntakePartial({ primary_goal: 'moonshot' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.primary_goal).toBeTruthy()
  })

  it('rejects non-object input', () => {
    expect(validateIntakePartial(null).ok).toBe(false)
    expect(validateIntakePartial('x').ok).toBe(false)
  })
})
