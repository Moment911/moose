// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — prompt module barrel.
//
// Re-exports every prompt builder + tool schema + input/output type so the
// /api/trainer/generate dispatcher imports from one surface:
//
//   import { buildBaselinePrompt, baselineTool, type BaselineOutput } from '@/lib/trainer/prompts'
//
// Keep this file a pure re-export — no implementation here.
// ─────────────────────────────────────────────────────────────────────────────

// Baseline
export {
  buildBaselinePrompt,
  baselineTool,
  type BaselineOutput,
} from './baseline'

// Roadmap (90-day, three 30-day phases)
export {
  buildRoadmapPrompt,
  roadmapTool,
  type RoadmapPhase,
  type RoadmapOutput,
} from './roadmap'

// Workout (reused by adjust.ts)
export {
  buildWorkoutPrompt,
  workoutTool,
  type WorkoutExercise,
  type WorkoutSession,
  type WorkoutAdjustment,
  type WorkoutOutput,
} from './workout'

// Food preferences
export {
  buildFoodPrefsPrompt,
  foodPrefsTool,
  type FoodPrefsQuestion,
  type FoodPrefsAnswer,
  type FoodPrefsOutput,
} from './foodPrefs'

// Meal plan
export {
  buildMealsPrompt,
  mealsTool,
  type MealIngredient,
  type Meal,
  type MealDay,
  type GroceryAisle,
  type GroceryEntry,
  type MealsOutput,
} from './meals'

// Adjust-from-progress (reuses workoutTool)
export {
  buildAdjustPrompt,
  type WorkoutLog,
  type AdherenceSummary,
} from './adjust'

// Coaching playbook (one-time reference-depth guide)
export {
  buildPlaybookPrompt,
  playbookTool,
  type SupplementEntry,
  type TroubleshootingScenario,
  type CoachingPlaybookOutput,
} from './playbook'
