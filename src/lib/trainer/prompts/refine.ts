// ─────────────────────────────────────────────────────────────────────────────
// Trainer — prompts/refine.ts — AI intake refinement.
//
// Reads the trainee's intake (about_you + structured fields) and produces
// 4-6 follow-up questions whose answers would meaningfully shift training
// or nutrition decisions for THIS specific person.  Questions are sport-
// aware, goal-aware, constraint-aware.  Answers are merged back into
// about_you as an "Additional context" block so every downstream prompt
// (baseline, roadmap, workout, meals, playbook, adjust) reads them for free.
//
// Not a schema change — intentional v1 simplification.  If refinement Q&A
// volume outgrows about_you readability, migrate to a dedicated
// refined_context jsonb column on koto_fitness_trainees.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeInput } from '../intakeSchema'
import type { SonnetTool } from '../sonnetRunner'
import { COACH_VOICE } from '../trainerConfig'
import { LEGAL_COMPLIANCE_PREAMBLE } from './legalCompliance'

export type RefineQuestion = {
  /** Stable snake_case slug so answers can be keyed by question. */
  question_id: string
  /** The question written to the trainee, second-person. */
  question_text: string
  question_type: 'short_text' | 'number' | 'select'
  /** Required for select type.  3-6 options max. */
  options?: string[]
  /** Example answer or unit hint for short_text / number. */
  placeholder?: string
  /** One sentence, trainee-facing.  Surfaced in UI so the trainee
   *  understands why the answer matters for their plan. */
  why_asked: string
}

export type RefineOutput = {
  questions: RefineQuestion[]
}

export type RefineAnswer = {
  question_id: string
  question_text: string
  answer: string
}

export function buildRefinePrompt(input: { intake: IntakeInput }): {
  systemPrompt: string
  userMessage: string
} {
  const systemPrompt = `${LEGAL_COMPLIANCE_PREAMBLE}

${COACH_VOICE}

You have an intake form for a trainee.  Your job: identify the 4-6 most valuable follow-up questions — ones whose answers would meaningfully shift how you program training or nutrition for THIS specific person.  Not trivia.  Not "interesting to know."  Questions whose answers change the program.

Rules:
- Produce 4-6 questions.  Fewer if the intake is already rich; more never.
- Skip anything already answered in the intake.  Do not re-ask about_you content.
- Sport-specific questions when the sport is clear from about_you.  A baseball pitcher needs velocity + throwing arm + elbow/shoulder history; a distance runner needs weekly mileage + race times + historical PRs.
- Favor concrete and measurable over vague.  "What's your current fastball velocity in mph?" is good; "How's your throwing going?" is not.
- Questions must be SHORT — one clear ask each.  If a question needs a multi-clause explanation, split it or drop it.
- why_asked is ONE sentence written to the trainee, explaining how their answer will shape the plan.
- For select questions: 3-6 mutually exclusive options.
- For number questions: include the unit in placeholder (e.g. "mph", "lbs", "minutes").

The caller will render these questions in a UI and submit the trainee's answers back.  Every answer will feed into every subsequent coaching prompt.`

  const intakePayload = stripUndefined({
    about_you: input.intake.about_you ?? null,
    age: input.intake.age ?? null,
    sex: input.intake.sex ?? null,
    height_cm: input.intake.height_cm ?? null,
    current_weight_kg: input.intake.current_weight_kg ?? null,
    target_weight_kg: input.intake.target_weight_kg ?? null,
    primary_goal: input.intake.primary_goal ?? null,
    training_experience_years: input.intake.training_experience_years ?? null,
    training_days_per_week: input.intake.training_days_per_week ?? null,
    equipment_access: input.intake.equipment_access ?? null,
    injuries: input.intake.injuries ?? null,
    medical_flags: input.intake.medical_flags ?? null,
    dietary_preference: input.intake.dietary_preference ?? null,
    allergies: input.intake.allergies ?? null,
    sleep_hours_avg: input.intake.sleep_hours_avg ?? null,
    stress_level: input.intake.stress_level ?? null,
    occupation_activity: input.intake.occupation_activity ?? null,
    meals_per_day: input.intake.meals_per_day ?? null,
  })

  const userMessage = `Intake on file:
${JSON.stringify(intakePayload, null, 2)}

Produce the follow-up question set by calling the record_refine_questions tool.`

  return { systemPrompt, userMessage }
}

export const refineTool: SonnetTool = {
  name: 'record_refine_questions',
  description: 'Record 4-6 follow-up intake questions for this specific trainee.',
  input_schema: {
    type: 'object',
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        minItems: 4,
        maxItems: 6,
        items: {
          type: 'object',
          required: ['question_id', 'question_text', 'question_type', 'why_asked'],
          properties: {
            question_id: { type: 'string' },
            question_text: { type: 'string' },
            question_type: {
              type: 'string',
              enum: ['short_text', 'number', 'select'],
            },
            options: {
              type: 'array',
              minItems: 3,
              maxItems: 6,
              items: { type: 'string' },
            },
            placeholder: { type: 'string' },
            why_asked: { type: 'string' },
          },
        },
      },
    },
  },
}

// ── Answer merge ─────────────────────────────────────────────────────────
// Formats the answered Q&A pairs into a text block and appends them to the
// trainee's about_you.  Subsequent refines append another block — trainers
// can edit about_you via the inline editor if the cumulative volume grows
// unwieldy.

export const REFINE_BLOCK_HEADER = '— Additional context (refined with AI) —'

export function mergeAnswersIntoAboutYou(
  existingAboutYou: string | null | undefined,
  answers: RefineAnswer[],
): string {
  const base = (existingAboutYou ?? '').trimEnd()
  if (answers.length === 0) return base
  const lines = answers.map((a) => `- ${a.question_text} ${a.answer.trim()}`)
  const block = `${REFINE_BLOCK_HEADER}\n${lines.join('\n')}`
  return base ? `${base}\n\n${block}` : block
}

function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out as Partial<T>
}
