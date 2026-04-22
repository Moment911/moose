// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — intake schema + hand-rolled validators.
//
// Isomorphic — NO 'server-only' guard.  Both the API dispatcher and client
// components import this module for validation.
//
// Mirrors src/lib/trainer/intakeSchema.ts pattern.
// ─────────────────────────────────────────────────────────────────────────────

export type PainType = 'sharp' | 'dull' | 'burning' | 'aching' | 'throbbing' | 'radiating' | 'stiffness'
export type PainFrequency = 'constant' | 'intermittent' | 'occasional' | 'activity_dependent' | 'morning_only' | 'night_only'
export type OccupationActivity = 'sedentary' | 'light' | 'moderate' | 'heavy'
export type SleepQuality = 'good' | 'fair' | 'poor'

export const PAIN_TYPES: readonly PainType[] = [
  'sharp', 'dull', 'burning', 'aching', 'throbbing', 'radiating', 'stiffness',
] as const

export const PAIN_FREQUENCIES: readonly PainFrequency[] = [
  'constant', 'intermittent', 'occasional', 'activity_dependent', 'morning_only', 'night_only',
] as const

export const OCCUPATION_ACTIVITIES: readonly OccupationActivity[] = [
  'sedentary', 'light', 'moderate', 'heavy',
] as const

export const SLEEP_QUALITIES: readonly SleepQuality[] = [
  'good', 'fair', 'poor',
] as const

export const PAIN_LOCATIONS = [
  'neck', 'upper_back', 'mid_back', 'lower_back',
  'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
  'left_wrist', 'right_wrist', 'jaw_tmj', 'headaches',
  'sciatica_left', 'sciatica_right', 'ribcage', 'tailbone',
] as const

export const GOAL_OPTIONS = [
  'pain_relief', 'improved_mobility', 'better_posture',
  'athletic_performance', 'injury_prevention', 'stress_reduction',
  'better_sleep', 'overall_wellness', 'neurological_optimization',
  'cellular_health',
] as const

export const RED_FLAG_OPTIONS = [
  'numbness_tingling', 'loss_of_bladder_bowel_control',
  'recent_trauma', 'unexplained_weight_loss', 'fever_with_back_pain',
  'progressive_weakness', 'night_pain_waking',
] as const

export type FourrIntakeInput = {
  // Identity
  full_name: string
  email?: string | null
  phone?: string | null

  // Demographics
  age?: number | null
  sex?: string | null
  height_cm?: number | null
  weight_kg?: number | null

  // Chief complaint
  chief_complaint?: string | null
  pain_locations?: string[] | null
  pain_severity?: number | null
  pain_duration?: string | null
  pain_type?: PainType | null
  pain_frequency?: PainFrequency | null
  aggravating_factors?: string | null
  relieving_factors?: string | null

  // Medical history
  medical_conditions?: string | null
  surgeries?: string | null
  medications?: string | null

  // Previous treatments
  previous_chiro?: string | null
  previous_pt?: string | null
  previous_other_treatments?: string | null
  imaging_done?: string | null

  // Lifestyle
  occupation?: string | null
  occupation_activity?: OccupationActivity | null
  exercise_frequency?: string | null
  sleep_hours_avg?: number | null
  sleep_quality?: SleepQuality | null
  stress_level?: number | null

  // Goals + safety
  goals?: string[] | null
  red_flags?: string[] | null

  // Free-text narrative
  about_you?: string | null
}

export type ValidateResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: Record<string, string> }

// ── Field-level validators ──────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isInEnum<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string')
}

