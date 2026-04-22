// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — intake completeness helper.
//
// Gates protocol generation on a fully-answered intake.  Mirrors
// src/lib/trainer/intakeCompleteness.ts pattern.
//
// Required fields: every field the AI needs to build a meaningful protocol.
// "None" is a valid answer for medical/treatment history fields.
// ─────────────────────────────────────────────────────────────────────────────

import type { FourrIntakeInput } from './intakeSchema'

export const REQUIRED_FOURR_INTAKE_FIELDS = [
  'about_you',
  'age',
  'sex',
  'chief_complaint',
  'pain_locations',
  'pain_severity',
  'pain_duration',
  'pain_type',
  'pain_frequency',
  'medical_conditions',
  'surgeries',
  'medications',
  'previous_chiro',
  'previous_pt',
  'imaging_done',
  'occupation_activity',
  'exercise_frequency',
  'sleep_hours_avg',
  'stress_level',
  'goals',
  'red_flags',
] as const satisfies ReadonlyArray<keyof FourrIntakeInput>

export type RequiredFourrIntakeField = (typeof REQUIRED_FOURR_INTAKE_FIELDS)[number]

// Field categories for the progress UI
export const INTAKE_CATEGORIES = {
  demographics: { label: 'Demographics', fields: ['age', 'sex'] },
  chief_complaint: { label: 'Chief Complaint', fields: ['chief_complaint', 'pain_locations', 'pain_severity', 'pain_duration', 'pain_type', 'pain_frequency'] },
  medical_history: { label: 'Medical History', fields: ['medical_conditions', 'surgeries', 'medications'] },
  previous_treatment: { label: 'Previous Treatment', fields: ['previous_chiro', 'previous_pt', 'imaging_done'] },
  lifestyle: { label: 'Lifestyle', fields: ['occupation_activity', 'exercise_frequency', 'sleep_hours_avg', 'stress_level'] },
  goals_safety: { label: 'Goals & Safety', fields: ['goals', 'red_flags'] },
  context: { label: 'Your Story', fields: ['about_you'] },
} as const

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function missingFourrIntakeFields(
  patient: Partial<FourrIntakeInput> | null | undefined,
): RequiredFourrIntakeField[] {
  if (!patient) return [...REQUIRED_FOURR_INTAKE_FIELDS]
  const missing: RequiredFourrIntakeField[] = []
  for (const f of REQUIRED_FOURR_INTAKE_FIELDS) {
    if (!isFieldFilled(patient[f])) missing.push(f)
  }
  return missing
}

export function isFourrIntakeComplete(
  patient: Partial<FourrIntakeInput> | null | undefined,
): boolean {
  return missingFourrIntakeFields(patient).length === 0
}

export function fourrIntakeProgress(
  patient: Partial<FourrIntakeInput> | null | undefined,
): { filled: number; total: number; percent: number } {
  const total = REQUIRED_FOURR_INTAKE_FIELDS.length
  const filled = total - missingFourrIntakeFields(patient).length
  return { filled, total, percent: Math.round((filled / total) * 100) }
}
