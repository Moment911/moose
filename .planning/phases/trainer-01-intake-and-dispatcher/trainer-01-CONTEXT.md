# Trainer Phase 1: Intake + Dispatcher — Context

**Gathered:** 2026-04-21
**Status:** PARKED — do not execute until KotoIQ M1 closes (Phase 7 UAT + Phase 8 review/verify/UAT + pilot).
**Sketch authored by:** prep session while M1 in flight. Promote to `status: Ready for planning` once M1 gate passes.

<initiative>
## Initiative Overview — Koto Trainer

Koto Trainer is a **separate initiative** from KotoIQ. It adds a personal-trainer / nutritionist / meal-prep product line to Koto under a new `/trainer` route, gated per-agency via a feature flag. It is NOT part of the KotoIQ M1 roadmap and lives under its own `trainer-NN-...` phase namespace.

### Product shape

- Agencies that have the `fitness_coach` feature enabled get a new "Trainer" sidebar entry and can add **trainees** — a new Koto user type separate from the agency→client hierarchy.
- For each trainee, the agency submits an intake form; Claude Sonnet generates a **baseline + 90-day roadmap + week-1 workout + week-1 meals + grocery list** in one chained generation.
- Trainees receive a real Supabase auth account (not a magic-link viewer) and a `/my-plan` read-only view of their current week.
- v2 adds progress audit + photo upload + weekly email/SMS nudges + month-end phase regeneration.

### Locked decisions (from handoff, do not re-litigate)

- **DEC-01: Flat trainee model.** Trainees are a new Koto user type, NOT in the agency→client hierarchy. Access gated by `agencies.features->>fitness_coach = 'true'`. Koto admin toggles per agency.
- **DEC-02: v1 scope (UPDATED 2026-04-21).** Intake → baseline + 2-week workout plan (trackable) + food-preferences elicitation + 2-week meals + grocery list + adjust-from-progress loop. Pulls workout/meal logging forward from v2 so Sonnet can tune the next block based on actual performance. **Dropped from v1:** 90-day roadmap (deferred to v3 or struck). **Still deferred to v2:** progress photos, weekly email/SMS nudges, month-end phase regeneration beyond the next-block adjust loop.
- **DEC-09: 5-prompt Sonnet chain for Phase 2 generate route.** `generate_baseline` → `generate_workout_plan` → `elicit_food_preferences` → `generate_meal_plan` → `adjust_from_progress` (runs on demand after logged data accumulates). Each prompt = strict-JSON output via Anthropic `tool_use` (validated against Zod). Drafts stashed in `.planning/phases/trainer-01-intake-and-dispatcher/prompts/` for Phase 2 to promote into `src/lib/trainer/prompts/`.
- **DEC-10: Phase 1 intake captures hard food constraints only.** `dietary_preference`, `allergies`, `grocery_budget_usd_per_week`, `meals_per_day` stay on intake (structural, non-negotiable). Soft preferences (favorite foods, disliked foods, cook-time tolerance, variety preference, leftover tolerance) are elicited by prompt 3 at plan-generation time. This makes intake shorter and the meal plan more adaptive.
- **DEC-03: Trainee auth.** Trainee gets a real Supabase auth account with limited role (not a magic-link viewer). Invite email via Resend. (Shipped in Phase 3, not Phase 1.)
- **DEC-04: AI model.** Claude Sonnet (pinned `claude-sonnet-4-5-20250929` per STATE.md) for all generate-route calls — for quality, not Haiku.
- **DEC-05: Route.** `/trainer` is the agency-facing surface. `/my-plan` is the trainee-facing surface (Phase 3).
- **DEC-06: Progress cadence (v2).** Both push (email/SMS via Resend + optional Telnyx) AND pull (in-app).
- **DEC-07: Table prefix.** `koto_fitness_*` (trainees, plans, progress). NOT `koto_trainer_*`. Matches Koto's existing `koto_*` convention for agency-scoped tables.
- **DEC-08: Storage convention.** Progress photos (v2) land in the `trainer-photos` Supabase Storage bucket, path `agency_id/trainee_id/...` mirroring KotoProof's `review-files` pattern.

### Three-phase plan (promote each in turn)

**Phase 1 — Intake + Dispatcher (this phase).** DB foundation, feature-flag column on agencies, `/api/trainer/trainees` CRUD dispatcher, `/trainer` list + `/trainer/new` intake form, conditional sidebar, RLS scoped by `agency_id`. No plan generation yet; intake captures raw data only.

