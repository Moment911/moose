# Trainer Phase 2: Generate Route + Plan View + Workout Log — Context

**Gathered:** 2026-04-21
**Status:** PARKED — do not execute until Trainer Phase 1 code-completes AND KotoIQ M1 closes.
**Sketch authored by:** prep session 2026-04-21. Lighter than Phase 1 — boundary, key decisions, prompts handoff, and plan map only. Full decision expansion when this phase promotes.

<domain>
## Phase Boundary

Ship the Sonnet generation chain + plan persistence + workout logging on top of Phase 1's foundation. After Phase 2 an operator on a `fitness_coach`-enabled agency can:

1. Click "Generate Plan" on a Phase 1 trainee detail page
2. See the baseline assessment materialize (calorie + macro targets + readiness verdict)
3. See the 2-week workout plan render with every set trackable
4. Answer food-preference questions with the trainee (UI wizard consuming prompt 3's question set)
5. See the 2-week meal plan + aisle-organized grocery list materialize
6. Later: when logged data accumulates in `koto_fitness_workout_logs`, click "Generate Next Block" → Sonnet adjusts based on actual RPE + reps + adherence

**Explicit non-goals for Phase 2:**

- No trainee auth yet — logs are entered by agency operator on behalf of trainee (Phase 3 adds trainee self-entry via `/my-plan`).
- No meal recalibration on body-weight trend — adjust_from_progress prompt is workout-only. Weight-trend meal recal deferred to v2 Phase 4.
- No PDF export of plans — operator shares agency-side URL for now.
- No progress photos (v2 Phase 4).

</domain>

<key_decisions>
## Key Decisions (from Phase 1 CONTEXT — cross-referenced, not duplicated)

See `.planning/phases/trainer-01-intake-and-dispatcher/trainer-01-CONTEXT.md` for the locked initiative-wide decisions. Phase 2-specific additions:

- **D-P2-01: Dispatcher split.** Two new routes: `/api/trainer/generate` for Sonnet chain + `/api/trainer/workout-logs` for per-set log CRUD. Keep Phase 1's `/api/trainer/trainees` untouched. Mirror the dispatcher shape from `/api/kotoiq/profile/route.ts`.
- **D-P2-02: 5 actions on `/api/trainer/generate`.** `generate_baseline`, `generate_workout`, `elicit_prefs`, `submit_prefs`, `generate_meals`, `adjust_block`. One action per prompt in the chain — UI drives progress because prompt 3's question set needs human-in-loop between prompts 2 and 4.
- **D-P2-03: Short-circuit on `ok_to_train: false`.** If baseline returns unfit-to-train, chain halts after prompt 1. Operator sees red-flag panel with "contact trainee for physician sign-off" guidance. Plan row persists with baseline-only so operator can reopen once cleared.
- **D-P2-04: Budget guard per-agency.** Default $10/day/agency (editable in `agencies.features.trainer_budget_usd_daily`). Full chain (prompts 1+2+3+4) estimates ~$2-3 of Sonnet tokens; adjust call ~$1. Use the Phase 8 `profileCostBudget` checker pattern, not a parallel system.
- **D-P2-05: Prompts live in `src/lib/trainer/prompts/`.** Each prompt = one `.ts` module exporting `buildSystemPrompt(input)` function + `tool` schema. Copy from `.planning/phases/trainer-01-intake-and-dispatcher/prompts/` as the source of truth when promoting.
- **D-P2-06: Plan view is NOT editable in Phase 2.** Operator sees plan but cannot hand-edit exercises or meals. Edit affordance deferred — the adjust_from_progress prompt is the structured "edit" path. Manual overrides land in v2 if needed.
- **D-P2-07: Workout log entry UI is a quick-tap grid.** Each scheduled exercise renders a row with columns for each set (actual_weight_kg, actual_reps, rpe selector 1-10, optional note). Operator taps through a session in 30-60 seconds. Phase 3 makes this trainee-facing.
- **D-P2-08: `koto_token_usage` feature tags (locked in Phase 1 DEC-09).** `trainer_baseline`, `trainer_workout`, `trainer_prefs`, `trainer_meals`, `trainer_adjust`. Cost dashboard rolls up per-feature.
- **D-P2-09: Streaming response for the long meal call.** Prompt 4 is ~8k output tokens. Use Anthropic streaming so the UI can render progressively instead of a 30s blank screen. Matches the `stream_seed` pattern from Phase 7 Plan 4.
- **D-P2-10: Plan history preserved.** Every `adjust_block` call writes a NEW `koto_fitness_plans` row with `block_number` incremented; old blocks never overwritten. Plan history view (Phase 2 UI) shows a timeline.

</key_decisions>

<plan_map>
## Plan Map (to be expanded when promoted)

- **Plan 01 — Prompt modules** (Wave 1)
  - Promote `.planning/.../prompts/*.md` into `src/lib/trainer/prompts/*.ts` with Zod validators for each tool_use output schema
  - Shared `buildSharedVoice()` helper for the persona + safety layer
- **Plan 02 — `/api/trainer/generate` dispatcher** (Wave 2)
  - 6 actions wrapping the Sonnet chain
  - Budget guard + token logging per action
  - Streaming response for `generate_meals`
- **Plan 03 — `/api/trainer/workout-logs` CRUD** (Wave 2, parallel with 02)
  - Actions: `list_for_session`, `log_set`, `edit_log`, `compute_adherence` (used by `adjust_block`)
- **Plan 04 — Plan view UI** (Wave 3)
  - `/trainer/:traineeId` — baseline panel + workout 2-week accordion + meals 2-week accordion + grocery list + generate/adjust buttons
- **Plan 05 — Food-prefs wizard + meal plan stream UI** (Wave 3, parallel with 04)
  - Renders prompt 3's question set, collects answers, triggers `generate_meals`, streams the response
- **Plan 06 — Workout log entry grid** (Wave 3, parallel with 04/05)
  - Quick-tap per-session log grid; saves to `koto_fitness_workout_logs`
- **Plan 07 — Adjust-block flow** (Wave 4)
  - "Generate Next Block" button gated on adherence + calendar; renders diff view showing adjustments_made[]

</plan_map>

<canonical_refs>
## Canonical References (expand when promoting)

- Phase 1 CONTEXT (all initiative decisions)
- Phase 1 PLAN 01-03 (schema + API + UI this phase extends)
- `.planning/phases/trainer-01-intake-and-dispatcher/prompts/` (the 5 prompt drafts)
- Phase 8 budget guard pattern: `src/lib/kotoiq/profileCostBudget.ts` + `checkBudget` usage in `src/app/api/kotoiq/profile/route.ts`
- Phase 7 Plan 4 streaming SSE pattern: `src/app/api/kotoiq/profile/stream_seed/route.ts`
- Anthropic tool_use docs (executor opens at implementation time): https://docs.claude.com/en/docs/build-with-claude/tool-use

</canonical_refs>

<promotion_gate>
## Promotion Checklist

- [ ] Trainer Phase 1 all 3 plans code-complete + verified
- [ ] Phase 1 pilot: at least 1 test trainee intake complete in dev (proves Phase 1 API works before generation loads on top)
- [ ] KotoIQ M1 closed
- [ ] 5 prompts in `.planning/phases/trainer-01-intake-and-dispatcher/prompts/` still reflect current product intent (re-read; update if drifted)
- [ ] Budget policy confirmed ($10/day/agency default or different)
- [ ] This CONTEXT re-read and expanded into full decisions where D-P2-XX entries read "TBD" or need more specificity

Once all checked, flip `status:` to `Ready for planning` and run `/gsd-plan-phase trainer-02-generate-and-plan-view`.

</promotion_gate>
