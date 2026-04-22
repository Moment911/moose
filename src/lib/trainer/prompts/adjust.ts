// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — Prompt 5: adjust_from_progress.
//
// Reads actual logged sets + reps + RPE from the prior block against what was
// prescribed, reasons per-exercise deltas, and generates the NEXT 2-week
// workout plan with precise adjustments populated in adjustments_made[] +
// adherence_note on workoutTool.
//
// Reuses workoutTool from prompts/workout.ts — the schema already carries
// optional adjustments_made + adherence_note.  This module only exports the
// prompt builder + the input types (WorkoutLog, AdherenceSummary).
//
// Ported from
// .planning/phases/trainer-01-intake-and-dispatcher/prompts/05-adjust-from-progress.md
// with voice updated + phase/roadmap awareness added.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeInput } from '../intakeSchema'
import type { BaselineOutput } from './baseline'
import type { RoadmapOutput } from './roadmap'
import type { WorkoutOutput } from './workout'
import { COACH_VOICE, DISCLAIMER } from '../trainerConfig'

export type WorkoutLog = {
  /** 1-14 within prior block. */
  session_day_number: number
  /** Joins to prior_plan.weeks[*].sessions[*].blocks[*].exercises[*].exercise_id. */
  exercise_id: string
  exercise_name: string
  set_number: number
  actual_weight_kg: number | null
  actual_reps: number
  rpe: number | null
  notes: string | null
  /** ISO timestamp. */
  session_logged_at: string
}

export type AdherenceSummary = {
  scheduled_sessions: number
  logged_sessions: number
  /** 0-100. */
  adherence_pct: number
}

const VOICE_DIRECTION = `${COACH_VOICE}  Adjust-specific: reason from logged numbers, not vibes — including when it's time to say "you missed too many sessions, we're holding volume this block instead of progressing."`