**Phase 2 — Generate Route + Plan View + Workout Log.** `/api/trainer/generate` runs 5 chained Sonnet prompts per DEC-09 (baseline → workout 2-week → food-prefs elicitation → meals 2-week + grocery → adjust-from-progress on demand). Persists to `koto_fitness_plans`; logs every call to `koto_token_usage` with per-prompt `feature='trainer_baseline'|'trainer_workout'|'trainer_prefs'|'trainer_meals'|'trainer_adjust'`; enforces per-agency daily budget guard. New `/api/trainer/workout-logs` dispatcher lets trainees (Phase 3) or agency (Phase 2 for manual entry) log actual weight/reps/RPE per set. `/trainer/:traineeId` renders the agency-side plan view with generate button, plan preview, and log-history panel.

**Phase 3 — Trainee Auth + /my-plan.** On intake submit, create Supabase auth account for the trainee; add `role` column to `users` (`trainer_trainee` role); send magic-link invite via Resend. Build `/my-plan` trainee-facing read-only view. RLS tightens: trainee can SELECT only their own row in `koto_fitness_*`.

### v2 (deferred — future phases 4/5/6)

- **Phase 4** — Progress audit form + photo upload (Supabase bucket `trainer-photos`) + weekly check-in. (NOTE: workout-set logging moved to Phase 2 per DEC-02 update; this phase covers weight/body-photo check-ins only.)
- **Phase 5** — Resend weekly email + optional Telnyx SMS progress nudges.
- **Phase 6** — Month-end phase regeneration + history view (past plan revisions visible to both trainer and trainee).

</initiative>

<domain>
## Phase 1 Boundary

Ship the **foundation layer** for Trainer: schema, feature flag, agency-scoped API dispatcher, and the minimum UI needed to capture a trainee intake. After Phase 1, an agency operator can:

1. Toggle the `fitness_coach` feature on for their agency (Koto admin action — row update; no UI in Phase 1 — see "Admin toggle" below).
2. See a new **Trainer** entry in the sidebar (conditional render).
3. Click through to `/trainer` and see their trainee list (empty at first).
4. Click "Add Trainee" → `/trainer/new` → fill the intake form → submit.
5. See the trainee appear on `/trainer` with status `intake_complete`.

**Explicit non-goals for Phase 1:**

- No Claude Sonnet generation (that is Phase 2).
- No trainee auth / invite email (that is Phase 3).
- No `/trainer/:traineeId` detail view beyond a stub (Phase 2 fills this).
- No progress audit / photos / notifications (v2).
- No `fitness_coach` toggle UI — Koto admin flips it via direct SQL. The UI lives in the existing Koto Admin surface and can be added in a later plan (or v2).

</domain>

<decisions>
## Phase 1 Implementation Decisions

### Schema (Plan 01)

- **D-01: New tables.** `koto_fitness_trainees`, `koto_fitness_plans`, `koto_fitness_progress`. All carry `agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE` + `created_at` / `updated_at` triggers.
- **D-02: Trainees are standalone.** `koto_fitness_trainees` does NOT have `client_id` — trainees are flat under an agency, not nested under a client. Matches DEC-01.
- **D-03: Plans and progress tables land in Phase 1 as empty shells.** Phase 1 creates them with full column set but no inserts. Phase 2 fills plans; v2 fills progress. Shipping the shells now avoids a second migration when Phase 2 opens.
- **D-04: `agencies.features` jsonb column with default `{}`.** Phase 1 adds this column if it doesn't exist. `fitness_coach` is the only key Phase 1 cares about; future features (e.g. `kotoiq_pro`) share the same column. Default value `{}` so every existing agency defaults to no features enabled.
- **D-05: RLS policies scoped by agency_id.** Every `koto_fitness_*` table: `USING (agency_id = current_setting('app.agency_id')::uuid)` — matches existing Koto agency-isolation standard. Trainee-self-access policies deferred to Phase 3 (when trainees have auth).
- **D-06: `trainee_id` is the public key.** `koto_fitness_trainees.id` is a uuid; the trainee-facing `/my-plan` view (Phase 3) keys off this. Phase 1 exposes it only via the agency-side API.
- **D-07: Soft delete via `archived_at`.** Trainees are never hard-deleted from the agency API. Matches `clients.deleted_at` convention.

### API (Plan 02)

