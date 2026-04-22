// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — prompt builder + tool schema sanity tests.
//
// Pure unit tests against the builders.  No Anthropic, no DB, no network.
// For every prompt module, we assert:
//   - The builder returns { systemPrompt, userMessage } both non-empty.
//   - The systemPrompt carries the $150/hour coach voice cue.
//   - The tool export has { name, description, input_schema } with the
//     expected required fields at the top level.
//
// Pattern mirrors tests/trainer/phase1/intakeSchema.test.ts — plain vitest,
// no JSX, no mocks.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import type { IntakeInput } from '../../../src/lib/trainer/intakeSchema'
import {
  buildBaselinePrompt,
  baselineTool,
  buildRoadmapPrompt,
  roadmapTool,
  buildWorkoutPrompt,
  workoutTool,
  buildFoodPrefsPrompt,
  foodPrefsTool,
  buildMealsPrompt,
  mealsTool,
  buildAdjustPrompt,
  type BaselineOutput,
  type RoadmapOutput,
  type WorkoutOutput,
  type FoodPrefsQuestion,
  type FoodPrefsAnswer,
  type WorkoutLog,
  type AdherenceSummary,
} from '../../../src/lib/trainer/prompts'

// ── Shared fixtures ─────────────────────────────────────────────────────────

const MINIMAL_INTAKE: IntakeInput = {
  full_name: 'Jane Runner',
  age: 34,
  sex: 'F',
  height_cm: 168,
  current_weight_kg: 72.4,
  target_weight_kg: 65,
  primary_goal: 'lose_fat',
  training_experience_years: 3,
  training_days_per_week: 4,
  equipment_access: 'full_gym',
  dietary_preference: 'pescatarian',
  allergies: 'shellfish',
  grocery_budget_usd_per_week: 120,
  meals_per_day: 4,
  sleep_hours_avg: 7.5,
  stress_level: 5,
  occupation_activity: 'light',
  trainer_notes: 'Training for spring half-marathon; former HS track athlete.',
}

const MINIMAL_BASELINE: BaselineOutput = {
  body_composition: { bmi_or_null: 25.7, category: 'overweight', notes: 'Mild.' },
  starting_fitness_level: 'intermediate',
  training_readiness: { ok_to_train: true, red_flags: [], modifications_required: [] },
  calorie_target_kcal: 1900,
  macro_targets_g: { protein_g: 150, fat_g: 60, carb_g: 200 },
  estimated_weekly_weight_change_kg: -0.5,
  adjusted_target_weight_timeline_weeks: 16,
  top_3_focus_areas: [
    'Hit 150g protein every day before anything else',
    'Easy-pace mileage 3× / week to build aerobic base',
    'Two strength sessions focused on single-leg stability',
  ],
  coach_summary: 'Jane is an intermediate trainee aiming for a half-marathon while cutting to 65 kg.',
  disclaimer: 'x',
}

const MINIMAL_ROADMAP: RoadmapOutput = {
  client_context_summary: 'Jane, 34, half-marathon goal while cutting.',
  phases: [
    {
      phase_number: 1,
      phase_name: 'Foundation',
      days_range: { start: 1, end: 30 },
      training_theme: 'Aerobic base + movement quality',
      nutrition_theme: 'Full deficit, high protein',
      progression_description: 'Week-over-week +10% mileage, +1 rep per strength lift.',
      end_of_phase_milestones: [
        'Run 10 km continuous at easy pace',
        'Goblet squat 20 kg × 10 at RPE 7',
        'Protein ≥ 140 g on 6 of 7 days',
      ],
      recovery_focus: ['7.5h sleep average', 'mobility 10 min daily'],
    },
    {
      phase_number: 2,
      phase_name: 'Build',
      days_range: { start: 31, end: 60 },
      training_theme: 'Tempo + strength volume',
      nutrition_theme: 'Hold deficit',
      progression_description: 'Layer tempo runs + RPE 8 strength sets.',
      end_of_phase_milestones: [
        '5 km tempo at 5:30/km',
        'Single-leg RDL 16 kg × 10',
        'Body weight -3 kg from start',
      ],
      recovery_focus: ['deload day every 10', 'monitor soreness'],
    },
    {
      phase_number: 3,
      phase_name: 'Express',
      days_range: { start: 61, end: 90 },
      training_theme: 'Half-marathon-specific pace + strength maintenance',
      nutrition_theme: 'Maintenance taper',
      progression_description: 'Sharpen race pace; reduce strength volume.',
      end_of_phase_milestones: ['Half marathon finish ≤ 2:00', 'Maintain goblet squat', 'Hold 65 kg BW'],
      recovery_focus: ['pre-race taper', 'sleep floor 8h week 12'],
    },
  ],
  overall_strategy_note:
    'Three phases move from aerobic base and movement quality to tempo + strength volume to race-specific expression.',
  disclaimer: 'x',
}

