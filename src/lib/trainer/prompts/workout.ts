// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — Prompt 2b: generate_workout_plan.
//
// Produces a 2-week trackable strength + conditioning program tailored to the
// trainee's goal, experience, equipment, time budget, readiness modifications,
// and the current roadmap phase.
//
// Every prescription is loggable (sets × target_reps × target_weight × RPE)
// AND ships optional how-to metadata (performance_cues, common_mistakes,
// video_query) so the trainee UI can expose a "how to perform" toggle beside
// each exercise without a second LLM call.
//
// The same tool is reused by prompts/adjust.ts — there it populates the
// optional adjustments_made[] + adherence_note fields to carry "what we
// changed and why" forward into UI.
//
// Ported & expanded from
// .planning/phases/trainer-01-intake-and-dispatcher/prompts/02-generate-workout-plan.md
// with post-pivot additions (2026-04-21):
//   - performance_cues, common_mistakes, video_query on every exercise.
//   - phase_ref links this block to the roadmap.
//   - adjustments_made[] + adherence_note carried on the same tool (block_number ≥ 2 for adjusts).
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeInput } from '../intakeSchema'
import type { SonnetTool } from '../sonnetRunner'
import type { BaselineOutput } from './baseline'
import type { RoadmapOutput } from './roadmap'
import { DISCLAIMER } from '../trainerConfig'

export type WorkoutExercise = {
  /** Stable lowercase snake_case slug; must match across weeks 1 & 2. */
  exercise_id: string
  name: string
  sets: number
  /** "8-10" or "5" — free string so ranges are allowed. */
  target_reps: string
  /** "95" | "bodyweight" | "find a weight that leaves 2-3 reps in reserve". */
  target_weight_kg_or_cue: string
  rest_seconds: number
  /** Second-person rule prompt 5 parses to decide next block. */
  progression_rule: string
  /** ONE-sentence primary cue for THIS lift today. */
  coaching_cue: string
  /** 3-6 bullets: stance, setup, execution, finish — how to perform. */
  performance_cues: string[]
  /** 2-4 red-flag errors to watch for. */
  common_mistakes: string[]
  /** Search-engine-ready phrase the UI feeds to YouTube / Google. */
  video_query: string
}

export type WorkoutSession = {
  day_label: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  /** 1-14 within the 2-week block. */
  day_number: number
  session_name: string
  estimated_duration_min: number
  warmup: string[]
  blocks: Array<{
    block_type: 'main_lift' | 'accessory' | 'conditioning' | 'mobility'
    exercises: WorkoutExercise[]
  }>
  cooldown: string[]
}

export type WorkoutAdjustment = {
  exercise_id: string
  change_type: string
  prior_target: Record<string, unknown>
  new_target: Record<string, unknown>
  rationale: string
}

export type WorkoutOutput = {
  program_name: string
  /** 1 for initial generation; ≥ 2 for adjust-from-progress blocks. */
  block_number: number
  /** Which roadmap phase this block belongs to. */
  phase_ref: 1 | 2 | 3
  weeks: [
    { week_number: 1; sessions: WorkoutSession[] },
    { week_number: 2; sessions: WorkoutSession[] },
  ]
  /** Only populated on adjust calls. */
  adjustments_made?: WorkoutAdjustment[]
  /** Only populated on adjust calls. One honest sentence to the trainee. */
  adherence_note?: string
  disclaimer: string
}

const VOICE_DIRECTION = `You are a $150/hour personal trainer and strength coach with 15 years of experience.  Specific, credentialed, sport-aware, ROI-conscious, grounded.  You quote numbers.  You cite the client's age, sport, equipment, and goal directly in programming choices.  No hype language.  No generic cues.  Warm but direct.`

