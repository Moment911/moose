// ─────────────────────────────────────────────────────────────────────────────
// Trainer — intake completeness helper tests.
//
// Covers REQUIRED_INTAKE_FIELDS + missingIntakeFields + isIntakeComplete.
// These drive the /api/trainer/generate gate and the IntakeForm progress UI.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  REQUIRED_INTAKE_FIELDS,
  missingIntakeFields,
  isIntakeComplete,
} from '../../../src/lib/trainer/intakeCompleteness'
import type { IntakeInput } from '../../../src/lib/trainer/intakeSchema'

const COMPLETE: IntakeInput = {
  full_name: 'Jane',
  about_you: 'Marathon goal, former HS track.',
  age: 34,
  sex: 'F',
  height_cm: 168,
  current_weight_kg: 72,
  primary_goal: 'lose_fat',
  training_experience_years: 3,
  training_days_per_week: 4,
  equipment_access: 'full_gym',
  medical_flags: 'None',
  injuries: 'None',
  dietary_preference: 'pescatarian',
  allergies: 'shellfish',
  sleep_hours_avg: 7.5,
  stress_level: 5,
  occupation_activity: 'light',
  meals_per_day: 4,
}

describe('REQUIRED_INTAKE_FIELDS', () => {
  it('matches the product-decision list exactly — changes here need user approval', () => {
    // Frozen snapshot of the agreed required-field set.  Adding or removing
    // a field is a product change, not a drive-by refactor — bump this test
    // deliberately.
    expect([...REQUIRED_INTAKE_FIELDS].sort()).toEqual(
      [
        'about_you',
        'age',
        'allergies',
        'current_weight_kg',
        'dietary_preference',
        'equipment_access',
        'height_cm',
        'injuries',
        'meals_per_day',
        'medical_flags',
        'occupation_activity',
        'primary_goal',
        'sex',
        'sleep_hours_avg',
        'stress_level',
        'training_days_per_week',
        'training_experience_years',
      ].sort(),
    )
  })
})

describe('missingIntakeFields', () => {
  it('returns empty array for a complete intake', () => {
    expect(missingIntakeFields(COMPLETE)).toEqual([])
    expect(isIntakeComplete(COMPLETE)).toBe(true)
  })

  it('returns the full list for null/undefined trainee', () => {
    expect(missingIntakeFields(null)).toEqual([...REQUIRED_INTAKE_FIELDS])
    expect(missingIntakeFields(undefined)).toEqual([...REQUIRED_INTAKE_FIELDS])
    expect(isIntakeComplete(null)).toBe(false)
  })

  it('reports the specific missing field when one is null', () => {
    const partial = { ...COMPLETE, age: null }
    expect(missingIntakeFields(partial)).toEqual(['age'])
  })

  it('reports the specific missing field when a string is whitespace-only', () => {
    const partial = { ...COMPLETE, about_you: '   ' }
    expect(missingIntakeFields(partial)).toEqual(['about_you'])
  })

  it('accepts "None" as a meaningful answer for health fields', () => {
    const filled = { ...COMPLETE, medical_flags: 'None', injuries: 'None', allergies: 'None' }
    expect(missingIntakeFields(filled)).toEqual([])
  })

  it('treats empty-string as missing', () => {
    const partial = { ...COMPLETE, injuries: '' }
    expect(missingIntakeFields(partial)).toEqual(['injuries'])
  })

  it('does NOT require optional contact / situational fields', () => {
    // No email, no phone, no target_weight, no pregnancy_or_nursing — still complete.
    const noOptional: IntakeInput = { ...COMPLETE }
    delete noOptional.email
    delete noOptional.phone
    delete noOptional.target_weight_kg
    delete noOptional.pregnancy_or_nursing
    delete noOptional.grocery_budget_usd_per_week
    delete noOptional.trainer_notes
    expect(missingIntakeFields(noOptional)).toEqual([])
  })
})
