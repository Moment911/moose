# Prompt 4 — generate_meal_plan

**Feature tag:** `trainer_meals`
**Model:** `claude-sonnet-4-5-20250929`
**Invoked:** Fourth call in the chain. Runs AFTER the trainee submits answers to prompt 3's questions. Produces a 2-week menu + consolidated grocery list in one call.

## Purpose

Generate a 2-week meal plan that hits the baseline's calorie + macro targets, respects hard constraints (dietary preference, allergies, budget, meals/day), honors soft preferences from prompt 3 (variety, cook time, batch prep, specific foods, food-stress tolerance), and produces an aisle-organized grocery list with cost estimate. This is the longest, most token-heavy prompt in the chain.

## System prompt

```
{{SHARED_VOICE_DIRECTION}}

You are designing a 2-week meal plan for a trainee. You have their intake, baseline
(calorie + macro targets), and their answers to a food-preferences check-in. Your job
is to produce a menu the person will actually eat, that hits their macro targets, and
ships with a consolidated grocery list.

Design principles:
1. Hit the baseline daily calorie target within ±7% averaged across the 2 weeks — not
   every single day. Natural variance is more sustainable than rigid daily targets.
2. Hit macro targets within ±10% daily average; protein is the strictest (don't underhit).
3. Honor variety preference strictly:
   - "repeat same meals all week" → week 1 has ~3 recipes cycled; week 2 different 3.
   - "some variety mid-week" → 4-5 recipes per week with deliberate repetition.
   - "totally different every day" → 7+ recipes per week, lean on meal-prep strategies.
4. Honor cook-time tolerance strictly. If trainee said "10 min/day", every recipe is ≤10 min
   active time OR explicitly marked "batch prep Sun" with zero weekday cook time.
5. Batch-prep strategy: if trainee said "yes one big prep day," design around 1-2 weekly
   cook sessions; note which dishes are prep-day and which are daily.
6. Leftover strategy: when leftover_tolerance is high, dinner auto-portions into tomorrow's
   lunch. Mark it in the leftover_strategy field.
7. Grocery list aggregates across the whole 2 weeks, organized by aisle (Produce / Meat &
   Seafood / Dairy / Pantry / Frozen / Other). Each item shows total amount + which recipes
   use it.
8. Estimated grocery cost: use regional-average US grocery prices (the trainee can be
   anywhere, but budget calibration needs a reasonable baseline). If the estimate exceeds
   grocery_budget_usd_per_week × 2, redesign with cheaper swaps (more eggs, legumes, bulk
   grains; less salmon, nuts, berries) and note the swap in bulk_prep_notes.
9. Allergies are HARD EXCLUSIONS. If allergies mention an ingredient family (e.g. "tree
   nuts"), no tree nuts appear anywhere — not even as garnish.
10. dietary_preference is a hard constraint. Vegan = no animal products anywhere (including
    honey, gelatin, dairy-based whey). Keto = <50g carb/day average.
11. Food-stress signal from prompt 3 changes your structure. High stress (4-5) → fewer
    recipes, more repetition, more "just heat and eat." Low stress (1-2) → more variety,
    more prep-intensive flavor builds.

Voice:
- Recipe names sound like food, not like spreadsheets. "Sheet-pan lemon chicken with
  broccoli" not "Protein_meal_3."
- instructions_short is 1-3 sentences, real cooking — not a full Blue-Apron script.
- bulk_prep_notes are practical: "Cook the whole batch of quinoa Sunday, portion into
  4 containers, reheat with a splash of water."
```

## Input contract

```ts
type MealPlanInput = {
  intake: { /* ... */ }
  baseline: { /* record_baseline args — reads calorie_target_kcal + macro_targets_g */ }
  food_preferences: {
    questions: Array<{ question_id: string, question_text: string, ... }>
    answers: Array<{ question_id: string, question_text: string, answer: string | string[] | number }>
  }
}
```

## Tool-use schema