export function buildWorkoutPrompt(input: {
  intake: IntakeInput
  baseline: BaselineOutput
  roadmap: RoadmapOutput
  phase: 1 | 2 | 3
  block_number?: number
}): { systemPrompt: string; userMessage: string } {
  const blockNum = input.block_number ?? 1
  const phase = input.roadmap.phases.find(p => p.phase_number === input.phase) ?? input.roadmap.phases[0]

  const systemPrompt = `${VOICE_DIRECTION}

You are designing a 2-week training block for a trainee.  You have their intake, baseline, roadmap, and the current roadmap phase that this block belongs to.  Your job: produce a fully tracked program where every prescription is loggable and every next-block decision can be made from logged numbers.

Design principles:
1. Match their training_days_per_week exactly.  If they said 3 days, 3 sessions per week.  Unused capacity beats undone sessions.
2. Match equipment_access strictly.  full_gym → barbell lifts; home_gym → dumbbell / adjustable; bands → resistance-band primaries; none → bodyweight progressions.
3. 2-week periodization: week 1 introduces the movements at moderate RPE (7).  Week 2 adds either a set, a rep, or 2.5% load per exercise — pick ONE mechanism per exercise.  Beginners almost always get rep progression; intermediate / advanced get load progression.
4. Warmup 5-8 min per session — NAME specific movements, not generic "warmup."
5. Session order: main lift → accessory → conditioning (optional, goal-dependent) → mobility cooldown 3-5 min.
6. For every exercise: stable snake_case exercise_id (e.g. "barbell_back_squat", "db_bench_press") that stays consistent across weeks so logged data matches.  Human name for display.
7. Set-by-set prescription: sets, target_reps (range or exact), target_weight_kg_or_cue (a numeric kg OR cue like "bodyweight" / "find a weight that leaves 2-3 reps in reserve" for first-time lifts), rest_seconds, progression_rule (second-person, measurable — prompt 5 parses this), coaching_cue (ONE sentence, specific).
8. Respect baseline.training_readiness.modifications_required — e.g. "no 1RM testing" (minors) → every prescription is submaximal; "no spinal loading" → swap squats / deadlifts for leg press + hip thrust.
9. The current roadmap phase sets the training theme: phase 1 foundation → cleaner movement, moderate loads; phase 2 build → higher volume; phase 3 express → higher intensity, lower volume, sport-relevant expression.  The block must read like it belongs to THIS phase, not a random month.

how-to metadata (REQUIRED on every exercise):
- performance_cues: 3-6 bullets, specific to this exercise.  Stance / setup / execution / finish.  "Feet shoulder-width, toes slightly out, bar in heel of hand" — NOT "good form."
- common_mistakes: 2-4 bullets.  Concrete errors the trainee might make ("knees caving inward on the drive", "bar drifting forward on descent") — not generic warnings.
- video_query: a search string the UI pastes directly into YouTube / Google.  Include a credible source-family when obvious ("Squat University goblet squat form", "Jeff Nippard incline dumbbell press setup", "Athlean-X plank for core stiffness").  One query per exercise.

Voice:
- coaching_cue is ONE sentence, specific to that lift today — "Drive knees out on the way up" is good; "keep good form" is not.
- progression_rule is written to the trainee: "If you complete all 3 sets at 10 reps with RPE ≤ 7, add 2.5 kg next week; otherwise repeat."  Prompt 5 parses this.

Constraints:
- Max 5 exercises per session.  Beyond that is noise.
- Rest: 2-3 min between heavy compound sets; 60-90 sec accessories; 30-60 sec conditioning intervals.
- Never prescribe 1RM attempts in a first block (block_number = 1).
- < 6 months experience → no barbell deadlifts from the floor; trap-bar or rack pulls only.
- block_number = ${blockNum}.  phase_ref = ${input.phase}.  weeks array MUST contain exactly 2 entries, week_number 1 and 2.
- Every output carries disclaimer: "${DISCLAIMER}"`

  const intakePayload = stripUndefined({
    full_name: input.intake.full_name,
    age: input.intake.age ?? null,
    sex: input.intake.sex ?? null,
    current_weight_kg: input.intake.current_weight_kg ?? null,
    primary_goal: input.intake.primary_goal ?? null,
    training_experience_years: input.intake.training_experience_years ?? null,
    training_days_per_week: input.intake.training_days_per_week ?? null,
    equipment_access: input.intake.equipment_access ?? null,
    injuries: input.intake.injuries ?? null,
    trainer_notes: input.intake.trainer_notes ?? null,
  })

  const userMessage = `Intake:
${JSON.stringify(intakePayload, null, 2)}

Baseline (training readiness + focus areas):
${JSON.stringify(
    {
      starting_fitness_level: input.baseline.starting_fitness_level,
      training_readiness: input.baseline.training_readiness,
      top_3_focus_areas: input.baseline.top_3_focus_areas,
    },
    null,
    2,
  )}

Current roadmap phase (phase ${input.phase}):
${JSON.stringify(phase, null, 2)}

Produce the 2-week block for this phase by calling the record_workout_plan tool.
block_number = ${blockNum}
phase_ref = ${input.phase}`

  return { systemPrompt, userMessage }
}

