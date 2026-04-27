// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 02 — intake schema + hand-rolled validators.
//
// Isomorphic on purpose — NO 'server-only' guard.  The API dispatcher
// (src/app/api/trainer/trainees/route.ts) and the client-side IntakeForm
// (src/components/trainer/IntakeForm.jsx) both import this module so
// server + client validation stay in lock-step.  The validators are pure
// functions with zero DB / secret / server-process access.
//
// DEVIATION from PLAN 02: the drafted plan specified Zod; zod is not a Koto
// dependency and adding it would collide with in-flight package.json changes
// from other terminals.  Validators here match Phase 7/8's hand-rolled style
// (see profile/route.ts validateFieldNameShape).  The public contract —
// IntakeInput type + validateIntake / validateIntakePartial functions — is
// the same regardless of implementation.
//
// Consumers: /api/trainer/trainees create + update actions, and Plan 03's
// IntakeForm component (shares the type via a type-only import).
// ─────────────────────────────────────────────────────────────────────────────

export type PrimaryGoal = 'lose_fat' | 'gain_muscle' | 'maintain' | 'performance' | 'recomp'
export type EquipmentAccess = 'none' | 'bands' | 'home_gym' | 'full_gym'
export type DietaryPreference =
  | 'none'
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'keto'
  | 'paleo'
  | 'custom'
export type OccupationActivity = 'sedentary' | 'light' | 'moderate' | 'heavy'

export const PRIMARY_GOALS: readonly PrimaryGoal[] = [
  'lose_fat',
  'gain_muscle',
  'maintain',
  'performance',
  'recomp',
] as const

export const EQUIPMENT_ACCESS: readonly EquipmentAccess[] = [
  'none',
  'bands',
  'home_gym',
  'full_gym',
] as const

export const DIETARY_PREFERENCES: readonly DietaryPreference[] = [
  'none',
  'vegetarian',
  'vegan',
  'pescatarian',
  'keto',
  'paleo',
  'custom',
] as const

export const OCCUPATION_ACTIVITIES: readonly OccupationActivity[] = [
  'sedentary',
  'light',
  'moderate',
  'heavy',
] as const

/**
 * The full intake shape accepted by /api/trainer/trainees?action=create.
 * Mirrors koto_fitness_trainees columns 1:1 (see migration
 * 20260525_koto_fitness_foundation.sql).  All fields except full_name
 * are optional — CONTEXT D-15.
 */
export type IntakeInput = {
  // Identity
  full_name: string
  email?: string | null
  phone?: string | null

  // Free-text context — "tell us who you are, what you do, what you want"
  // Fed into EVERY Sonnet prompt (baseline / roadmap / workout / meals /
  // playbook / adjust).  Complements structured fields; drives tailoring
  // (sport-specific cues, lifestyle-specific meals, scenario-specific
  // troubleshooting, etc.).  Trainee-facing copy lives on the IntakeForm.
  about_you?: string | null

  // Basics
  age?: number | null
  sex?: string | null
  height_cm?: number | null
  current_weight_kg?: number | null
  target_weight_kg?: number | null

  // Goal
  primary_goal?: PrimaryGoal | null

  // Experience
  training_experience_years?: number | null
  training_days_per_week?: number | null
  equipment_access?: EquipmentAccess | null

  // Health
  medical_flags?: string | null
  injuries?: string | null
  pregnancy_or_nursing?: boolean | null

  // Food (hard constraints only — soft prefs elicited by Phase 2 prompt 3)
  dietary_preference?: DietaryPreference | null
  allergies?: string | null
  grocery_budget_usd_per_week?: number | null
  meals_per_day?: number | null

  // Lifestyle
  sleep_hours_avg?: number | null
  stress_level?: number | null
  occupation_activity?: OccupationActivity | null

  // Internal
  trainer_notes?: string | null

  // Baseball / sport-specific
  position_primary?: string | null
  position_secondary?: string | null
  throwing_hand?: string | null
  batting_hand?: string | null
  fastball_velo_peak?: number | null
  fastball_velo_sit?: number | null
  exit_velo?: number | null
  sixty_time?: number | null
  pop_time?: number | null
  pitch_arsenal?: unknown | null  // jsonb — string[] or comma-separated
  grad_year?: number | null
  gpa?: number | null
  high_school?: string | null
  club_team?: string | null
  travel_team?: string | null
  video_link?: string | null
  preferred_divisions?: unknown | null  // jsonb
  preferred_states?: unknown | null     // jsonb
  intended_major?: string | null

  // Workload
  practices_per_week?: number | null
  bullpen_sessions_per_week?: number | null
  games_per_week?: number | null

  // Chat persistence
  chat_history?: unknown | null  // jsonb
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

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean'
}