export function validateFourrIntake(input: unknown): ValidateResult<FourrIntakeInput> {
  const errors: Record<string, string> = {}

  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: { _root: 'body must be an object' } }
  }
  const b = input as Record<string, unknown>

  // Identity
  if (!isNonEmptyString(b.full_name)) {
    errors.full_name = 'full_name is required and must be a non-empty string'
  }

  // Demographics
  if (b.age !== undefined && b.age !== null) {
    if (!isFiniteNumber(b.age) || !Number.isInteger(b.age) || b.age <= 0) {
      errors.age = 'age must be a positive integer'
    }
  }
  if (b.sex !== undefined && b.sex !== null && !isString(b.sex)) {
    errors.sex = 'sex must be a string'
  }
  for (const k of ['height_cm', 'weight_kg'] as const) {
    const v = b[k]
    if (v !== undefined && v !== null) {
      if (!isFiniteNumber(v) || v <= 0) errors[k] = `${k} must be a positive number`
    }
  }

  // Chief complaint
  if (b.chief_complaint !== undefined && b.chief_complaint !== null && !isString(b.chief_complaint)) {
    errors.chief_complaint = 'chief_complaint must be a string'
  }
  if (b.pain_locations !== undefined && b.pain_locations !== null) {
    if (!isStringArray(b.pain_locations)) errors.pain_locations = 'pain_locations must be an array of strings'
  }
  if (b.pain_severity !== undefined && b.pain_severity !== null) {
    const v = b.pain_severity
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 1 || v > 10) {
      errors.pain_severity = 'pain_severity must be an integer 1-10'
    }
  }
  if (b.pain_type !== undefined && b.pain_type !== null) {
    if (!isInEnum(b.pain_type, PAIN_TYPES)) {
      errors.pain_type = `pain_type must be one of: ${PAIN_TYPES.join(', ')}`
    }
  }
  if (b.pain_frequency !== undefined && b.pain_frequency !== null) {
    if (!isInEnum(b.pain_frequency, PAIN_FREQUENCIES)) {
      errors.pain_frequency = `pain_frequency must be one of: ${PAIN_FREQUENCIES.join(', ')}`
    }
  }

  // String fields
  for (const k of [
    'pain_duration', 'aggravating_factors', 'relieving_factors',
    'medical_conditions', 'surgeries', 'medications',
    'previous_chiro', 'previous_pt', 'previous_other_treatments', 'imaging_done',
    'occupation', 'exercise_frequency',
  ] as const) {
    const v = b[k]
    if (v !== undefined && v !== null && !isString(v)) {
      errors[k] = `${k} must be a string`
    }
  }

  // Lifestyle
  if (b.occupation_activity !== undefined && b.occupation_activity !== null) {
    if (!isInEnum(b.occupation_activity, OCCUPATION_ACTIVITIES)) {
      errors.occupation_activity = `occupation_activity must be one of: ${OCCUPATION_ACTIVITIES.join(', ')}`
    }
  }
  if (b.sleep_hours_avg !== undefined && b.sleep_hours_avg !== null) {
    if (!isFiniteNumber(b.sleep_hours_avg) || b.sleep_hours_avg < 0) {
      errors.sleep_hours_avg = 'sleep_hours_avg must be >= 0'
    }
  }
  if (b.sleep_quality !== undefined && b.sleep_quality !== null) {
    if (!isInEnum(b.sleep_quality, SLEEP_QUALITIES)) {
      errors.sleep_quality = `sleep_quality must be one of: ${SLEEP_QUALITIES.join(', ')}`
    }
  }
  if (b.stress_level !== undefined && b.stress_level !== null) {
    const v = b.stress_level
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 1 || v > 10) {
      errors.stress_level = 'stress_level must be an integer 1-10'
    }
  }

  // Goals + red flags
  if (b.goals !== undefined && b.goals !== null) {
    if (!isStringArray(b.goals)) errors.goals = 'goals must be an array of strings'
  }
  if (b.red_flags !== undefined && b.red_flags !== null) {
    if (!isStringArray(b.red_flags)) errors.red_flags = 'red_flags must be an array of strings'
  }

  // about_you
  if (b.about_you !== undefined && b.about_you !== null && !isString(b.about_you)) {
    errors.about_you = 'about_you must be a string'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, data: b as FourrIntakeInput }
}
