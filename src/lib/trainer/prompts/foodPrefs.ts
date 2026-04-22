// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — Prompt 3: elicit_food_preferences.
//
// Produces a short, adaptive set (5-10) of clarifying questions so the
// downstream meal plan feels personal instead of formulaic.  Questions are
// SHAPED by intake + baseline:
//   - vegan → no meat / dairy / egg questions
//   - tight budget → leftover / bulk / one-pot-priority questions
//   - 3 meals/day → no snack questions
//
// The output is NOT the meal plan.  It's a structured question set the UI
// renders; trainee answers become input to prompts/meals.ts.
//
// Ported from
// .planning/phases/trainer-01-intake-and-dispatcher/prompts/03-elicit-food-preferences.md
// with voice updated to the $150/hr coach persona.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeInput } from '../intakeSchema'
import type { SonnetTool } from '../sonnetRunner'
import type { BaselineOutput } from './baseline'
import { COACH_VOICE, DISCLAIMER } from '../trainerConfig'

export type FoodPrefsQuestion = {
  /** Stable snake_case slug prompt 4 will read. */
  question_id: string
  question_text: string
  question_type: 'single_select' | 'multi_select' | 'free_text' | 'scale'
  /** Required for single_select / multi_select. */
  options?: string[]
  scale_min?: number
  scale_max?: number
  scale_min_label?: string
  scale_max_label?: string
  /** One sentence, warm, written to the trainee. */
  why_asked: string
}

export type FoodPrefsOutput = {
  questions: FoodPrefsQuestion[]
  disclaimer: string
}

export type FoodPrefsAnswer = {
  question_id: string
  /** Denormalized so prompt 4 has the full question text as context. */
  question_text: string
  answer: string | string[] | number
}

const VOICE_DIRECTION = `${COACH_VOICE}  Check-in-specific: real adherence beats theoretical optimization — ask only the minimum needed to personalize the meal plan.`

export function buildFoodPrefsPrompt(input: {
  intake: IntakeInput
  baseline: BaselineOutput
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `${VOICE_DIRECTION}

You are running a quick food-preferences check-in with a trainee before designing their 2-week meal plan.  You have their intake + baseline.  Your job: produce a small, thoughtful set of 5-10 questions tailored to THIS trainee.

Rules:
1. Max 10 questions.  Fewer is usually better.  If intake already answers something, DO NOT ask.
2. Every question has a stated reason (why_asked) shown in the UI — this is what makes the form feel intuitive instead of bureaucratic.  Written to the trainee, one sentence, warm, direct.
3. Question types: single_select, multi_select, free_text, scale.
4. Skip by constraint:
   - dietary_preference=vegan → no meat, dairy, egg questions.
   - dietary_preference=vegetarian → no meat questions.
   - allergies mentions "nuts" → no nut options anywhere (and ADD a clarifying question: peanut vs tree nut).
   - grocery_budget_usd_per_week < 60 → prioritize leftover / bulk / one-pot questions.
   - meals_per_day = 3 → skip snack questions.
5. Must-ask (adapt wording to the person):
   - Favorite protein sources (from a list tailored to their diet).
   - Dealbreaker foods (free text: "anything you actively won't eat?").
   - Variety preference (repeat same meals / mid-week variety / totally different every day).
   - Cook-time tolerance per day (options realistic to the person — if they're a shift-worker, offer ≤10 min options).
   - Batch-prep willingness (yes one big prep day / some / no, fresh daily).
6. Should-ask (2-4 based on context):
   - Breakfast vs skip (only if meals_per_day ≥ 3 and not obvious).
   - Leftover tolerance (love / tolerate / prefer fresh).
   - Cuisines they lean toward (multi_select from 4-5 regionals picked per context: Mediterranean, East Asian, South Asian, Latin, American comfort, Middle Eastern).
   - Food-stress signal: "How often does deciding what to eat stress you out?" scale 1-5 — prompt 4 reads this to decide plan rigidity.
7. Never ask about weight, calories, or macros — baselined already.
8. why_asked voice: "I ask because people on a tight time budget do way better with batch meals than daily fresh cooks, and I want to set you up for actual adherence."  Short, warm, direct.  NOT generic ("we want to understand your preferences").

Every question_id is a stable snake_case slug prompt 4 reads.

Output carries disclaimer: "${DISCLAIMER}"`

  const intakePayload = stripUndefined({
    full_name: input.intake.full_name,
    dietary_preference: input.intake.dietary_preference ?? null,
    allergies: input.intake.allergies ?? null,
    grocery_budget_usd_per_week: input.intake.grocery_budget_usd_per_week ?? null,
    meals_per_day: input.intake.meals_per_day ?? null,
    occupation_activity: input.intake.occupation_activity ?? null,
    stress_level: input.intake.stress_level ?? null,
    trainer_notes: input.intake.trainer_notes ?? null,
  })

  const baselinePayload = {
    calorie_target_kcal: input.baseline.calorie_target_kcal,
    macro_targets_g: input.baseline.macro_targets_g,
    top_3_focus_areas: input.baseline.top_3_focus_areas,
  }

  const userMessage = `Intake (food-relevant fields):
${JSON.stringify(intakePayload, null, 2)}

Baseline (calorie + macro context):
${JSON.stringify(baselinePayload, null, 2)}

Produce a tailored 5-10 question food-preferences set by calling the record_food_preferences_questions tool.`

  return { systemPrompt, userMessage }
}

export const foodPrefsTool: SonnetTool = {
  name: 'record_food_preferences_questions',
  description: 'Generate a set of food-preferences questions tailored to the trainee.',
  input_schema: {
    type: 'object',
    required: ['questions', 'disclaimer'],
    properties: {
      questions: {
        type: 'array',
        minItems: 5,
        maxItems: 10,
        items: {
          type: 'object',
          required: ['question_id', 'question_text', 'question_type', 'why_asked'],
          properties: {
            question_id: { type: 'string' },
            question_text: { type: 'string' },
            question_type: {
              type: 'string',
              enum: ['single_select', 'multi_select', 'free_text', 'scale'],
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Required for single_select and multi_select.',
            },
            scale_min: { type: 'integer' },
            scale_max: { type: 'integer' },
            scale_min_label: { type: 'string' },
            scale_max_label: { type: 'string' },
            why_asked: { type: 'string', maxLength: 250 },
          },
        },
      },
      disclaimer: { type: 'string' },
    },
  },
}

function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out as Partial<T>
}
