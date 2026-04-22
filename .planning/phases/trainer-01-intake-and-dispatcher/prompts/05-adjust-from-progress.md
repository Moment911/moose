# Prompt 5 — adjust_from_progress

**Feature tag:** `trainer_adjust`
**Model:** `claude-sonnet-4-5-20250929`
**Invoked:** On demand after logged workout data accumulates. Typically runs at the end of a 2-week block to produce the next block. Can also run mid-block if trainee is obviously over/under-performing.

## Purpose

Read the actual logged sets + reps + RPE from the prior block against what was prescribed, reason through per-exercise deltas, and generate the NEXT 2-week workout plan with precise adjustments. The meal plan can optionally re-run separately if body-weight trend justifies recalibration — this prompt is workout-focused.

Output matches prompt 2's schema exactly (same tool, but with `block_number` incremented and an `adjustments_made` summary attached).

## System prompt

```
{{SHARED_VOICE_DIRECTION}}

You are designing the next 2-week training block for a trainee based on what they actually
did in the prior block. You have their intake, baseline, prior workout plan, and the full
set-by-set log of what they lifted. Your job is to make precise adjustments grounded in
logged numbers, not vibes.

Adjustment logic:

1. For each exercise, compare prescribed (target_weight, target_reps) against logged
   (actual_weight_kg, actual_reps, rpe) across all sets, both sessions the exercise
   appeared in.

2. Apply these rules per exercise:
   - **Hit or beat all target reps at prescribed load across 2+ sessions, RPE ≤ 7**
     → apply progression_rule from prior plan (usually +2.5 kg or +1 rep).
   - **Hit all target reps at prescribed load, RPE 7-8**
     → apply progression_rule at HALF intensity (e.g. +1.25 kg instead of +2.5, or
     +1 rep instead of +2). Trainee is working but not flying.
   - **Missed target reps by >2 on any set, OR RPE ≥ 9 on first working set**
     → deload 5% load OR drop 1 set while holding load. Trainee is grinding.
   - **Consistently RPE ≤ 6 on all sets across 2 sessions**
     → accelerate progression: apply the rule TWICE (+5 kg or +2 reps). Trainee was
     under-loaded.
   - **Log missing entirely for 2+ scheduled sessions**
     → hold same load + rep scheme, do NOT progress. Missing data ≠ progress signal.
   - **Complete zero log data for a movement**
     → keep the prescription as-is, flag in coach_note that no data was logged.

3. Never progress more than one mechanism per exercise per block (load OR reps, not both).
   Compound progression is unsustainable.

4. If trainee's adherence was poor (< 60% of prescribed sessions logged across the block),
   DO NOT aggressively progress. Hold volume, modestly raise load only where log supports.

5. Movement substitution triggers:
   - 2+ sessions of "pain" notes on a specific exercise → substitute with a safer analog
     (e.g. back squat → goblet squat, bench press → floor press) and flag in coach_note.
   - If trainee logged "couldn't access equipment" → substitute with their confirmed
     equipment_access level.

6. Volume progression across block: weeks 1-2 add ~10% volume over prior block if
   adherence was ≥ 80%. Hold volume if adherence was 60-80%. Reduce volume 20% if < 60%.

7. Preserve exercise_id slugs EXACTLY when the same movement continues across blocks —
   so logs across blocks can still join on exercise_id for trend display.

Write one adjustments_made entry per exercise that materially changed (not every exercise,
just the changed ones). Rationale is one sentence, specific, grounded in a number.
```

## Input contract

```ts
type AdjustFromProgressInput = {
  intake: { /* ... */ }
  baseline: { /* ... */ }
  prior_plan: { /* record_workout_plan args from prior block — contains exercise_id, targets, progression_rule */ }
  logs: Array<{
    session_day_number: number           // 1-14 within prior block
    exercise_id: string                  // joins to prior_plan
    exercise_name: string
    set_number: number
    actual_weight_kg: number | null
    actual_reps: number
    rpe: number | null
    notes: string | null
    session_logged_at: string            // ISO timestamp
  }>
  adherence_summary: {
    scheduled_sessions: number
    logged_sessions: number
    adherence_pct: number                // 0-100
  }
}
```

## Tool-use schema

Uses `record_workout_plan` from prompt 2 PLUS an `adjustments_made` array. Implementation option: a second tool `record_workout_adjustments` that Phase 2 merges with the new plan, OR extend `record_workout_plan` input_schema with an optional `adjustments_made` field. Prefer the extension — simpler chain.

Extended schema (additions to prompt 2's `record_workout_plan`):

```json
{
  "name": "record_workout_plan",
  "input_schema": {
    "type": "object",
    "required": [
      "program_name", "block_number", "weeks", "disclaimer"
    ],
    "properties": {
      "...": "all of prompt 2's properties",
      "block_number": {
        "type": "integer",
        "minimum": 2,
        "description": "Must be > 1 for adjust calls — prompt 2 sets this to 1."
      },
      "adjustments_made": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "exercise_id", "change_type", "prior_target",
            "new_target", "rationale"
          ],
          "properties": {
            "exercise_id": { "type": "string" },
            "change_type": {
              "type": "string",
              "enum": [
                "progress_load", "progress_reps", "progress_sets",
                "deload_load", "deload_reps", "drop_set", "substitute",
                "hold_no_data", "accelerate_progression"
              ]
            },
            "prior_target": {
              "type": "object",
              "properties": {
                "sets": { "type": "integer" },
                "target_reps": { "type": "string" },
                "target_weight_kg_or_cue": { "type": "string" }
              }
            },
            "new_target": {
              "type": "object",
              "properties": {
                "sets": { "type": "integer" },
                "target_reps": { "type": "string" },
                "target_weight_kg_or_cue": { "type": "string" }
              }
            },
            "rationale": { "type": "string", "maxLength": 300 }
          }
        }
      },
      "adherence_note": {
        "type": "string",
        "description": "One-sentence summary of how the prior block went, written to the trainee. Honest, not saccharine."
      }
    }
  }
}
```

## Guardrails specific to this prompt

- `block_number` must be `prior_plan.block_number + 1`.
- Every `adjustments_made[*].exercise_id` MUST appear in `prior_plan.weeks[*].sessions[*].blocks[*].exercises`. Orphan adjustment = parse fail.
- If `adherence_summary.adherence_pct < 40`, the prompt 5 call should DEGRADE — do not aggressively redesign, just hold and flag to operator. The retry instinct is wrong when someone missed most sessions.
- Substitutions should preserve exercise_id namespace with a `_alt` suffix, e.g. `barbell_back_squat` → `goblet_squat_alt`, so historical logs still show the prior slug without polluting the new one.

## Phase 2 executor notes

- Invoked via new `/api/trainer/generate` action `adjust_block` (distinct from `generate_initial`).
- Before invoking, compute `adherence_summary` from `koto_fitness_workout_logs` query (`SELECT session_day_number, COUNT(*) FROM logs WHERE plan_id = :id GROUP BY session_day_number`).
- Persist the new plan as a NEW row in `koto_fitness_plans` (block_number incremented) — never overwrite prior block. This is the historical record the operator + trainee see in the history view.
- Log to `koto_token_usage` with feature=`trainer_adjust`.
- If trainee also needs meal-plan recalibration (weight trend diverges from baseline), invoke prompt 4 with updated baseline as a separate call — this prompt stays workout-only.
- UI surface: agency view shows a "Generate Next Block" button on `/trainer/:traineeId` that's enabled once the prior block is 80% complete by calendar time + adherence ≥ 40%. Surface the `adherence_note` prominently in the generated plan.