const MINIMAL_WORKOUT: WorkoutOutput = {
  program_name: 'Foundation Block 1',
  block_number: 1,
  phase_ref: 1,
  weeks: [
    {
      week_number: 1,
      sessions: [
        {
          day_label: 'Mon',
          day_number: 1,
          session_name: 'Lower + Easy Run',
          estimated_duration_min: 60,
          warmup: ['5 min easy jog', 'hip openers ×5'],
          blocks: [
            {
              block_type: 'main_lift',
              exercises: [
                {
                  exercise_id: 'goblet_squat',
                  name: 'Goblet Squat',
                  sets: 3,
                  target_reps: '8-10',
                  target_weight_kg_or_cue: '16',
                  rest_seconds: 120,
                  progression_rule: 'If all sets at 10 reps RPE ≤ 7, add 2.5 kg next week.',
                  coaching_cue: 'Drive knees out on the way up.',
                  performance_cues: ['Feet shoulder-width', 'Chest proud', 'Sit between ankles', 'Drive through heel'],
                  common_mistakes: ['Knees caving in', 'Chest collapse'],
                  video_query: 'Squat University goblet squat form',
                },
              ],
            },
          ],
          cooldown: ['5 min easy walk'],
        },
      ],
    },
    {
      week_number: 2,
      sessions: [
        {
          day_label: 'Mon',
          day_number: 8,
          session_name: 'Lower + Easy Run',
          estimated_duration_min: 60,
          warmup: ['5 min easy jog', 'hip openers ×5'],
          blocks: [
            {
              block_type: 'main_lift',
              exercises: [
                {
                  exercise_id: 'goblet_squat',
                  name: 'Goblet Squat',
                  sets: 3,
                  target_reps: '8-10',
                  target_weight_kg_or_cue: '18',
                  rest_seconds: 120,
                  progression_rule: 'If all sets at 10 reps RPE ≤ 7, add 2.5 kg next week.',
                  coaching_cue: 'Drive knees out on the way up.',
                  performance_cues: ['Feet shoulder-width', 'Chest proud', 'Sit between ankles', 'Drive through heel'],
                  common_mistakes: ['Knees caving in', 'Chest collapse'],
                  video_query: 'Squat University goblet squat form',
                },
              ],
            },
          ],
          cooldown: ['5 min easy walk'],
        },
      ],
    },
  ],
  disclaimer: 'x',
}

const MINIMAL_PREFS_QS: FoodPrefsQuestion[] = [
  {
    question_id: 'variety_preference',
    question_text: 'How much variety do you want in your meals?',
    question_type: 'single_select',
    options: ['repeat same meals', 'some variety', 'totally different every day'],
    why_asked: 'I ask because rigid variety + tight time budget usually tanks adherence.',
  },
]

const MINIMAL_PREFS_ANS: FoodPrefsAnswer[] = [
  {
    question_id: 'variety_preference',
    question_text: 'How much variety do you want in your meals?',
    answer: 'some variety',
  },
]

const MINIMAL_LOGS: WorkoutLog[] = [
  {
    session_day_number: 1,
    exercise_id: 'goblet_squat',
    exercise_name: 'Goblet Squat',
    set_number: 1,
    actual_weight_kg: 16,
    actual_reps: 10,
    rpe: 7,
    notes: null,
    session_logged_at: '2026-04-14T18:00:00Z',
  },
]

