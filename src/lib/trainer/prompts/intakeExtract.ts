// ─────────────────────────────────────────────────────────────────────────────
// Trainer — prompts/intakeExtract.ts
//
// The AI-first intake entry point.  Trainee types ONE paragraph about
// themselves + goals; this prompt extracts every IntakeInput field it can
// confidently infer AND returns a short list of follow-up questions for
// the remaining required fields.  The UI then shows:
//   - the extracted fields pre-populated and editable,
//   - plus the follow-ups as targeted inputs.
//
// Replaces the 17-field flat form as the primary trainee intake — huge UX
// win: trainees never answer what they already said.
// ─────────────────────────────────────────────────────────────────────────────

import type { SonnetTool } from '../sonnetRunner'
import { COACH_VOICE } from '../trainerConfig'

export type IntakeFollowUpQuestion = {
  /** MUST equal one of the IntakeInput field names (age / sex / etc). */
  question_id: string
  /** Trainee-facing text, second-person, short. */
  question_text: string
  question_type: 'short_text' | 'number' | 'select'
  /** For select only; 3-6 mutually exclusive values. */
  options?: string[]
  /** Unit hint for number / short_text (e.g. "lbs", "years"). */
  placeholder?: string
  /** One sentence, trainee-facing, why the answer changes the plan. */
  why_asked: string
}

export type IntakeExtractOutput = {
  /** Partial IntakeInput — only fields extracted with HIGH confidence. */
  extracted: {
    full_name?: string
    about_you?: string
    age?: number
    sex?: 'M' | 'F' | 'Other'
    height_cm?: number
    current_weight_kg?: number
    target_weight_kg?: number
    primary_goal?: 'lose_fat' | 'gain_muscle' | 'maintain' | 'performance' | 'recomp'
    training_experience_years?: number
    training_days_per_week?: number
    equipment_access?: 'none' | 'bands' | 'home_gym' | 'full_gym'
    medical_flags?: string
    injuries?: string
    dietary_preference?: 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'custom'
    allergies?: string
    sleep_hours_avg?: number
    stress_level?: number
    occupation_activity?: 'sedentary' | 'light' | 'moderate' | 'heavy'
    meals_per_day?: number
  }
  /** Questions for required fields NOT extracted.  Empty = intake complete. */
  remaining_questions: IntakeFollowUpQuestion[]
  /** Cleaned version of the trainee's free text, saved as about_you. */
  about_you: string
}