- **D-08: Single dispatcher route `/api/trainer/trainees`.** JSON-action pattern mirroring `/api/kotoiq/profile/route.ts`. Actions: `list`, `get`, `create`, `update`, `archive`, `unarchive`. Body always includes `{ action, ...args }`. `agency_id` comes from `verifySession`, never from body (T-07-01d cross-ref from Phase 7).
- **D-09: Feature-flag gate at route entry.** First thing after `verifySession`: load `agencies.features` for the session's `agency_id`. If `features->>fitness_coach !== 'true'` → return `404` (NOT `403` — link-enumeration mitigation, matches Phase 7 pattern). Every action runs behind this gate.
- **D-10: Cross-agency reads return `404`.** Any `get`/`update`/`archive` for a trainee whose `agency_id` doesn't match session returns `404`, never `403`.
- **D-11: Intake validation is Zod-shaped.** Intake schema lives in `src/lib/trainer/intakeSchema.ts` (new file). `create` action parses body against schema; 400 on parse failure with Zod's per-field errors passed through.
- **D-12: No trainee account creation in Phase 1.** `create` writes to `koto_fitness_trainees` only. Phase 3 adds Supabase auth account + invite email as a follow-up to the same action (or a new `send_invite` action).

### UI (Plan 03)

- **D-13: Routes registered in `src/app/App.jsx`.** `/trainer` → `TrainerListPage`, `/trainer/new` → `TrainerIntakePage`, `/trainer/:traineeId` → `TrainerDetailPage` (stub only in Phase 1; Phase 2 builds the plan view).
- **D-14: Sidebar entry is feature-flag gated.** `src/components/Sidebar.jsx` reads `agency.features.fitness_coach` from the auth context. When true, show "Trainer" item; when false, hide entirely. No flicker: feature flag lives on the agency record loaded at session boot.
- **D-15: Intake form fields (v1 minimum).** Captured on `/trainer/new`:
  - Identity: full_name, email, phone
  - Basics: age, sex, height_cm, current_weight_kg, target_weight_kg
  - Goal: primary_goal (enum: `lose_fat` / `gain_muscle` / `maintain` / `performance` / `recomp`)
  - Experience: training_experience_years, training_days_per_week, equipment_access (enum: `none` / `bands` / `home_gym` / `full_gym`)
  - Health: medical_flags (free text), injuries (free text), pregnancy_or_nursing (bool)
  - Food: dietary_preference (enum: `none` / `vegetarian` / `vegan` / `pescatarian` / `keto` / `paleo` / `custom`), allergies (free text), grocery_budget_usd_per_week, meals_per_day (3|4|5|6)
  - Lifestyle: sleep_hours_avg, stress_level (1-10), occupation_activity (enum: `sedentary` / `light` / `moderate` / `heavy`)
  - Notes: trainer_notes (agency-internal free text)
  - Intake form stores raw values. Phase 2's generate route reads these + synthesizes the Sonnet baseline.
- **D-16: List page shows one row per trainee.** Columns: name, goal, age, days/week, created_at, status badge (`intake_complete` / `plan_generated` / `archived`). No plan-status column yet (Phase 2 adds it). Click row → `/trainer/:traineeId` (stub page).
- **D-17: No avatar / photo UI in Phase 1.** Photos come in v2.

### Security + isolation

- **D-18: Feature-flag enforcement lives in THREE places for defense in depth.**
  1. Sidebar render (DEC D-14) — UX-only hide.
  2. API route entry (D-09) — the real gate.
  3. RLS policy (optional in Phase 1; required by Phase 3 when trainees have auth) — DB-layer gate.
- **D-19: No agency cross-scoping helpers in Phase 1.** Phase 1 uses raw `supabase.from('koto_fitness_*').eq('agency_id', agencyId)` in the dispatcher. A `trainerDb` helper analogous to `kotoiqDb` can land in a future plan if call sites proliferate. Three tables in one route does not justify the abstraction yet.
- **D-20: No PHI / HIPAA scope claim.** Intake captures health-adjacent fields (medical_flags, injuries, pregnancy) but Koto Trainer is NOT marketed as a medical service and does NOT claim HIPAA compliance. Copy on `/trainer/new` makes this explicit: "Not medical advice. Consult your physician before starting any new program." Covers legal surface.

### Cost + budget (Phase 2 concern — noted here for continuity)

- Phase 2's `/api/trainer/generate` will log every Sonnet call to `koto_token_usage` with `feature='trainer_generate'`. Per-agency daily budget defaults to $10/day/agency (editable in `agencies.features.trainer_budget_usd_daily`). Cap enforced via the Phase 8 `profileCostBudget` checker pattern.

### Claude's Discretion

- Exact SQL column types for weight/height (integer vs numeric vs decimal) — pick what matches existing `clients` precision patterns.
- Whether `koto_fitness_plans` uses a single jsonb `plan_document` column or splits `baseline`, `roadmap`, `workouts`, `meals` into separate jsonb columns — Phase 2 plan-time call.
- Whether to surface a "Drafts" state on the list page for incomplete intakes — out of scope unless UX discovery reveals need.

### Folded Todos

(none — no existing todos matched this phase)

</decisions>

<canonical_refs>
## Canonical References

Future executor MUST read these before planning or implementing Phase 1.