const MINIMAL_ADHERENCE: AdherenceSummary = {
  scheduled_sessions: 8,
  logged_sessions: 7,
  adherence_pct: 87.5,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function assertVoice(systemPrompt: string): void {
  // The $150/hour coach persona must land verbatim in every prompt's system
  // text.  Matches the locked direction.
  expect(systemPrompt).toMatch(/\$150\/hour personal trainer/)
}

function assertToolShape(tool: { name: string; description: string; input_schema: Record<string, unknown> }): void {
  expect(tool.name).toBeTypeOf('string')
  expect(tool.name.length).toBeGreaterThan(0)
  expect(tool.description).toBeTypeOf('string')
  expect(tool.description.length).toBeGreaterThan(0)
  expect(tool.input_schema).toBeTypeOf('object')
  const schema = tool.input_schema as { type?: string; required?: unknown[]; properties?: Record<string, unknown> }
  expect(schema.type).toBe('object')
  expect(Array.isArray(schema.required)).toBe(true)
  expect(schema.properties).toBeTypeOf('object')
}

// ── Baseline ────────────────────────────────────────────────────────────────

describe('buildBaselinePrompt', () => {
  it('returns non-empty systemPrompt + userMessage', () => {
    const r = buildBaselinePrompt({ intake: MINIMAL_INTAKE })
    expect(r.systemPrompt.length).toBeGreaterThan(0)
    expect(r.userMessage.length).toBeGreaterThan(0)
  })

  it('carries the $150/hour coach voice', () => {
    const r = buildBaselinePrompt({ intake: MINIMAL_INTAKE })
    assertVoice(r.systemPrompt)
  })

  it('includes the full intake payload in user message', () => {
    const r = buildBaselinePrompt({ intake: MINIMAL_INTAKE })
    expect(r.userMessage).toContain('Jane Runner')
    expect(r.userMessage).toContain('record_baseline')
  })

  it('prompts for top_3_focus_areas and sport awareness', () => {
    const r = buildBaselinePrompt({ intake: MINIMAL_INTAKE })
    expect(r.systemPrompt).toContain('top_3_focus_areas')
    expect(r.systemPrompt.toLowerCase()).toContain('trainer_notes')
  })

  it('includes minor-athlete safeguard language', () => {
    const r = buildBaselinePrompt({ intake: MINIMAL_INTAKE })
    expect(r.systemPrompt).toMatch(/minor.athlete|age < 18/i)
    expect(r.systemPrompt).toMatch(/1RM/)
  })
})

describe('baselineTool', () => {
  it('has valid tool shape with top_3_focus_areas required', () => {
    assertToolShape(baselineTool)
    const required = (baselineTool.input_schema as { required: string[] }).required
    expect(required).toContain('top_3_focus_areas')
    expect(required).toContain('calorie_target_kcal')
    expect(required).toContain('training_readiness')
  })
})

// ── Roadmap ─────────────────────────────────────────────────────────────────

describe('buildRoadmapPrompt', () => {
  it('returns non-empty prompt parts', () => {
    const r = buildRoadmapPrompt({ intake: MINIMAL_INTAKE, baseline: MINIMAL_BASELINE })
    expect(r.systemPrompt.length).toBeGreaterThan(0)
    expect(r.userMessage.length).toBeGreaterThan(0)
  })

  it('carries the $150/hour coach voice', () => {
    const r = buildRoadmapPrompt({ intake: MINIMAL_INTAKE, baseline: MINIMAL_BASELINE })
    assertVoice(r.systemPrompt)
  })

  it('requires three distinct 30-day phases and measurable milestones', () => {
    const r = buildRoadmapPrompt({ intake: MINIMAL_INTAKE, baseline: MINIMAL_BASELINE })
    expect(r.systemPrompt).toMatch(/days 1-30/)
    expect(r.systemPrompt).toMatch(/days 31-60/)
    expect(r.systemPrompt).toMatch(/days 61-90/)
    expect(r.systemPrompt.toLowerCase()).toContain('measurable')
  })
})

describe('roadmapTool', () => {
  it('has valid tool shape with phases array of exactly 3', () => {
    assertToolShape(roadmapTool)
    const schema = roadmapTool.input_schema as {
      required: string[]
      properties: { phases: { minItems: number; maxItems: number } }
    }
    expect(schema.required).toContain('phases')
    expect(schema.properties.phases.minItems).toBe(3)
    expect(schema.properties.phases.maxItems).toBe(3)
  })
})

// ── Workout ─────────────────────────────────────────────────────────────────

describe('buildWorkoutPrompt', () => {
  it('returns non-empty prompt parts', () => {
    const r = buildWorkoutPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      roadmap: MINIMAL_ROADMAP,
      phase: 1,
    })
    expect(r.systemPrompt.length).toBeGreaterThan(0)
    expect(r.userMessage.length).toBeGreaterThan(0)
  })

  it('carries the $150/hour coach voice', () => {
    const r = buildWorkoutPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      roadmap: MINIMAL_ROADMAP,
      phase: 2,
    })
    assertVoice(r.systemPrompt)
  })

  it('passes phase + block_number through', () => {
    const r = buildWorkoutPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      roadmap: MINIMAL_ROADMAP,
      phase: 2,
      block_number: 3,
    })
    expect(r.userMessage).toContain('phase_ref = 2')
    expect(r.userMessage).toContain('block_number = 3')
  })

  it('defaults block_number to 1', () => {
    const r = buildWorkoutPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      roadmap: MINIMAL_ROADMAP,
      phase: 1,
    })
    expect(r.userMessage).toContain('block_number = 1')
  })
})