export function buildIntakeExtractPrompt(input: {
  freeText: string
  fullNameHint?: string | null
  /** Fields the UI collected upfront — Sonnet should NOT re-ask these. */
  alreadyFilled?: Partial<IntakeExtractOutput['extracted']>
}): {
  systemPrompt: string
  userMessage: string
} {
  const systemPrompt = `${COACH_VOICE}

You are reading a new trainee's free-text introduction.  Your job: extract every IntakeInput field you can infer with HIGH confidence from what they wrote, and identify the required fields that still need to be asked.

IntakeInput fields (fill any of these into "extracted" if the answer is clearly in the text):

- age (integer, 10-120): "I'm 35," "16 years old"
- sex (M / F / Other): only from explicit mentions — don't guess from a name
- height_cm (integer): convert from imperial.  5'10" = 178.  6'2" = 188.
- current_weight_kg (number): convert from lbs.  190 lbs = 86.18.  Round to one decimal.
- target_weight_kg (number): only if an explicit goal weight is stated
- primary_goal: map carefully —
    "lose fat / cut / drop weight / slim down" → lose_fat
    "build muscle / bulk / get bigger / put on mass" → gain_muscle
    "stay in shape / maintain what I have" → maintain
    "run faster / hit harder / throw harder / compete better / sport-specific" → performance
    "look better naked / recomp / lose fat and build muscle simultaneously" → recomp
- training_experience_years (number ≥ 0): "lifted for 3 years"
- training_days_per_week (integer 0-7)
- equipment_access:
    "full gym / commercial gym / school weight room" → full_gym
    "home gym / dumbbells at home / rack in garage / adjustable set" → home_gym
    "resistance bands only / bands" → bands
    "no equipment / bodyweight only" → none
- medical_flags (string): anything medical (cardiac, hypertension, meds).  If they explicitly say they have no medical issues, set "None".  If they don't mention medical at all, DON'T fill — ask.
- injuries (string): same rule.  Explicit mention → capture.  Silent → ask.
- dietary_preference: only explicit mentions (vegan, keto, pescatarian, etc.).  No mention → ask.
- allergies (string): same — explicit → capture, silent → ask.
- sleep_hours_avg (number): "I sleep about 7 hours" → 7
- stress_level (integer 1-10)
- occupation_activity:
    "desk job / office / work from a laptop" → sedentary
    "teacher / some walking / light on feet" → light
    "on my feet all day / waiter / nurse" → moderate
    "construction / physical labor" → heavy
- meals_per_day (integer 3-6)
- full_name: only if they sign off with their name or say "my name is X"

Rules:
1. HIGH confidence only.  If the text says "I've been in and out of the gym," don't guess training_days_per_week — ask.  If they mention a sport but not their goal clearly, ask primary_goal.
2. Conversions: ALWAYS to metric.  Imperial in, metric out.
3. "about_you": return the trainee's paragraph CLEANED — fix typos, fix punctuation, keep their voice, never shorter than the original by more than 20% or longer than 150%.  This is what every downstream Sonnet prompt reads, so preserve sport / job / constraints / motivation details.
4. For every REQUIRED field not extracted, produce a targeted follow-up question:
   - question_id = the exact field name (e.g. "age")
   - question_text: written TO the trainee, second-person, one sentence.  No jargon.
   - type/options/placeholder appropriate to the field
   - why_asked: one sentence, concrete, sounds like a coach — "This sets your calorie target," "This changes whether we program barbell lifts or dumbbell-only."
5. Required fields (ask if not extracted): age, sex, height_cm, current_weight_kg, primary_goal, training_experience_years, training_days_per_week, equipment_access, medical_flags, injuries, dietary_preference, allergies, sleep_hours_avg, stress_level, occupation_activity, meals_per_day.
6. Optional (DON'T ask if missing): target_weight_kg, full_name (we already have the auth email).

Call the record_intake_extraction tool with { extracted, remaining_questions, about_you }.`

  const nameHint = input.fullNameHint ? `\n\nKnown so far from the account: full_name = "${input.fullNameHint}" (don't re-ask).` : ''

  // Fields the UI form already captured upfront (structured basics).  Do NOT
  // include these in remaining_questions — the UI already has them.  Do
  // include them in the "extracted" output so the final payload is complete.
  const alreadyFilled = input.alreadyFilled && Object.keys(input.alreadyFilled).length > 0
    ? `\n\nThe trainee ALREADY answered these in a structured form — include them verbatim in "extracted" and NEVER list them in remaining_questions:\n${JSON.stringify(input.alreadyFilled, null, 2)}`
    : ''

  const userMessage = `Trainee wrote:
"""
${input.freeText.trim()}
"""
${nameHint}${alreadyFilled}

Extract every IntakeInput field you can, clean up their paragraph into about_you, and list targeted follow-up questions for the required fields that weren't answered by the form OR the paragraph.`

  return { systemPrompt, userMessage }
}

export const intakeExtractTool: SonnetTool = {
  name: 'record_intake_extraction',
  description: 'Record the fields extracted from the trainee free-text intro plus the follow-up questions still needed.',
  input_schema: {
    type: 'object',
    required: ['extracted', 'remaining_questions', 'about_you'],
    properties: {
      extracted: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          age: { type: 'integer', minimum: 10, maximum: 120 },
          sex: { type: 'string', enum: ['M', 'F', 'Other'] },
          height_cm: { type: 'number' },
          current_weight_kg: { type: 'number' },
          target_weight_kg: { type: 'number' },
          primary_goal: {
            type: 'string',
            enum: ['lose_fat', 'gain_muscle', 'maintain', 'performance', 'recomp'],
          },
          training_experience_years: { type: 'number', minimum: 0 },
          training_days_per_week: { type: 'integer', minimum: 0, maximum: 7 },
          equipment_access: {
            type: 'string',
            enum: ['none', 'bands', 'home_gym', 'full_gym'],
          },
          medical_flags: { type: 'string' },
          injuries: { type: 'string' },
          dietary_preference: {
            type: 'string',
            enum: ['none', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'custom'],
          },
          allergies: { type: 'string' },
          sleep_hours_avg: { type: 'number', minimum: 0, maximum: 16 },
          stress_level: { type: 'integer', minimum: 1, maximum: 10 },
          occupation_activity: {
            type: 'string',
            enum: ['sedentary', 'light', 'moderate', 'heavy'],
          },
          meals_per_day: { type: 'integer', minimum: 3, maximum: 6 },
        },
      },
      remaining_questions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['question_id', 'question_text', 'question_type', 'why_asked'],
          properties: {
            question_id: { type: 'string' },
            question_text: { type: 'string' },
            question_type: { type: 'string', enum: ['short_text', 'number', 'select'] },
            options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
            placeholder: { type: 'string' },
            why_asked: { type: 'string' },
          },
        },
      },
      about_you: { type: 'string', minLength: 1 },
    },
  },
}