```json
{
  "name": "record_meal_plan",
  "description": "Record the trainee's 2-week meal plan + grocery list.",
  "input_schema": {
    "type": "object",
    "required": [
      "plan_name", "calorie_daily_target_kcal", "macro_daily_targets_g",
      "weeks", "grocery_list", "disclaimer"
    ],
    "properties": {
      "plan_name": { "type": "string" },
      "calorie_daily_target_kcal": { "type": "integer" },
      "macro_daily_targets_g": {
        "type": "object",
        "required": ["protein_g", "fat_g", "carb_g"],
        "properties": {
          "protein_g": { "type": "integer" },
          "fat_g": { "type": "integer" },
          "carb_g": { "type": "integer" }
        }
      },
      "weeks": {
        "type": "array",
        "minItems": 2,
        "maxItems": 2,
        "items": {
          "type": "object",
          "required": ["week_number", "days"],
          "properties": {
            "week_number": { "type": "integer", "enum": [1, 2] },
            "days": {
              "type": "array",
              "minItems": 7,
              "maxItems": 7,
              "items": {
                "type": "object",
                "required": ["day_number", "day_label", "meals", "daily_totals"],
                "properties": {
                  "day_number": { "type": "integer", "minimum": 1, "maximum": 14 },
                  "day_label": {
                    "type": "string",
                    "enum": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                  },
                  "meals": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": [
                        "meal_slot", "recipe_name", "serves", "prep_time_min",
                        "cook_time_min", "ingredients", "instructions_short",
                        "macros_per_serving"
                      ],
                      "properties": {
                        "meal_slot": {
                          "type": "string",
                          "enum": ["breakfast", "lunch", "dinner", "snack_1", "snack_2"]
                        },
                        "recipe_name": { "type": "string" },
                        "serves": { "type": "integer", "minimum": 1 },
                        "prep_time_min": { "type": "integer" },
                        "cook_time_min": { "type": "integer" },
                        "ingredients": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "required": ["item", "amount", "unit"],
                            "properties": {
                              "item": { "type": "string" },
                              "amount": { "type": "number" },
                              "unit": { "type": "string" }
                            }
                          }
                        },
                        "instructions_short": { "type": "string" },
                        "macros_per_serving": {
                          "type": "object",
                          "required": ["kcal", "protein_g", "fat_g", "carb_g"],
                          "properties": {
                            "kcal": { "type": "integer" },
                            "protein_g": { "type": "integer" },
                            "fat_g": { "type": "integer" },
                            "carb_g": { "type": "integer" }
                          }
                        },
                        "leftover_strategy": { "type": ["string", "null"] }
                      }
                    }
                  },
                  "daily_totals": {
                    "type": "object",
                    "required": ["kcal", "protein_g", "fat_g", "carb_g"],
                    "properties": {
                      "kcal": { "type": "integer" },
                      "protein_g": { "type": "integer" },
                      "fat_g": { "type": "integer" },
                      "carb_g": { "type": "integer" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "grocery_list": {
        "type": "object",
        "required": ["organized_by_aisle", "estimated_total_usd", "bulk_prep_notes"],
        "properties": {
          "organized_by_aisle": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["aisle", "items"],
              "properties": {
                "aisle": {
                  "type": "string",
                  "enum": [
                    "Produce", "Meat & Seafood", "Dairy", "Pantry",
                    "Frozen", "Bakery", "Other"
                  ]
                },
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["item", "total_amount", "unit", "used_in"],
                    "properties": {
                      "item": { "type": "string" },
                      "total_amount": { "type": "number" },
                      "unit": { "type": "string" },
                      "used_in": {
                        "type": "array",
                        "items": { "type": "string" }
                      }
                    }
                  }
                }
              }
            }
          },
          "estimated_total_usd": { "type": "number" },
          "bulk_prep_notes": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      },
      "disclaimer": { "type": "string" }
    }
  }
}
```

## Guardrails specific to this prompt

- `calorie_daily_target_kcal` MUST equal baseline's `calorie_target_kcal` exactly — this is the contract echo-back, not a recalc.
- Average `daily_totals.kcal` across 14 days must be within ±7% of target; if the returned JSON violates, Phase 2 executor REJECTS and retries once with a reinforcement ("review your day totals — day X was Y% off target").
- `meals[*].meal_slot` count must match `intake.meals_per_day` — if trainee said 4 meals/day, every day has exactly 4 meals (breakfast, lunch, dinner, snack_1) or equivalent.
- Grocery list `used_in` array must reference recipe_name values that exist somewhere in the 14-day menu. Orphan items = parse fail.
- If `estimated_total_usd` > `grocery_budget_usd_per_week * 2 * 1.1`, the plan violated the budget — reject + retry once.

## Phase 2 executor notes

- Persist `meal_plan` + `grocery_list` to `koto_fitness_plans.meal_plan` and `koto_fitness_plans.grocery_list` (separate jsonb columns per Plan 01 schema).
- Log to `koto_token_usage` with feature=`trainer_meals`. This is the costliest call in the chain (~8k output tokens); budget guard must reserve headroom.
- One retry allowed on macro or budget violation. Second failure → surface to operator with "Plan exceeded budget / missed macros — adjust intake prefs or override."
- Consider using `max_tokens: 16000` on this call — the output is large.
