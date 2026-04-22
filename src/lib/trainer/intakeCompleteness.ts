// ─────────────────────────────────────────────────────────────────────────────
// Trainer — intake completeness helper.
//
// Gates plan generation on a fully-answered intake.  The decision lives here
// instead of inside every Sonnet handler because:
//   1. The list of required fields is a product decision, not an API detail.
//   2. Both server (/api/trainer/generate gate) and client (IntakeForm progress
//      meter + TrainerDetailPage CTA gating) consume the same list.
//
// Rule: every field in REQUIRED_INTAKE_FIELDS must be present and meaningful.
// For string fields, whitespace-only counts as missing.  For numeric fields,
// null / undefined / NaN counts as missing.  Health / food fields (medical_flags,
// injuries, allergies) accept "None" as a deliberate, recorded answer — they
// must just be non-empty.
//
// Fields intentionally NOT in the required list:
//   - email, phone         — not every trainee needs login/contact stored
//   - target_weight_kg     — performance / recomp trainees may not have one
//   - pregnancy_or_nursing — sex/age-specific; surfaced only when relevant
//   - grocery_budget_usd_per_week — soft preference
//   - trainer_notes        — agency-internal
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeInput } from './intakeSchema'

export const REQUIRED_INTAKE_FIELDS = [
  'about_you',
  'age',
  'sex',
  'height_cm',
  'current_weight_kg',
  'primary_goal',
  'training_experience_years',
  'training_days_per_week',
  'equipment_access',
  'medical_flags',
  'injuries',
  'dietary_preference',
  'allergies',
  'sleep_hours_avg',
  'stress_level',
  'occupation_activity',
  'meals_per_day',
] as const satisfies ReadonlyArray<keyof IntakeInput>

export type RequiredIntakeField = (typeof REQUIRED_INTAKE_FIELDS)[number]

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  // Any other type (boolean, enum already narrowed to string) counts as filled
  // once it's present.
  return true
}

/**
 * Returns the required-field names missing from a trainee row.  Empty array
 * means intake is complete and plan generation is unlocked.
 */
export function missingIntakeFields(
  trainee: Partial<IntakeInput> | null | undefined,
): RequiredIntakeField[] {
  if (!trainee) return [...REQUIRED_INTAKE_FIELDS]
  const missing: RequiredIntakeField[] = []
  for (const f of REQUIRED_INTAKE_FIELDS) {
    if (!isFieldFilled(trainee[f])) missing.push(f)
  }
  return missing
}

export function isIntakeComplete(
  trainee: Partial<IntakeInput> | null | undefined,
): boolean {
  return missingIntakeFields(trainee).length === 0
}
