# Prompt 2 — generate_workout_plan

**Feature tag:** `trainer_workout`
**Model:** `claude-sonnet-4-5-20250929`
**Invoked:** Second call in the chain, after `generate_baseline` returns `ok_to_train: true`.

## Purpose

Produce a 2-week trackable strength + conditioning program tailored to the trainee's goal, experience, equipment, time budget, and readiness modifications. The output schema MUST make every set loggable — exercise slug, target reps, target weight, RPE — so prompt 5 (`adjust_from_progress`) can reason over actual-vs-target deltas.

## System prompt

```
{{SHARED_VOICE_DIRECTION}}

You are designing a 2-week training block for a trainee. You have their intake + baseline
assessment. Your job is to produce a tracked program where every prescription is logged
and every next-block decision can be made from logged numbers.

Design principles:
1. Match their training_days_per_week exactly. If they said 3 days, make 3 sessions per week.
   Do not overload — unused capacity is better than undone sessions.
2. Match equipment_access strictly. full_gym gets barbell lifts; home_gym dumbbell/adjustable;
   bands gets resistance-band primaries; none gets bodyweight progressions.
3. Periodization for 2 weeks: week 1 introduces movements at moderate RPE (7), week 2 adds
   either a set, a rep, or 2.5% load per exercise based on experience level. Beginners
   almost always get +rep progression; intermediate/advanced get +load.
4. Warmup 5-8 min per session — name specific movements, not generic "warmup."
5. Main lift → accessory → conditioning (optional, based on goal). Mobility cooldown 3-5 min.
6. For every exercise: stable exercise_id slug (e.g. "barbell_back_squat", "db_bench_press")
   that stays consistent across weeks so logged data matches. Human name for display.
7. Set-by-set prescription: sets, target_reps (range or exact), target_weight_kg (null for
   first-time lifts — write "find a working weight that leaves 2-3 reps in reserve"),
   rest_seconds, progression_rule (text that prompt 5 will parse next block), short
   coaching cue.
8. Respect training_readiness.modifications_required from baseline — e.g. "no spinal
   loading" → no back squats / deadlifts; substitute leg press + hip thrust.
9. If performance goal is specified (e.g. "5k PR"), bias conditioning toward that.
10. Every session carries an estimated duration in minutes so the trainee knows the time cost.

Voice:
- The coaching cue is ONE sentence, specific to that exercise, not generic. "Drive knees out
  on the way up" is good; "keep good form" is not.
- progression_rule is written in the second person, addressed to the trainee — a real rule
  they'd follow. e.g. "If you complete all 3 sets at 10 reps with RPE ≤ 7, add 2.5 kg next
  week; otherwise repeat." Prompt 5 parses this.

Constraints:
- Max 5 exercises per session. Anything beyond that is noise.
- Rest seconds are realistic: 2-3 min between heavy compound sets, 60-90 sec between
  accessories, 30-60 sec for conditioning intervals.
- Never prescribe max-effort (1RM) attempts in a first block.
- If trainee has < 6 months experience, no barbell deadlifts from the floor — use trap bar
  or rack pulls.
```

## Input contract

```ts
type WorkoutPlanInput = {
  intake: { /* same as baseline input */ }
  baseline: { /* full record_baseline tool_use args */ }
}
```

## Tool-use schema

```json
{
  "name": "record_workout_plan",
  "description": "Record the trainee's 2-week workout program.",
  "input_schema": {
    "type": "object",
    "required": ["program_name", "block_number", "weeks", "disclaimer"],
    "properties": {
      "program_name": { "type": "string" },
      "block_number": { "type": "integer", "minimum": 1 },
      "weeks": {
        "type": "array",
        "minItems": 2,
        "maxItems": 2,
        "items": {
          "type": "object",
          "required": ["week_number", "sessions"],
          "properties": {
            "week_number": { "type": "integer", "enum": [1, 2] },
            "sessions": {
              "type": "array",
              "items": {
                "type": "object",
                "required": [
                  "day_label", "day_number", "session_name",
                  "estimated_duration_min", "warmup", "blocks", "cooldown"
                ],
                "properties": {
                  "day_label": {
                    "type": "string",
                    "enum": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                  },
                  "day_number": { "type": "integer", "minimum": 1, "maximum": 14 },
                  "session_name": { "type": "string" },
                  "estimated_duration_min": { "type": "integer" },
                  "warmup": { "type": "array", "items": { "type": "string" } },
                  "blocks": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": ["block_type", "exercises"],
                      "properties": {
                        "block_type": {
                          "type": "string",
                          "enum": ["main_lift", "accessory", "conditioning", "mobility"]
                        },
                        "exercises": {
                          "type": "array",
                          "maxItems": 5,
                          "items": {
                            "type": "object",
                            "required": [
                              "exercise_id", "name", "sets", "target_reps",
                              "target_weight_kg_or_cue", "rest_seconds",
                              "progression_rule", "coaching_cue"
                            ],
                            "properties": {
                              "exercise_id": { "type": "string" },
                              "name": { "type": "string" },
                              "sets": { "type": "integer", "minimum": 1, "maximum": 6 },
                              "target_reps": { "type": "string" },
                              "target_weight_kg_or_cue": { "type": "string" },
                              "rest_seconds": { "type": "integer" },
                              "progression_rule": { "type": "string" },
                              "coaching_cue": { "type": "string" }
                            }
                          }
                        }
                      }
                    }
                  },
                  "cooldown": { "type": "array", "items": { "type": "string" } }
                }
              }
            }
          }
        }
      },
      "disclaimer": { "type": "string" }
    }
  }
}
```

## Guardrails specific to this prompt

- `target_weight_kg_or_cue` is a free string because first-time prescriptions can be "find a weight that leaves 2-3 reps in reserve" or "bodyweight" — stricter typing fails these real cases. Server-side, parse for a numeric kg; fall back to cue string.
- `exercise_id` MUST be stable lowercase snake_case. The Phase 2 executor will validate that the same movement in week 1 and week 2 uses the identical exercise_id so logs join cleanly.
- `progression_rule` should reference measurable criteria (reps, weight, RPE). Prompt 5 parses this — vague rules ("try to do more") break the adjust loop.

## Phase 2 executor notes

- Persist to `koto_fitness_plans.workout_plan`.
- Log to `koto_token_usage` with feature=`trainer_workout`.
- Validate `weeks[*].sessions[*].exercise_id` stability across weeks server-side; if mismatch, retry prompt once with a "ensure exercise_id matches between week 1 and week 2 for progressed lifts" reinforcement.
- When trainee logs sets (via `/api/trainer/workout-logs`), `exercise_id` is the join key — it must match what's in the plan.
