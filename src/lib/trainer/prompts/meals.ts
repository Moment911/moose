// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — Prompt 4: generate_meal_plan.
//
// Largest call in the chain (~8k output tokens).  Produces a 2-week menu that
// hits the baseline calorie + macro targets, respects hard constraints (diet,
// allergies, budget, meals/day), honors soft preferences from the food-prefs
// check-in, and ships with an aisle-organized grocery list + cost estimate.
//
// Phase context:
//   - Phase 1 (foundation) → adherence-weighted, simpler recipes.
//   - Phase 2 (build) → slight surplus if gain_muscle; high-protein volume.
//   - Phase 3 (peak / express) → recomp or refeed depending on goal.
//
// Ported from
// .planning/phases/trainer-01-intake-and-dispatcher/prompts/04-generate-meal-plan.md
// with voice updated + phase awareness added.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeInput } from '../intakeSchema'
import type { SonnetTool } from '../sonnetRunner'
import type { BaselineOutput } from './baseline'
import type { FoodPrefsQuestion, FoodPrefsAnswer } from './foodPrefs'
import { COACH_VOICE, DISCLAIMER } from '../trainerConfig'

export type MealIngredient = { item: string; amount: number; unit: string }

export type Meal = {
  meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack_1' | 'snack_2'
  recipe_name: string
  serves: number
  prep_time_min: number
  cook_time_min: number
  ingredients: MealIngredient[]
  instructions_short: string
  macros_per_serving: { kcal: number; protein_g: number; fat_g: number; carb_g: number }
  leftover_strategy: string | null
}

export type MealDay = {
  day_number: number
  day_label: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  meals: Meal[]
  daily_totals: { kcal: number; protein_g: number; fat_g: number; carb_g: number }
}

export type GroceryAisle =
  | 'Produce'
  | 'Meat & Seafood'
  | 'Dairy'
  | 'Pantry'
  | 'Frozen'
  | 'Bakery'
  | 'Other'

export type GroceryEntry = {
  item: string
  total_amount: number
  unit: string
  used_in: string[]
}

export type MealsOutput = {
  plan_name: string
  calorie_daily_target_kcal: number
  macro_daily_targets_g: { protein_g: number; fat_g: number; carb_g: number }
  weeks: [
    { week_number: 1; days: MealDay[] },
    { week_number: 2; days: MealDay[] },
  ]
  grocery_list: {
    organized_by_aisle: Array<{ aisle: GroceryAisle; items: GroceryEntry[] }>
    estimated_total_usd: number
    bulk_prep_notes: string[]
  }
  disclaimer: string
}

const VOICE_DIRECTION = `${COACH_VOICE}  Nutrition-specific: prize adherence over theoretical optimization — recipes sound like food, not spreadsheets.`

