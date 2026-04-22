# Prompt 1 — generate_baseline

**Feature tag:** `trainer_baseline`
**Model:** `claude-sonnet-4-5-20250929`
**Invoked:** First call in Phase 2's `/api/trainer/generate` chain; also re-runs if intake is materially edited.

## Purpose

Turn a raw intake into a grounded baseline: calorie target, macro split, estimated body composition signals, training-readiness verdict, and an honest timeline for the stated goal. Every downstream prompt in the chain reads this baseline, so it must be numerically correct and honest about edge cases.

## System prompt

```
{{SHARED_VOICE_DIRECTION}}

You are producing a baseline assessment for a new trainee. You have their intake form data.
Your job is to compute calorie + macro targets, estimate their starting fitness level, flag
any medical red lines, and give an honest timeline for the stated goal.

Approach:
1. Compute BMR using Mifflin-St Jeor (for sex not recorded, use the average of male/female
   formulas and flag it in coach_summary).
2. Apply activity factor from occupation_activity: sedentary=1.2, light=1.375,
   moderate=1.55, heavy=1.725. Training days add ~150-300 kcal on top depending on intensity.
3. Apply goal-based delta: lose_fat = -400 to -600 kcal/day, gain_muscle = +200 to +400,
   recomp = -100 to +100, maintain = 0, performance = 0 to +300.
4. Macros: protein 1.6-2.2 g/kg of current weight (higher for lose_fat, lower for maintain);
   fat 0.6-1.0 g/kg; carbs fill the rest.
5. Training readiness: if medical_flags, injuries, or pregnancy_or_nursing flag anything
   serious → ok_to_train=false. Serious includes cardiac, hypertension, recent surgery,
   active eating disorder, pregnancy (any trimester — defer to OB), active acute injury.
6. Timeline: -1.0 kg/week is the fastest safe loss, +0.5 kg/week is the fastest realistic
   gain. If target implies faster, recalibrate and explain.
7. Starting fitness level: deconditioned (0 training days/week, heavy injuries, or
   sedentary+40+yo), beginner (0-1 years experience, 0-3 days/week), intermediate
   (1-3 years, 3-5 days/week), advanced (3+ years, 4-6 days/week with consistent log).

Constraints:
- Never diagnose. If flagging, say "this pattern typically warrants physician sign-off before
  starting a program" — never "you have X condition."
- If age < 18 or > 70, flag for conservative programming regardless of other inputs.
- coach_summary is 2-3 sentences, human-readable, for the agency operator to read. Plain
  English. State one strength, one concern, and the headline target. No jargon.
```

## Input contract

```ts
type BaselineInput = {
  intake: {
    full_name: string
    age: number | null
    sex: string | null
    height_cm: number | null
    current_weight_kg: number
    target_weight_kg: number | null
    primary_goal: 'lose_fat' | 'gain_muscle' | 'maintain' | 'performance' | 'recomp' | null
    training_experience_years: number | null
    training_days_per_week: number | null
    equipment_access: string | null
    medical_flags: string | null
    injuries: string | null
    pregnancy_or_nursing: boolean | null
    dietary_preference: string | null
    allergies: string | null
    sleep_hours_avg: number | null
    stress_level: number | null
    occupation_activity: string | null
  }
}
```

## Tool-use schema

```json
{
  "name": "record_baseline",
  "description": "Record the trainee's baseline assessment.",
  "input_schema": {
    "type": "object",
    "required": [
      "body_composition", "starting_fitness_level", "training_readiness",
      "calorie_target_kcal", "macro_targets_g", "estimated_weekly_weight_change_kg",
      "adjusted_target_weight_timeline_weeks", "coach_summary", "disclaimer"
    ],
    "properties": {
      "body_composition": {
        "type": "object",
        "required": ["bmi_or_null", "category", "notes"],
        "properties": {
          "bmi_or_null": { "type": ["number", "null"] },
          "category": {
            "type": "string",
            "enum": ["underweight", "normal", "overweight", "obese", "unknown"]
          },
          "notes": { "type": "string" }
        }
      },
      "starting_fitness_level": {
        "type": "string",
        "enum": ["deconditioned", "beginner", "intermediate", "advanced"]
      },
      "training_readiness": {
        "type": "object",
        "required": ["ok_to_train", "red_flags", "modifications_required"],
        "properties": {
          "ok_to_train": { "type": "boolean" },
          "red_flags": { "type": "array", "items": { "type": "string" } },
          "modifications_required": { "type": "array", "items": { "type": "string" } }
        }
      },
      "calorie_target_kcal": { "type": "integer" },
      "macro_targets_g": {
        "type": "object",
        "required": ["protein_g", "fat_g", "carb_g"],
        "properties": {
          "protein_g": { "type": "integer" },
          "fat_g": { "type": "integer" },
          "carb_g": { "type": "integer" }
        }
      },
      "estimated_weekly_weight_change_kg": { "type": "number" },
      "adjusted_target_weight_timeline_weeks": { "type": ["integer", "null"] },
      "coach_summary": { "type": "string", "maxLength": 500 },
      "disclaimer": { "type": "string" }
    }
  }
}
```

## Guardrails specific to this prompt

- `calorie_target_kcal` must be ≥ 1200 for women, ≥ 1500 for men (biological floor); if the math suggests lower, raise floor + extend timeline + note in coach_summary.
- Protein grams must be ≥ 0.8 g/kg body weight even on the most aggressive deficit.
- If `primary_goal=null` and `target_weight_kg=null` → set goal to `maintain` and note in coach_summary that no goal was provided.
- Category `unknown` is allowed when height_cm is null (can't compute BMI without it).

## Phase 2 executor notes

- Persist entire tool_use args to `koto_fitness_plans.baseline` jsonb.
- Log to `koto_token_usage` with feature=`trainer_baseline`.
- If `training_readiness.ok_to_train === false`, SHORT-CIRCUIT the chain — do not invoke prompts 2-4. Surface the `red_flags` to the operator with a "contact trainee for physician sign-off before continuing" message.
- Block budget check: before invoking, run the Phase 8 `checkBudget` pattern against the per-agency daily cap with `feature='trainer_baseline'` estimated cost.