export function buildAdjustPrompt(input: {
  intake: IntakeInput
  baseline: BaselineOutput
  roadmap: RoadmapOutput
  priorPlan: WorkoutOutput
  logs: WorkoutLog[]
  adherence: AdherenceSummary
  nextPhase: 1 | 2 | 3
  nextBlockNumber: number
}): { systemPrompt: string; userMessage: string } {
  const nextPhase = input.roadmap.phases.find(p => p.phase_number === input.nextPhase) ?? input.roadmap.phases[0]

  const systemPrompt = `${VOICE_DIRECTION}

You are designing the NEXT 2-week training block for a trainee, based on what they actually did in the prior block.  You have their intake, baseline, full roadmap, prior workout plan, the full set-by-set log, and adherence summary.

Adjustment logic (apply per exercise):

1. Compare prescribed (target_weight_kg_or_cue, target_reps) against logged (actual_weight_kg, actual_reps, rpe) across all sets + both sessions the exercise appeared in.

2. Per-exercise rules:
   - Hit or beat all target reps at prescribed load across 2+ sessions AND RPE ≤ 7
     → apply the prior progression_rule.  change_type = progress_load OR progress_reps OR progress_sets.
   - Hit all target reps at prescribed load, RPE 7-8
     → apply the rule at HALF intensity (+1.25 kg instead of +2.5, or +1 rep instead of +2).  change_type = progress_load OR progress_reps.
   - Missed target reps by > 2 on any set, OR RPE ≥ 9 on first working set
     → deload 5% load OR drop 1 set while holding load.  change_type = deload_load OR drop_set.
   - Consistently RPE ≤ 6 on all sets across both sessions
     → accelerate: apply the rule TWICE.  change_type = accelerate_progression.
   - Log missing entirely for 2+ scheduled sessions of this exercise
     → hold same load + rep scheme.  change_type = hold_no_data.
   - 2+ pain notes for a specific exercise
     → substitute with a safer analog (e.g. barbell back squat → goblet squat, bench press → floor press).  NEW exercise_id gets a "_alt" suffix (e.g. "goblet_squat_alt") so the logs table keeps prior exercise_id namespace clean.  change_type = substitute.

3. NEVER progress more than ONE mechanism per exercise per block (load OR reps, not both).  Compound progression is unsustainable.

4. Adherence modifier:
   - adherence_pct ≥ 80% → proceed with per-exercise rules above.
   - adherence_pct 60-79% → hold total volume; progress only where the log is clear.
   - adherence_pct 40-59% → hold load + rep scheme across the board.  Flag it in adherence_note.
   - adherence_pct < 40% → DEGRADE: do not aggressively redesign.  Hold everything, write an honest adherence_note that names the gap.  The fix for missed sessions is not a new plan — it's a conversation.

5. Volume progression across block: if adherence ≥ 80% add ~10% volume over prior block (more sets per muscle group, or one extra accessory).  60-80% hold volume.  < 60% reduce 20%.

6. exercise_id continuity:
   - When the same movement continues, preserve the EXACT exercise_id.  Logs across blocks join on this.
   - Substitutions use the "_alt" suffix so the new exercise_id does not pollute the prior slug's history.

7. Roadmap awareness: the next block belongs to phase ${input.nextPhase}.  Programming choices should fit THAT phase's training theme, not just progress the prior phase's template.  E.g. moving from phase 1 foundation to phase 2 build means adding volume and layering intensity — not just +2.5 kg on every lift.

adherence_note rules:
- ONE honest sentence written to the trainee.
- If adherence was strong, name it: "You logged 9 of 10 sessions — your progress here is earned."
- If adherence was weak, be direct without lecturing: "You logged 3 of 10 sessions; I'm holding load this block until we see more reps on the page."
- No saccharine encouragement ("great job!").  No shame.

adjustments_made[] rules:
- One entry per exercise that materially changed.  Not every exercise — only the changed ones.
- Every exercise_id in adjustments_made MUST appear in priorPlan.weeks[*].sessions[*].blocks[*].exercises.
- rationale is ONE sentence, specific, grounded in a number ("hit 3×10 at RPE 6 both sessions — accelerating +5 kg" > "you did well").

Hard constraints:
- block_number MUST be ${input.nextBlockNumber} (which is priorPlan.block_number + 1 and ≥ 2).
- phase_ref MUST be ${input.nextPhase}.
- weeks array has exactly 2 entries, week_number 1 and 2.
- Every exercise still ships full how-to metadata: performance_cues (3-6), common_mistakes (2-4), video_query.
- Every output carries disclaimer: "${DISCLAIMER}"`

  const intakePayload = stripUndefined({
    full_name: input.intake.full_name,
    age: input.intake.age ?? null,
    primary_goal: input.intake.primary_goal ?? null,
    equipment_access: input.intake.equipment_access ?? null,
    injuries: input.intake.injuries ?? null,
    trainer_notes: input.intake.trainer_notes ?? null,
  })

  const baselinePayload = {
    starting_fitness_level: input.baseline.starting_fitness_level,
    training_readiness: input.baseline.training_readiness,
    top_3_focus_areas: input.baseline.top_3_focus_areas,
  }

  const userMessage = `Intake:
${JSON.stringify(intakePayload, null, 2)}

Baseline:
${JSON.stringify(baselinePayload, null, 2)}

Next roadmap phase (phase ${input.nextPhase}):
${JSON.stringify(nextPhase, null, 2)}

Prior plan (block ${input.priorPlan.block_number}):
${JSON.stringify(input.priorPlan, null, 2)}

Workout logs from prior block:
${JSON.stringify(input.logs, null, 2)}

Adherence summary:
${JSON.stringify(input.adherence, null, 2)}

Produce the next 2-week block by calling the record_workout_plan tool.
block_number = ${input.nextBlockNumber}
phase_ref = ${input.nextPhase}
Populate adjustments_made[] with every exercise that materially changed and adherence_note with one honest sentence.`

  return { systemPrompt, userMessage }
}

// Note: the adjust call re-uses workoutTool from prompts/workout.ts.  Import
// workoutTool directly from there — it already carries the
// adjustments_made[] + adherence_note optional fields.

function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out as Partial<T>
}
