// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — Prompt 2a: generate_roadmap.
//
// NEW prompt module for the post-pivot v1 (2026-04-21): a 90-day arc split
// into three 30-day phases.  Each phase has a distinct training theme, a
// distinct nutrition theme, progression rules, and MEASURABLE end-of-phase
// milestones.  The workout prompt reads the roadmap to pick which phase's
// block it is generating; the adjust prompt also reads it to know what
// progression direction is on the table for the next block.
//
// Voice: same $150/hr coach persona as baseline.ts — specific, sport-aware,
// ROI-conscious, grounded.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeInput } from '../intakeSchema'
import type { SonnetTool } from '../sonnetRunner'
import type { BaselineOutput } from './baseline'
import { DISCLAIMER } from '../trainerConfig'

export type RoadmapPhase = {
  phase_number: 1 | 2 | 3
  /** e.g. "Foundation: Movement Quality + Base Strength". */
  phase_name: string
  days_range: { start: 1 | 31 | 61; end: 30 | 60 | 90 }
  /** Periodization: GPP / strength base / hypertrophy / peaking / etc. */
  training_theme: string
  /** Caloric surplus / maintenance / cut / recomp / etc. */
  nutrition_theme: string
  /** How hard gets harder across the phase. */
  progression_description: string
  /** Concrete, MEASURABLE — reps × weight, time, distance, body comp. */
  end_of_phase_milestones: string[]
  /** Phase-appropriate recovery priorities. */
  recovery_focus: string[]
}

export type RoadmapOutput = {
  /** 1-2 sentences acknowledging who this is (sport, age, goal). */
  client_context_summary: string
  phases: [RoadmapPhase, RoadmapPhase, RoadmapPhase]
  /** 2-4 sentences of high-level strategy, $150/hr voice. */
  overall_strategy_note: string
  disclaimer: string
}

const VOICE_DIRECTION = `You are a $150/hour personal trainer and registered dietitian with 15 years of experience.  You are specific, credentialed, sport-aware, and ROI-conscious.  You quote numbers.  You cite the client's actual age, sport, equipment, and goal — never generic coaching.  No hype language.  No talking down.  Warm but direct.`