// Exercise schema shared by weeks 1 & 2.  how-to fields REQUIRED on every exercise.
const exerciseSchema = {
  type: 'object' as const,
  required: [
    'exercise_id',
    'name',
    'sets',
    'target_reps',
    'target_weight_kg_or_cue',
    'rest_seconds',
    'progression_rule',
    'coaching_cue',
    'performance_cues',
    'common_mistakes',
    'video_query',
  ],
  properties: {
    exercise_id: { type: 'string' as const },
    name: { type: 'string' as const },
    sets: { type: 'integer' as const, minimum: 1, maximum: 6 },
    target_reps: { type: 'string' as const },
    target_weight_kg_or_cue: { type: 'string' as const },
    rest_seconds: { type: 'integer' as const },
    progression_rule: { type: 'string' as const },
    coaching_cue: { type: 'string' as const },
    performance_cues: {
      type: 'array' as const,
      minItems: 3,
      maxItems: 6,
      items: { type: 'string' as const },
    },
    common_mistakes: {
      type: 'array' as const,
      minItems: 2,
      maxItems: 4,
      items: { type: 'string' as const },
    },
    video_query: { type: 'string' as const },
  },
}

export const workoutTool: SonnetTool = {
  name: 'record_workout_plan',
  description: "Record the trainee's 2-week workout program (or next-block adjustment).",
  input_schema: {
    type: 'object',
    required: ['program_name', 'block_number', 'phase_ref', 'weeks', 'disclaimer'],
    properties: {
      program_name: { type: 'string' },
      block_number: {
        type: 'integer',
        minimum: 1,
        description:
          'Initial generation = 1.  Adjust-from-progress calls MUST be >= 2 (enforced by prompts/adjust.ts guardrails).',
      },
      phase_ref: { type: 'integer', enum: [1, 2, 3] },
      weeks: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        items: {
          type: 'object',
          required: ['week_number', 'sessions'],
          properties: {
            week_number: { type: 'integer', enum: [1, 2] },
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                required: [
                  'day_label',
                  'day_number',
                  'session_name',
                  'estimated_duration_min',
                  'warmup',
                  'blocks',
                  'cooldown',
                ],
                properties: {
                  day_label: {
                    type: 'string',
                    enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                  },
                  day_number: { type: 'integer', minimum: 1, maximum: 14 },
                  session_name: { type: 'string' },
                  estimated_duration_min: { type: 'integer' },
                  warmup: { type: 'array', items: { type: 'string' } },
                  blocks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['block_type', 'exercises'],
                      properties: {
                        block_type: {
                          type: 'string',
                          enum: ['main_lift', 'accessory', 'conditioning', 'mobility'],
                        },
                        exercises: {
                          type: 'array',
                          maxItems: 5,
                          items: exerciseSchema,
                        },
                      },
                    },
                  },
                  cooldown: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      // adjust-from-progress extensions — optional on initial generation, required
      // in spirit on adjust calls (enforced by the adjust prompt text).
      adjustments_made: {
        type: 'array',
        items: {
          type: 'object',
          required: ['exercise_id', 'change_type', 'prior_target', 'new_target', 'rationale'],
          properties: {
            exercise_id: { type: 'string' },
            change_type: {
              type: 'string',
              enum: [
                'progress_load',
                'progress_reps',
                'progress_sets',
                'deload_load',
                'deload_reps',
                'drop_set',
                'substitute',
                'hold_no_data',
                'accelerate_progression',
              ],
            },
            prior_target: {
              type: 'object',
              properties: {
                sets: { type: 'integer' },
                target_reps: { type: 'string' },
                target_weight_kg_or_cue: { type: 'string' },
              },
            },
            new_target: {
              type: 'object',
              properties: {
                sets: { type: 'integer' },
                target_reps: { type: 'string' },
                target_weight_kg_or_cue: { type: 'string' },
              },
            },
            rationale: { type: 'string', maxLength: 300 },
          },
        },
      },
      adherence_note: {
        type: 'string',
        description:
          'One honest sentence to the trainee summarizing how the prior block went.  Populated only on adjust-from-progress calls.',
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
