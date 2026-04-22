# Prompt 3 — elicit_food_preferences

**Feature tag:** `trainer_prefs`
**Model:** `claude-sonnet-4-5-20250929`
**Invoked:** Third call in the chain. Generates a question set the UI renders to the trainee (or operator-on-behalf-of-trainee) before the meal plan call runs.

## Purpose

The "be very intuitive" step. Produces a short, adaptive list of clarifying questions so the meal plan in prompt 4 feels personal, not formulaic. The questions are SHAPED by the intake + baseline — a vegan trainee skips meat-preference questions; a trainee with 10 min cook tolerance skips prep-intensive questions; a trainee on tight budget gets leftover + bulk-buy questions.

The output is NOT the meal plan. It's a structured question set the UI renders. When the trainee answers, the answers become input to prompt 4.

## System prompt

```
{{SHARED_VOICE_DIRECTION}}

You are running a quick food-preferences check-in with a trainee before designing their
2-week meal plan. You have their intake + baseline. Your job is to produce a small,
thoughtful set of questions (5-10) tailored to them.

Rules:
1. Max 10 questions. Fewer is usually better. If intake already answers something, DON'T ask.
2. Every question has a stated reason (why_asked) shown in the UI so the trainee sees
   the care behind it — this is what makes it feel intuitive instead of formy.
3. Question types: single_select, multi_select, free_text, scale (1-5).
4. Skip by constraint:
   - If dietary_preference = vegan, don't ask about meat, dairy, eggs.
   - If dietary_preference = vegetarian, don't ask about meat.
   - If allergies mention "nuts", don't surface nut options.
   - If grocery_budget_usd_per_week < 60, prioritize leftover + bulk + one-pot questions.
   - If meals_per_day = 3, skip snack questions.
5. Must-ask (adapt wording to the person):
   - Favorite protein sources (from a list tailored to their diet)
   - Dealbreaker foods (free text: "anything you actively won't eat?")
   - Variety preference (repeat same meals vs mid-week variety vs all-different)
   - Cook-time tolerance per day (adapt options to realistic ranges)
   - Batch-prep willingness (yes one big prep day / some / no — fresh daily)
6. Should-ask (include 2-4 based on context):
   - Breakfast vs skip (only if meals_per_day ≥ 3 and not obvious from intake)
   - Leftover tolerance (love / tolerate / prefer fresh)
   - Cuisines they lean toward (multi_select regional: Mediterranean, East Asian, South
     Asian, Latin, American comfort, Middle Eastern — pick 4-5 based on context)
   - Food-stress signal: "How often does deciding what to eat stress you out?" (scale 1-5)
     — used by prompt 4 to decide how rigid vs flexible to make the plan.
7. Never ask about weight, calories, or macros — those are baselined already.
8. why_asked is ONE sentence, warm, written to the trainee. "I ask because people on
   a tight time budget do way better with batch meals than daily fresh cooks, and I
   want to set you up for actual adherence." — that voice.

Every question_id is a stable snake_case slug that prompt 4 will read.
```

## Input contract

```ts
type FoodPrefsInput = {
  intake: { /* ... */ }
  baseline: { /* full record_baseline tool_use args — for kcal/macros context */ }
}
```

## Tool-use schema

```json
{
  "name": "record_food_preferences_questions",
  "description": "Generate a set of food-preferences questions tailored to the trainee.",
  "input_schema": {
    "type": "object",
    "required": ["questions", "disclaimer"],
    "properties": {
      "questions": {
        "type": "array",
        "minItems": 5,
        "maxItems": 10,
        "items": {
          "type": "object",
          "required": [
            "question_id", "question_text", "question_type", "why_asked"
          ],
          "properties": {
            "question_id": { "type": "string" },
            "question_text": { "type": "string" },
            "question_type": {
              "type": "string",
              "enum": ["single_select", "multi_select", "free_text", "scale"]
            },
            "options": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Required for single_select and multi_select. Omit for free_text and scale."
            },
            "scale_min": { "type": "integer" },
            "scale_max": { "type": "integer" },
            "scale_min_label": { "type": "string" },
            "scale_max_label": { "type": "string" },
            "why_asked": { "type": "string", "maxLength": 250 }
          }
        }
      },
      "disclaimer": { "type": "string" }
    }
  }
}
```

## Answer shape (for prompt 4 input)

After the UI collects answers, they get passed to prompt 4 as:

```ts
type FoodPrefsAnswers = {
  answers: Array<{
    question_id: string
    question_text: string           // denormalized for prompt 4 context
    answer: string | string[] | number
  }>
}
```

## Guardrails specific to this prompt

- Questions are generated per-trainee — never cache or reuse across trainees.
- If intake has `allergies` free-text that's ambiguous (e.g. "nuts — maybe peanuts?"), prompt 3 MUST include a clarifying question to resolve. Peanut vs tree nut matters for the meal plan.
- `free_text` questions should be rare — 0-2 per set. Select types give prompt 4 cleaner input.

## Phase 2 executor notes

- Persist the question set to `koto_fitness_plans.food_preferences` as `{ questions: [...], answers: null }`.
- When trainee submits answers, update the same row's `food_preferences.answers`.
- Log to `koto_token_usage` with feature=`trainer_prefs`.
- Prompt 4 is invoked ONLY after answers are present — the UI surface shows the questions and waits. Phase 2 needs a new `/api/trainer/trainees` action `submit_food_preferences` for the submit step.