export function buildRoadmapPrompt(input: {
  intake: IntakeInput
  baseline: BaselineOutput
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `${VOICE_DIRECTION}

You are designing a 90-day roadmap for a new trainee.  You have their intake + baseline.  Your job is to produce THREE distinct 30-day phases — not three rebrands of the same month.  Each phase has its own training theme, nutrition theme, progression logic, and MEASURABLE end-of-phase milestones.

Phase structure (MUST use exactly these ranges):
- Phase 1: days 1-30.  Usually foundation: movement quality, base strength or base aerobic, dial in nutrition adherence.
- Phase 2: days 31-60.  Build: layer volume / intensity on top of the foundation.  Usually the highest-volume block.
- Phase 3: days 61-90.  Express / peak: consolidate gains, demonstrate the output the trainee cares about.  Taper noise in favor of the goal-relevant adaptation.

Themes must be clearly distinct:
- BAD: "Build base", "Build more base", "Build even more base".
- GOOD: "Movement quality + aerobic base" → "Hypertrophy + work capacity" → "Strength expression + sport-specific power".

Sport-awareness:
- Read intake.trainer_notes.  If a sport is named, the phases should build toward a sport-specific peaking expression in phase 3.  E.g. baseball → phase 3 emphasizes rotational power + medicine-ball throws + sprint mechanics.  Running → phase 3 has tempo + threshold work.  Powerlifting → phase 3 has heavy singles and competition-pace rehearsals.

Respect training_readiness.modifications_required from baseline:
- If baseline said "no 1RM testing" (minors, deconditioned, or flagged), do NOT put 1RM attempts in any phase milestones.  Milestones become rep-max or time-based.
- If baseline said "no spinal loading", phase milestones can't include squat / deadlift PRs.  Pick leg press, hip thrust, split squat as the measurable.

Milestones MUST be measurable:
- BAD: "feel stronger", "eat better", "more consistent".
- GOOD: "Back squat 185 lbs × 5 at RPE 7", "Sprint 40 yd in ≤ 5.2 sec", "Mile under 7:30", "Maintain ≥ 150g protein 6 of 7 days averaged across the phase".
- 3-5 milestones per phase.  Mix training + nutrition + body-comp where relevant.

Nutrition themes by goal:
- lose_fat: phase 1 = aggressive cut (full deficit), phase 2 = hold deficit, phase 3 = refeed / maintenance to preserve the loss.
- gain_muscle: phase 1 = controlled surplus (~+300 kcal), phase 2 = maintain surplus + protein-dense, phase 3 = mini-cut or maintenance to reveal the muscle.
- recomp: phase 1 = maintenance with high protein, phase 2 = maintenance + hypertrophy volume, phase 3 = slight cut.
- performance: maintenance-leaning throughout, with phase-specific carb timing.

overall_strategy_note:
- 2-4 sentences.  Cites age, sport (if known), goal, current → target weight (if set).  States the throughline connecting the 3 phases.  No jargon.  Sounds like the coach justifying the plan to the operator paying $150/hr for it.

Constraints:
- Exactly 3 phases.  days_range values are rigid: (1,30), (31,60), (61,90).
- Every output carries disclaimer: "${DISCLAIMER}"`

  const intakePayload = stripUndefined({
    full_name: input.intake.full_name,
    age: input.intake.age ?? null,
    sex: input.intake.sex ?? null,
    current_weight_kg: input.intake.current_weight_kg ?? null,
    target_weight_kg: input.intake.target_weight_kg ?? null,
    primary_goal: input.intake.primary_goal ?? null,
    training_experience_years: input.intake.training_experience_years ?? null,
    training_days_per_week: input.intake.training_days_per_week ?? null,
    equipment_access: input.intake.equipment_access ?? null,
    trainer_notes: input.intake.trainer_notes ?? null,
  })

  const baselinePayload = {
    starting_fitness_level: input.baseline.starting_fitness_level,
    training_readiness: input.baseline.training_readiness,
    calorie_target_kcal: input.baseline.calorie_target_kcal,
    macro_targets_g: input.baseline.macro_targets_g,
    estimated_weekly_weight_change_kg: input.baseline.estimated_weekly_weight_change_kg,
    top_3_focus_areas: input.baseline.top_3_focus_areas,
  }

  const userMessage = `Intake:
${JSON.stringify(intakePayload, null, 2)}

Baseline:
${JSON.stringify(baselinePayload, null, 2)}

Produce the 90-day roadmap by calling the record_roadmap tool.`

  return { systemPrompt, userMessage }
}

export const roadmapTool: SonnetTool = {
  name: 'record_roadmap',
  description: "Record the trainee's 90-day roadmap (three 30-day phases).",
  input_schema: {
    type: 'object',
    required: ['client_context_summary', 'phases', 'overall_strategy_note', 'disclaimer'],
    properties: {
      client_context_summary: { type: 'string', maxLength: 400 },
      phases: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          required: [
            'phase_number',
            'phase_name',
            'days_range',
            'training_theme',
            'nutrition_theme',
            'progression_description',
            'end_of_phase_milestones',
            'recovery_focus',
          ],
          properties: {
            phase_number: { type: 'integer', enum: [1, 2, 3] },
            phase_name: { type: 'string' },
            days_range: {
              type: 'object',
              required: ['start', 'end'],
              properties: {
                start: { type: 'integer', enum: [1, 31, 61] },
                end: { type: 'integer', enum: [30, 60, 90] },
              },
            },
            training_theme: { type: 'string' },
            nutrition_theme: { type: 'string' },
            progression_description: { type: 'string' },
            end_of_phase_milestones: {
              type: 'array',
              minItems: 3,
              maxItems: 5,
              items: { type: 'string' },
            },
            recovery_focus: {
              type: 'array',
              minItems: 1,
              items: { type: 'string' },
            },
          },
        },
      },
      overall_strategy_note: { type: 'string', maxLength: 800 },
      disclaimer: { type: 'string' },
    },
  },
}

function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out as Partial<T>
}