### Project-level
- `.planning/PROJECT.md` — Core value, validated shipped engines, current focus
- `AGENTS.md` — "This is NOT the Next.js you know" — consult `node_modules/next/dist/docs/` before writing route handlers
- `_knowledge/data-integrity-standard.md` — Provenance + VerifiedDataSource standard (if Phase 2 pulls any real-world nutrition data, it MUST comply)
- `_knowledge/env-vars.md` — Where to add new env vars (none expected for Phase 1; Phase 2 may add Sonnet budget caps)
- `_knowledge/modules/onboarding.md` — Reference pattern for form + autosave (Phase 1 intake may mirror the autosave cadence)

### Koto patterns this phase reuses
- `src/lib/apiAuth.ts` → `verifySession()` — auth gate for every `/api/trainer/trainees` action
- `src/app/api/kotoiq/profile/route.ts` — canonical JSON-dispatcher shape (ALLOWED_ACTIONS list, body.agency_id silently ignored, 404-not-403 cross-agency)
- `src/lib/supabase.js` → `createClient_()` — auto-provisioning pattern; Phase 3's trainee account creation should mirror it (atomic insert + side-effect fire)
- `src/hooks/useAuth.jsx` — reads the current session + agencyId; sidebar consumes `agency.features`
- `src/components/Sidebar.jsx` — add the feature-flag-gated "Trainer" item here
- `src/app/App.jsx` — register `/trainer`, `/trainer/new`, `/trainer/:traineeId` routes
- `_knowledge/database/tables.md` — documents the existing `agencies` table and conventions; Phase 1 adds `features jsonb` column

### External docs (executor MUST open at implementation time — training data outdated)
- Next.js route handlers: https://nextjs.org/docs/app
- Vercel Functions runtime: https://vercel.com/docs/functions/runtimes
- Supabase RLS jsonb policies: https://supabase.com/docs/guides/database/postgres/row-level-security
- Anthropic Sonnet pinned model `claude-sonnet-4-5-20250929` — pinned per STATE.md Phase 07 Plan 1 decision

### What Phase 1 MUST NOT touch
- `src/lib/kotoiq/**` — Trainer is a separate initiative; do not extend KotoIQ helpers
- `src/lib/kotoiqDb.ts` — Trainer tables do NOT belong in `DIRECT_AGENCY_TABLES` (that is KotoIQ-scoped); a future `trainerDb.ts` helper can mirror the pattern if needed
- Any Elementor / WP publish pipeline — Trainer has no page-publishing surface
- Any existing clients / onboarding / proposal code paths

</canonical_refs>

<plan_map>
## Phase 1 Plan Map

- **Plan 01 — Schema + Feature Flag** (Wave 1, depends on: nothing)
  - `supabase/migrations/20260NNN_koto_fitness_trainees.sql` — tables + `agencies.features` column + RLS + triggers
  - Tests: migration applies cleanly; cross-agency RLS blocks
- **Plan 02 — API Dispatcher** (Wave 2, depends on: 01)
  - `src/app/api/trainer/trainees/route.ts` — 6-action JSON dispatcher
  - `src/lib/trainer/intakeSchema.ts` — Zod schema shared between route + UI
  - Tests: each action auth + feature-flag gated; cross-agency 404
- **Plan 03 — UI: List + Intake + Sidebar** (Wave 2, depends on: 01; can parallelize with 02)
  - `src/views/trainer/TrainerListPage.jsx` (`/trainer`)
  - `src/views/trainer/TrainerIntakePage.jsx` (`/trainer/new`)
  - `src/views/trainer/TrainerDetailPage.jsx` — Phase 1 stub at `/trainer/:traineeId` (shows "Plan generation — Phase 2")
  - `src/app/App.jsx` route registrations
  - `src/components/Sidebar.jsx` conditional render
  - Tests: feature-flag hides sidebar entry; intake form validates; list renders

</plan_map>

<promotion_gate>
## Promotion Checklist — Run before executing Phase 1

- [ ] KotoIQ Phase 7 human UAT gauntlet closed
- [ ] KotoIQ Phase 8 review + verify + UAT closed
- [ ] KotoIQ M1 pilot (PILOT-01) green or re-scoped
- [ ] STATE.md advanced past M1 close
- [ ] Product-side confirmation that Trainer is still the next initiative (vs. deferred for another quarter)
- [ ] This CONTEXT re-read; locked decisions still valid; any drift folded back in
- [ ] 5 source prompts refined into Sonnet system-prompt templates (Phase 2 prerequisite)

Once all checked, flip `status:` at top of this file to `Ready for planning` and run `/gsd-plan-phase trainer-01-intake-and-dispatcher`.

</promotion_gate>