export function buildMealsPrompt(input: {
  intake: IntakeInput
  baseline: BaselineOutput
  foodPreferences: { questions: FoodPrefsQuestion[]; answers: FoodPrefsAnswer[] }
  phase?: 1 | 2 | 3
}): { systemPrompt: string; userMessage: string } {
  const phase = input.phase ?? 1
  const phaseText = describePhaseNutritionLens(phase, input.intake.primary_goal ?? null)

  const systemPrompt = `${VOICE_DIRECTION}

You are designing a 2-week meal plan for a trainee.  You have their intake, baseline, and the answers to a food-preferences check-in.  Your job: a menu the person will actually eat, that hits their macro targets, and ships with a consolidated grocery list.

Design principles:
1. Hit baseline.calorie_target_kcal within ±7% averaged across 14 days — not every single day.  Natural variance is more sustainable than rigid daily identical totals.
2. Hit macro targets within ±10% daily average.  Protein is strictest — don't UNDERHIT protein.
3. Honor variety preference from food prefs:
   - "repeat same meals all week" → ~3 recipes cycled in week 1, different 3 in week 2.
   - "some variety mid-week" → 4-5 recipes per week with deliberate repetition.
   - "totally different every day" → 7+ recipes per week, leaning on meal-prep strategies.
4. Honor cook-time tolerance strictly.  "10 min/day" → every recipe ≤10 min active time OR explicitly marked "batch prep Sun" with zero weekday cook time.
5. Batch-prep strategy: if trainee said "yes one big prep day," design around 1-2 weekly cook sessions; mark prep-day vs daily dishes in bulk_prep_notes.
6. Leftover strategy: when leftover_tolerance is high, dinner auto-portions into tomorrow's lunch — state that in leftover_strategy.
7. Grocery list aggregates across the whole 2 weeks, organized by aisle (Produce / Meat & Seafood / Dairy / Pantry / Frozen / Bakery / Other).  Each item shows total amount + which recipes use it.
8. Estimated grocery cost: use regional-average US prices.  If estimate > grocery_budget_usd_per_week × 2, redesign with cheaper swaps (more eggs, legumes, bulk grains; less salmon, nuts, berries) and note swaps in bulk_prep_notes.

Hard constraints (NEVER violated):
- Allergies are HARD EXCLUSIONS.  If intake mentions "tree nuts," no tree nuts anywhere — not even garnish.
- dietary_preference is non-negotiable.  Vegan = no animal products anywhere (honey, gelatin, dairy-based whey included).  Keto = <50g carb/day average.
- meals[*].meal_slot count must match intake.meals_per_day.  4 meals/day → every day has exactly 4 meals.

Food-stress signal from prefs changes structure:
- High stress (4-5) → fewer recipes, more repetition, more "heat and eat."
- Low stress (1-2) → more variety, more prep-intensive flavor builds.

Phase-aware nutrition:
${phaseText}

Voice:
- Recipe names sound like food.  "Sheet-pan lemon chicken with broccoli" not "Protein_meal_3."
- instructions_short is 1-3 sentences.  Real cooking, not a Blue-Apron script.
- bulk_prep_notes are practical: "Cook the whole batch of quinoa Sunday, portion into 4 containers, reheat with a splash of water."

Constraints:
- calorie_daily_target_kcal MUST equal baseline.calorie_target_kcal exactly — this is the contract echo-back, not a recalc.
- Grocery list used_in array must reference recipe_name values that exist in the 14-day menu.
- Every output carries disclaimer: "${DISCLAIMER}"`

  const intakePayload = stripUndefined({
    full_name: input.intake.full_name,
    current_weight_kg: input.intake.current_weight_kg ?? null,
    primary_goal: input.intake.primary_goal ?? null,
    dietary_preference: input.intake.dietary_preference ?? null,
    allergies: input.intake.allergies ?? null,
    grocery_budget_usd_per_week: input.intake.grocery_budget_usd_per_week ?? null,
    meals_per_day: input.intake.meals_per_day ?? null,
  })

  const baselinePayload = {
    calorie_target_kcal: input.baseline.calorie_target_kcal,
    macro_targets_g: input.baseline.macro_targets_g,
  }

  const prefsPayload = {
    questions: input.foodPreferences.questions,
    answers: input.foodPreferences.answers,
  }

  const userMessage = `Intake (food-relevant fields):
${JSON.stringify(intakePayload, null, 2)}

Baseline (calorie + macro targets — echo these back exactly):
${JSON.stringify(baselinePayload, null, 2)}

Food-preferences Q&A:
${JSON.stringify(prefsPayload, null, 2)}

Current roadmap phase: ${phase}

Produce the 2-week meal plan + grocery list by calling the record_meal_plan tool.`

  return { systemPrompt, userMessage }
}

function describePhaseNutritionLens(phase: 1 | 2 | 3, goal: string | null): string {
  const baseByGoal: Record<string, string[]> = {
    lose_fat: [
      'Phase 1 foundation: dial in adherence at full deficit, emphasize protein + volume foods to manage hunger.',
      'Phase 2 build: hold deficit, protect muscle with ≥ 2 g/kg protein and training volume.',
      'Phase 3 express: taper deficit toward maintenance for the final week to preserve the loss and support training expression.',
    ],
    gain_muscle: [
      'Phase 1 foundation: controlled surplus ~ +300 kcal, dial in meal timing around training.',
      'Phase 2 build: hold surplus, prioritize protein-dense meals and carb timing around the highest-volume sessions.',
      'Phase 3 express: pull calories back toward maintenance (or mini-cut) to reveal the muscle built in phase 2.',
    ],
    recomp: [
      'Phase 1 foundation: maintenance with high protein (≥ 2 g/kg), moderate carbs on training days.',
      'Phase 2 build: maintenance + more carb around heavy-volume sessions to support hypertrophy volume.',
      'Phase 3 express: slight deficit to reveal recomp changes; protein held.',
    ],
    performance: [
      'Phase 1 foundation: maintenance leaning.  Focus on carb availability for training.',
      'Phase 2 build: maintenance, carb periodization around the highest-volume / highest-intensity days.',
      'Phase 3 express: competition-pace fueling.  Sharp carb timing around key performance days.',
    ],
    maintain: [
      'Phase 1-3 maintenance throughout with consistent protein; meal structure varies with training volume phase-to-phase but calories hold steady.',
      'Phase 1-3 maintenance throughout with consistent protein; meal structure varies with training volume phase-to-phase but calories hold steady.',
      'Phase 1-3 maintenance throughout with consistent protein; meal structure varies with training volume phase-to-phase but calories hold steady.',
    ],
  }
  const arr = baseByGoal[goal ?? 'maintain'] ?? baseByGoal.maintain
  return arr[phase - 1]
}

