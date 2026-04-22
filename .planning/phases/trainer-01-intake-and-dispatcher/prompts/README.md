# Trainer — Phase 2 Sonnet Prompt Templates

**Status:** DRAFT — authored in prep session 2026-04-21 while Trainer parked behind KotoIQ M1.
**Authored by:** Synthesized from Adam's spec ("baseline, 2-week workout with tracking, 2-week meal prep + grocery, preference elicitation, be very intuitive"). NOT literal transcriptions — expanded into production system prompts per CONTEXT DEC-09.
**Consumers:** Phase 2 `/api/trainer/generate` route + `/api/trainer/workout-logs` route.
**Promotion:** When Phase 2 opens, move these files to `src/lib/trainer/prompts/` as `.ts` modules exporting a `buildSystemPrompt(input)` function + a `tool` schema. Treat the text here as the source-of-truth reference; keep one copy here (versioned in planning) and one copy in src/ (runtime).

## Chain Overview

| # | Prompt | Input | Output | Cost class |
|---|--------|-------|--------|-----------|
| 1 | `generate_baseline` | intake row | baseline assessment (macros, kcal, readiness) | ~2k input / ~1k output |
| 2 | `generate_workout_plan` | intake + baseline | 2-week trackable program | ~3k input / ~4k output |
| 3 | `elicit_food_preferences` | intake + baseline | question set (rendered to trainee UI) | ~2k input / ~1k output |
| 4 | `generate_meal_plan` | intake + baseline + pref answers | 2-week menu + grocery list | ~4k input / ~8k output |
| 5 | `adjust_from_progress` | prior plan + workout logs | next 2-week plan + rationale | ~6k input / ~4k output |

**Model:** `claude-sonnet-4-5-20250929` (pinned per STATE.md Phase 7 Plan 1 decision).
**Structured output:** strict JSON via Anthropic `tool_use` pattern — one tool per prompt, `input_schema` enforced. Zod-validates the tool_use args server-side.
**Token logging:** every call logs to `koto_token_usage` with `feature='trainer_baseline'|'trainer_workout'|'trainer_prefs'|'trainer_meals'|'trainer_adjust'` so cost rolls up per-feature.

## Shared voice direction

All five prompts share this persona layer (include verbatim in every system prompt):

> You are Alex, a seasoned personal trainer, registered dietitian, and strength coach with 15 years of experience working with clients from rehab-stage beginners to national-level amateur athletes. You care about what actually works for the real life in front of you, not textbook ideals. Your tone is warm, plain-spoken, and specific. You never use hype language ("amazing," "incredible," "game-changing") and never talk down to the client. When something is uncertain or depends on the person, you name that uncertainty instead of pretending to know. You never diagnose medical conditions; if something in the intake flags serious medical concern, you route the person to a physician rather than working around it.

## Safety guardrails (applied across all prompts)

- **Medical flags:** if intake `medical_flags` mentions cardiac, uncontrolled hypertension, recent surgery, eating disorder history, or pregnancy (`pregnancy_or_nursing: true`) → baseline must set `training_readiness.ok_to_train: false` and list specifics in `red_flags`. Downstream workout + meal prompts respect this.
- **Allergies:** meal plan must hard-exclude anything in `allergies` free-text. Match is case-insensitive substring; if uncertain (e.g. "nuts" — does peanut count?), ask in prefs elicitation rather than guess.
- **Weight goals:** if `target_weight_kg` implies a rate faster than -1.0 kg/week or +0.5 kg/week, baseline must flag it and recalibrate the timeline in `adjusted_target_weight_timeline_weeks`.
- **Disclaimers:** every plan JSON carries `disclaimer: "Not medical advice. Consult your physician before starting any new program."` in a top-level field.

## File layout

- `01-generate-baseline.md`
- `02-generate-workout-plan.md`
- `03-elicit-food-preferences.md`
- `04-generate-meal-plan.md`
- `05-adjust-from-progress.md`

Each file contains: (a) system prompt text, (b) input contract + example payload, (c) tool-use schema / output shape, (d) guardrails specific to that prompt, (e) Phase 2 executor notes.
