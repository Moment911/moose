// ─────────────────────────────────────────────────────────────────────────────
// Trainer — prompts/adjustNL.ts — natural-language plan adjustment.
//
// Sibling of prompts/adjust.ts but driven by a free-text trainee message
// instead of logged workout numbers.  Used by the "What's going on?" box on
// /my-plan: the trainee types something like "shoulder tweaked, can't press
// overhead" or "traveling next week, hotel gym only" and the system rewrites
// the current 2-week block accordingly.
//
// Re-uses workoutTool from prompts/workout.ts (same output shape: weeks[2]
// with sessions + blocks + exercises + adjustments_made + adherence_note).
// adherence_note here becomes the coach's one-sentence response to the
// trainee's message — "Holding load on squats this block; subbing hip thrust
// for the gym-away week" — so the trainee knows what you changed and why.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeInput } from '../intakeSchema'
import type { BaselineOutput } from './baseline'
import type { RoadmapOutput } from './roadmap'
import type { WorkoutOutput } from './workout'
import { COACH_VOICE, DISCLAIMER } from '../trainerConfig'
import { LEGAL_COMPLIANCE_PREAMBLE } from './legalCompliance'

export type AdjustNLScope = 'this_session' | 'rest_of_block' | 'swap_exercise'

export function buildAdjustNLPrompt(input: {
  intake: IntakeInput
  baseline: BaselineOutput
  roadmap: RoadmapOutput
  currentPlan: WorkoutOutput
  message: string
  scope: AdjustNLScope
  sessionDayNumber?: number // when scope = this_session
  exerciseId?: string       // when scope = swap_exercise
  blockNumber: number
  phase: 1 | 2 | 3
}): { systemPrompt: string; userMessage: string } {
  const scopeInstruction = (() => {
    switch (input.scope) {
      case 'this_session':
        return `Scope: ONLY modify the upcoming session (day_number ${input.sessionDayNumber ?? '?'}).  Leave every other session in both weeks untouched.  If an exercise must change, change it for that one session.`
      case 'swap_exercise':
        return `Scope: ONLY substitute the exercise with exercise_id="${input.exerciseId ?? ''}" wherever it appears in the block.  Keep every other prescription identical (same sets, reps, rest, progression rule format).  Pick a substitute that trains the same pattern but respects the constraint in the message.`
      case 'rest_of_block':
      default:
        return `Scope: modify as much of the 2-week block as needed to accommodate the message.  Preserve the periodization logic (week 2 still progresses from week 1 on remaining exercises).`
    }
  })()

  const systemPrompt = `${LEGAL_COMPLIANCE_PREAMBLE}

${COACH_VOICE}

You are adjusting a trainee's current 2-week workout block in response to a specific natural-language message from them.  The message could be about anything: a new injury, travel, schedule change, mood, equipment change, perceived difficulty.  Your job: take the message seriously, decide what changes (if any) are warranted, and rewrite the block accordingly.

Adjustment policy:
1. Read the message literally.  If they say "shoulder tweaked," you remove overhead pressing for this block — no equivocation.  If they say "feeling strong, push me," you accelerate load ~5% on main lifts.  Don't hedge.
2. Respect the original roadmap phase — don't pivot a foundation block into a peaking block just because they said "push me."  Progression stays within phase.
3. Preserve what still works.  Most messages change 1-3 exercises, not the whole block.  Only rewrite fields you actually need to change.
4. ${scopeInstruction}
5. If the message does NOT justify a plan change (e.g. trainee says "thanks!" or describes normal fatigue), return the current plan UNCHANGED with a one-sentence adherence_note explaining why no change was made.  Don't make changes to look busy.

Output:
- weeks: the full 2-week block, with your changes applied.  Every session still has warmup + blocks + cooldown.  Every exercise still has performance_cues + common_mistakes + video_query.
- adjustments_made: array of {exercise_id, change_type, prior_target, new_target, rationale} for every exercise you changed.  Empty array if you chose not to change anything.
- adherence_note: ONE sentence written to the trainee summarizing what you did and why.  Sound like a coach responding to a text, not a policy document.

Constraints:
- block_number stays at ${input.blockNumber}.  phase_ref stays at ${input.phase}.  weeks array MUST contain exactly 2 entries, week_number 1 and 2.
- Never prescribe anything outside the trainee's equipment_access.
- Respect baseline.training_readiness.modifications_required on every change.
- Every output carries disclaimer: "${DISCLAIMER}"`

  const userMessage = `Intake:
${JSON.stringify(stripUndefined({
    full_name: input.intake.full_name,
    age: input.intake.age ?? null,
    sex: input.intake.sex ?? null,
    primary_goal: input.intake.primary_goal ?? null,
    training_days_per_week: input.intake.training_days_per_week ?? null,
    equipment_access: input.intake.equipment_access ?? null,
    injuries: input.intake.injuries ?? null,
    about_you: input.intake.about_you ?? null,
  }), null, 2)}

Baseline (training readiness + focus areas):
${JSON.stringify({
    starting_fitness_level: input.baseline.starting_fitness_level,
    training_readiness: input.baseline.training_readiness,
    top_3_focus_areas: input.baseline.top_3_focus_areas,
  }, null, 2)}

Current roadmap phase (phase ${input.phase}):
${JSON.stringify(input.roadmap.phases.find(p => p.phase_number === input.phase) ?? input.roadmap.phases[0], null, 2)}

Current 2-week block (what you're adjusting):
${JSON.stringify(input.currentPlan, null, 2)}

Trainee's message:
"""
${input.message}
"""

Rewrite the block per the scope rule in the system prompt.  Call record_workout_plan with the adjusted weeks, the adjustments_made array, and a one-sentence adherence_note responding to the message.  block_number = ${input.blockNumber}, phase_ref = ${input.phase}.`

  return { systemPrompt, userMessage }
}

function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out as Partial<T>
}