describe('workoutTool', () => {
  it('has valid tool shape with phase_ref + adjustments_made surface', () => {
    assertToolShape(workoutTool)
    const schema = workoutTool.input_schema as {
      required: string[]
      properties: Record<string, { type?: string; items?: unknown }>
    }
    expect(schema.required).toContain('phase_ref')
    expect(schema.required).toContain('block_number')
    expect(schema.properties.adjustments_made).toBeDefined()
    expect(schema.properties.adherence_note).toBeDefined()
  })

  it('requires performance_cues, common_mistakes, video_query on every exercise', () => {
    // Walk weeks.items.properties.sessions.items.properties.blocks.items.properties.exercises.items
    const schema = workoutTool.input_schema as Record<string, unknown>
    const weeks = (schema.properties as Record<string, unknown>).weeks as Record<string, unknown>
    const weekItem = (weeks.items as Record<string, unknown>).properties as Record<string, unknown>
    const sessions = weekItem.sessions as Record<string, unknown>
    const sessionItem = (sessions.items as Record<string, unknown>).properties as Record<string, unknown>
    const blocks = sessionItem.blocks as Record<string, unknown>
    const blockItem = (blocks.items as Record<string, unknown>).properties as Record<string, unknown>
    const exercises = blockItem.exercises as Record<string, unknown>
    const exerciseSchema = exercises.items as { required: string[]; properties: Record<string, unknown> }

    expect(exerciseSchema.required).toContain('performance_cues')
    expect(exerciseSchema.required).toContain('common_mistakes')
    expect(exerciseSchema.required).toContain('video_query')
    expect(exerciseSchema.required).toContain('exercise_id')
  })
})

// ── Food prefs ──────────────────────────────────────────────────────────────

describe('buildFoodPrefsPrompt', () => {
  it('returns non-empty prompt parts', () => {
    const r = buildFoodPrefsPrompt({ intake: MINIMAL_INTAKE, baseline: MINIMAL_BASELINE })
    expect(r.systemPrompt.length).toBeGreaterThan(0)
    expect(r.userMessage.length).toBeGreaterThan(0)
  })

  it('carries the $150/hour coach voice', () => {
    const r = buildFoodPrefsPrompt({ intake: MINIMAL_INTAKE, baseline: MINIMAL_BASELINE })
    assertVoice(r.systemPrompt)
  })

  it('directs the LLM to skip by constraint', () => {
    const r = buildFoodPrefsPrompt({ intake: MINIMAL_INTAKE, baseline: MINIMAL_BASELINE })
    expect(r.systemPrompt).toMatch(/Skip by constraint/i)
    expect(r.systemPrompt).toContain('vegan')
  })
})