function isInEnum<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
}

/**
 * Validate a full intake for the create action.  Returns structured
 * per-field errors suitable for echo back to the UI via the 400 response.
 */
export function validateIntake(input: unknown): ValidateResult<IntakeInput> {
  const errors: Record<string, string> = {}

  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: { _root: 'body must be an object' } }
  }
  const b = input as Record<string, unknown>

  // Identity
  if (!isNonEmptyString(b.full_name)) {
    errors.full_name = 'full_name is required and must be a non-empty string'
  }
  if (b.email !== undefined && b.email !== null && !isString(b.email)) {
    errors.email = 'email must be a string'
  }
  if (b.phone !== undefined && b.phone !== null && !isString(b.phone)) {
    errors.phone = 'phone must be a string'
  }

  // Basics
  if (b.age !== undefined && b.age !== null) {
    if (!isFiniteNumber(b.age) || !Number.isInteger(b.age) || b.age <= 0) {
      errors.age = 'age must be a positive integer'
    }
  }
  if (b.sex !== undefined && b.sex !== null && !isString(b.sex)) {
    errors.sex = 'sex must be a string'
  }
  for (const k of ['height_cm', 'current_weight_kg', 'target_weight_kg'] as const) {
    const v = b[k]
    if (v !== undefined && v !== null) {
      if (!isFiniteNumber(v) || v <= 0) errors[k] = `${k} must be a positive number`
    }
  }

  // Goal
  if (b.primary_goal !== undefined && b.primary_goal !== null) {
    if (!isInEnum(b.primary_goal, PRIMARY_GOALS)) {
      errors.primary_goal = `primary_goal must be one of: ${PRIMARY_GOALS.join(', ')}`
    }
  }

  // Experience
  if (b.training_experience_years !== undefined && b.training_experience_years !== null) {
    if (!isFiniteNumber(b.training_experience_years) || b.training_experience_years < 0) {
      errors.training_experience_years = 'training_experience_years must be >= 0'
    }
  }
  if (b.training_days_per_week !== undefined && b.training_days_per_week !== null) {
    const v = b.training_days_per_week
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 0 || v > 7) {
      errors.training_days_per_week = 'training_days_per_week must be an integer 0-7'
    }
  }
  if (b.equipment_access !== undefined && b.equipment_access !== null) {
    if (!isInEnum(b.equipment_access, EQUIPMENT_ACCESS)) {
      errors.equipment_access = `equipment_access must be one of: ${EQUIPMENT_ACCESS.join(', ')}`
    }
  }

  // Health
  for (const k of ['medical_flags', 'injuries'] as const) {
    const v = b[k]
    if (v !== undefined && v !== null && !isString(v)) {
      errors[k] = `${k} must be a string`
    }
  }
  if (b.pregnancy_or_nursing !== undefined && b.pregnancy_or_nursing !== null) {
    if (!isBoolean(b.pregnancy_or_nursing)) {
      errors.pregnancy_or_nursing = 'pregnancy_or_nursing must be boolean'
    }
  }

  // Food
  if (b.dietary_preference !== undefined && b.dietary_preference !== null) {
    if (!isInEnum(b.dietary_preference, DIETARY_PREFERENCES)) {
      errors.dietary_preference = `dietary_preference must be one of: ${DIETARY_PREFERENCES.join(', ')}`
    }
  }
  if (b.allergies !== undefined && b.allergies !== null && !isString(b.allergies)) {
    errors.allergies = 'allergies must be a string'
  }
  if (b.grocery_budget_usd_per_week !== undefined && b.grocery_budget_usd_per_week !== null) {
    const v = b.grocery_budget_usd_per_week
    if (!isFiniteNumber(v) || v < 0) {
      errors.grocery_budget_usd_per_week = 'grocery_budget_usd_per_week must be >= 0'
    }
  }
  if (b.meals_per_day !== undefined && b.meals_per_day !== null) {
    const v = b.meals_per_day
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 3 || v > 6) {
      errors.meals_per_day = 'meals_per_day must be an integer 3-6'
    }
  }

  // Lifestyle
  if (b.sleep_hours_avg !== undefined && b.sleep_hours_avg !== null) {
    if (!isFiniteNumber(b.sleep_hours_avg) || b.sleep_hours_avg < 0) {
      errors.sleep_hours_avg = 'sleep_hours_avg must be >= 0'
    }
  }
  if (b.stress_level !== undefined && b.stress_level !== null) {
    const v = b.stress_level
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 1 || v > 10) {
      errors.stress_level = 'stress_level must be an integer 1-10'
    }
  }
  if (b.occupation_activity !== undefined && b.occupation_activity !== null) {
    if (!isInEnum(b.occupation_activity, OCCUPATION_ACTIVITIES)) {
      errors.occupation_activity = `occupation_activity must be one of: ${OCCUPATION_ACTIVITIES.join(', ')}`
    }
  }

  // Free-text context — REQUIRED.  Every Sonnet prompt (baseline, roadmap,
  // workout, meals, playbook, adjust) reads about_you as the primary steering
  // input; without it the output regresses to generic coaching.  Enforcing at
  // intake time guarantees the first baseline generation has real context.
  if (b.about_you === undefined || b.about_you === null || !isString(b.about_you) || b.about_you.trim().length === 0) {
    errors.about_you = 'about_you is required — write who you are, what you do, and what you want'
  }

  // Internal
  if (b.trainer_notes !== undefined && b.trainer_notes !== null && !isString(b.trainer_notes)) {
    errors.trainer_notes = 'trainer_notes must be a string'
  }

  // Baseball / sport-specific — light validation, accept any reasonable value
  for (const k of ['position_primary', 'position_secondary', 'throwing_hand', 'batting_hand', 'high_school', 'club_team', 'travel_team', 'video_link', 'intended_major'] as const) {
    const v = b[k]
    if (v !== undefined && v !== null && !isString(v)) {
      errors[k] = `${k} must be a string`
    }
  }
  for (const k of ['fastball_velo_peak', 'fastball_velo_sit', 'exit_velo', 'sixty_time', 'pop_time', 'gpa'] as const) {
    const v = b[k]
    if (v !== undefined && v !== null && !isFiniteNumber(v)) {
      errors[k] = `${k} must be a number`
    }
  }
  for (const k of ['grad_year', 'practices_per_week', 'bullpen_sessions_per_week', 'games_per_week'] as const) {
    const v = b[k]
    if (v !== undefined && v !== null) {
      if (!isFiniteNumber(v) || !Number.isInteger(v)) {
        errors[k] = `${k} must be an integer`
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, data: b as IntakeInput }
}

/**
 * Partial variant used by the update action — same rules, but full_name
 * is optional instead of required.  If full_name IS provided, it must
 * still be a non-empty string.
 */
export function validateIntakePartial(input: unknown): ValidateResult<Partial<IntakeInput>> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: { _root: 'body must be an object' } }
  }
  const b = input as Record<string, unknown>
  const callerProvidedFullName = 'full_name' in b
  const errors: Record<string, string> = {}

  // If caller explicitly sent full_name, it must be a non-empty string —
  // regardless of whether the rest of the patch is valid.
  if (callerProvidedFullName && !isNonEmptyString(b.full_name)) {
    errors.full_name = 'full_name, if provided, must be a non-empty string'
  }

  // Run the full validator with synthesized placeholders so missing fields
  // that are REQUIRED on create (full_name, about_you) don't trip the
  // required-check on a partial update that simply doesn't touch them.
  // Presence is detected with `in b`; if the caller explicitly sent the
  // field, their value flows through and is validated normally.
  const synthesized = {
    ...b,
    full_name: isNonEmptyString(b.full_name) ? b.full_name : '__placeholder__',
    about_you: 'about_you' in b ? b.about_you : '__placeholder_about_you__',
  }
  const result = validateIntake(synthesized)
  if (!result.ok) {
    for (const [k, v] of Object.entries(result.errors)) {
      // Skip full_name errors from the synthesized placeholder — the
      // explicit check above is the canonical verdict for this field.
      if (k === 'full_name') continue
      errors[k] = v
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  // Strip any synthesized placeholders from the returned data so the update
  // action doesn't overwrite a real column with placeholder text.
  const data: Partial<IntakeInput> = { ...b } as Partial<IntakeInput>
  if (!isNonEmptyString(b.full_name)) delete (data as { full_name?: unknown }).full_name
  if (!('about_you' in b)) delete (data as { about_you?: unknown }).about_you
  return { ok: true, data }
}