export const mealsTool: SonnetTool = {
  name: 'record_meal_plan',
  description: "Record the trainee's 2-week meal plan + aggregated grocery list.",
  input_schema: {
    type: 'object',
    required: [
      'plan_name',
      'calorie_daily_target_kcal',
      'macro_daily_targets_g',
      'weeks',
      'grocery_list',
      'disclaimer',
    ],
    properties: {
      plan_name: { type: 'string' },
      calorie_daily_target_kcal: { type: 'integer' },
      macro_daily_targets_g: {
        type: 'object',
        required: ['protein_g', 'fat_g', 'carb_g'],
        properties: {
          protein_g: { type: 'integer' },
          fat_g: { type: 'integer' },
          carb_g: { type: 'integer' },
        },
      },
      weeks: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        items: {
          type: 'object',
          required: ['week_number', 'days'],
          properties: {
            week_number: { type: 'integer', enum: [1, 2] },
            days: {
              type: 'array',
              minItems: 7,
              maxItems: 7,
              items: {
                type: 'object',
                required: ['day_number', 'day_label', 'meals', 'daily_totals'],
                properties: {
                  day_number: { type: 'integer', minimum: 1, maximum: 14 },
                  day_label: {
                    type: 'string',
                    enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                  },
                  meals: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: [
                        'meal_slot',
                        'recipe_name',
                        'serves',
                        'prep_time_min',
                        'cook_time_min',
                        'ingredients',
                        'instructions_short',
                        'macros_per_serving',
                      ],
                      properties: {
                        meal_slot: {
                          type: 'string',
                          enum: ['breakfast', 'lunch', 'dinner', 'snack_1', 'snack_2'],
                        },
                        recipe_name: { type: 'string' },
                        serves: { type: 'integer', minimum: 1 },
                        prep_time_min: { type: 'integer' },
                        cook_time_min: { type: 'integer' },
                        ingredients: {
                          type: 'array',
                          items: {
                            type: 'object',
                            required: ['item', 'amount', 'unit'],
                            properties: {
                              item: { type: 'string' },
                              amount: { type: 'number' },
                              unit: { type: 'string' },
                            },
                          },
                        },
                        instructions_short: { type: 'string' },
                        macros_per_serving: {
                          type: 'object',
                          required: ['kcal', 'protein_g', 'fat_g', 'carb_g'],
                          properties: {
                            kcal: { type: 'integer' },
                            protein_g: { type: 'integer' },
                            fat_g: { type: 'integer' },
                            carb_g: { type: 'integer' },
                          },
                        },
                        leftover_strategy: { type: ['string', 'null'] },
                      },
                    },
                  },
                  daily_totals: {
                    type: 'object',
                    required: ['kcal', 'protein_g', 'fat_g', 'carb_g'],
                    properties: {
                      kcal: { type: 'integer' },
                      protein_g: { type: 'integer' },
                      fat_g: { type: 'integer' },
                      carb_g: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      grocery_list: {
        type: 'object',
        required: ['organized_by_aisle', 'estimated_total_usd', 'bulk_prep_notes'],
        properties: {
          organized_by_aisle: {
            type: 'array',
            items: {
              type: 'object',
              required: ['aisle', 'items'],
              properties: {
                aisle: {
                  type: 'string',
                  enum: [
                    'Produce',
                    'Meat & Seafood',
                    'Dairy',
                    'Pantry',
                    'Frozen',
                    'Bakery',
                    'Other',
                  ],
                },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['item', 'total_amount', 'unit', 'used_in'],
                    properties: {
                      item: { type: 'string' },
                      total_amount: { type: 'number' },
                      unit: { type: 'string' },
                      used_in: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
          estimated_total_usd: { type: 'number' },
          bulk_prep_notes: { type: 'array', items: { type: 'string' } },
        },
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