describe('foodPrefsTool', () => {
  it('has valid tool shape capped 5-10 questions', () => {
    assertToolShape(foodPrefsTool)
    const schema = foodPrefsTool.input_schema as {
      properties: { questions: { minItems: number; maxItems: number } }
    }
    expect(schema.properties.questions.minItems).toBe(5)
    expect(schema.properties.questions.maxItems).toBe(10)
  })
})

// ── Meals ───────────────────────────────────────────────────────────────────

describe('buildMealsPrompt', () => {
  it('returns non-empty prompt parts', () => {
    const r = buildMealsPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      foodPreferences: { questions: MINIMAL_PREFS_QS, answers: MINIMAL_PREFS_ANS },
    })
    expect(r.systemPrompt.length).toBeGreaterThan(0)
    expect(r.userMessage.length).toBeGreaterThan(0)
  })

  it('carries the $150/hour coach voice', () => {
    const r = buildMealsPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      foodPreferences: { questions: MINIMAL_PREFS_QS, answers: MINIMAL_PREFS_ANS },
    })
    assertVoice(r.systemPrompt)
  })

  it('names phase nutrition lens explicitly', () => {
    const r = buildMealsPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      foodPreferences: { questions: MINIMAL_PREFS_QS, answers: MINIMAL_PREFS_ANS },
      phase: 2,
    })
    expect(r.systemPrompt).toMatch(/Phase-aware nutrition/i)
    expect(r.userMessage).toContain('Current roadmap phase: 2')
  })
})

describe('mealsTool', () => {
  it('has valid tool shape with weeks length 2 and grocery list surface', () => {
    assertToolShape(mealsTool)
    const schema = mealsTool.input_schema as {
      required: string[]
      properties: { weeks: { minItems: number; maxItems: number }; grocery_list: unknown }
    }
    expect(schema.required).toContain('weeks')
    expect(schema.required).toContain('grocery_list')
    expect(schema.properties.weeks.minItems).toBe(2)
    expect(schema.properties.weeks.maxItems).toBe(2)
  })
})

// ── Adjust ──────────────────────────────────────────────────────────────────

describe('buildAdjustPrompt', () => {
  it('returns non-empty prompt parts', () => {
    const r = buildAdjustPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      roadmap: MINIMAL_ROADMAP,
      priorPlan: MINIMAL_WORKOUT,
      logs: MINIMAL_LOGS,
      adherence: MINIMAL_ADHERENCE,
      nextPhase: 2,
      nextBlockNumber: 2,
    })
    expect(r.systemPrompt.length).toBeGreaterThan(0)
    expect(r.userMessage.length).toBeGreaterThan(0)
  })

  it('carries the $150/hour coach voice', () => {
    const r = buildAdjustPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      roadmap: MINIMAL_ROADMAP,
      priorPlan: MINIMAL_WORKOUT,
      logs: MINIMAL_LOGS,
      adherence: MINIMAL_ADHERENCE,
      nextPhase: 2,
      nextBlockNumber: 2,
    })
    assertVoice(r.systemPrompt)
  })

  it('forces block_number ≥ 2 and threads phase_ref through', () => {
    const r = buildAdjustPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      roadmap: MINIMAL_ROADMAP,
      priorPlan: MINIMAL_WORKOUT,
      logs: MINIMAL_LOGS,
      adherence: MINIMAL_ADHERENCE,
      nextPhase: 3,
      nextBlockNumber: 5,
    })
    expect(r.userMessage).toContain('block_number = 5')
    expect(r.userMessage).toContain('phase_ref = 3')
  })

  it('spells out the full adjustment ladder', () => {
    const r = buildAdjustPrompt({
      intake: MINIMAL_INTAKE,
      baseline: MINIMAL_BASELINE,
      roadmap: MINIMAL_ROADMAP,
      priorPlan: MINIMAL_WORKOUT,
      logs: MINIMAL_LOGS,
      adherence: MINIMAL_ADHERENCE,
      nextPhase: 2,
      nextBlockNumber: 2,
    })
    expect(r.systemPrompt).toMatch(/RPE ≤ 7/)
    expect(r.systemPrompt).toMatch(/deload/i)
    expect(r.systemPrompt).toMatch(/accelerate/i)
    expect(r.systemPrompt).toMatch(/_alt/)
  })
})
