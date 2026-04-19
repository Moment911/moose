---
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
plan: 01
subsystem: database

tags: [supabase, postgres, vitest, typescript, kotoiq, profile-seeder, provenance]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: getKotoIQDb agency-scoped helper + DIRECT_AGENCY_TABLES set + migration pattern (20260505_kotoiq_builder.sql)
  - phase: 02-eslint-rule
    provides: kotoiq/no-unscoped-kotoiq (every new helper must route through scopedFrom/scopedInsert)
provides:
  - kotoiq_client_profile + kotoiq_clarifications tables with RLS + realtime publication
  - getKotoIQDb(agencyId).clientProfile (7 methods) + .clarifications (7 methods)
  - src/lib/kotoiq/profileTypes.ts — ClientProfile, ProvenanceRecord, EntityGraphSeed (D-22), Clarification, NarrationEvent
  - src/lib/kotoClientPick.ts — shared pick() helper (extracted from KotoProposalBuilderPage)
  - Vitest 1.6.1 test runner + tests/fixtures/profiles.ts + tests/fixtures/anthropicMock.ts
  - DST = '#DC2626' destructive token in src/lib/theme.ts (UI-SPEC §3)
affects:
  - 07-02 (ingest pullers — onboarding / voice / discovery)
  - 07-03 (Stage 0 orchestrator wire-in)
  - 07-04 (Launch Page narrative doc + streaming ingest)
  - 07-05 (clarification queue — chat widget + dashboard)
  - 07-06 (live pipeline ribbon — D-23)
  - 07-07 (operator field add/edit/delete UX)
  - 07-08 (soft launch gate)

# Tech tracking
tech-stack:
  added:
    - vitest@1.6.1 (devDependency)
    - "@vitest/ui@1.6.1 (devDependency)"
    - jsdom@24.1.3 (devDependency, pre-staged for Plans 5-6 React tests)
  patterns:
    - "Per-table updated_at trigger function (one CREATE FUNCTION per table) — mirrors 20260461_clients_updated_at_trigger.sql precedent"
    - "ProvenanceRecord[] per field jsonb shape (D-04 quintet, D-11 multi-source) — sort by operator_edit-wins-ties then descending confidence"
    - "Vitest config sets resolve.conditions=['react-server',...] so `import 'server-only'` resolves to its empty stub at test time"

key-files:
  created:
    - supabase/migrations/20260507_kotoiq_client_profile.sql (Task 1, 94193ef)
    - src/lib/kotoiq/profileTypes.ts (Task 3, 3517358)
    - tests/profileTypes.test.ts (Task 3, 3517358)
    - src/lib/kotoClientPick.ts (Task 4, 5c7831d)
    - vitest.config.ts (Task 6, 6f72942)
    - tests/fixtures/profiles.ts (Task 6, 6f72942)
    - tests/fixtures/anthropicMock.ts (Task 6, 6f72942)
  modified:
    - src/lib/kotoiqDb.ts (Task 5, 494babc — DIRECT_AGENCY_TABLES + clientProfile/clarifications)
    - src/views/KotoProposalBuilderPage.jsx (Task 4, 5c7831d — pick import)
    - src/lib/theme.ts (Task 6, 6f72942 — DST append)
    - package.json (Task 6, 6f72942 — test scripts + devDependencies)
    - package-lock.json (Task 6, 6f72942 — Vitest install)

key-decisions:
  - "Pin claude-sonnet-4-5-20250929 + claude-haiku-4-5-20251001 as the canonical model IDs for the seeder; CONTEXT.md 'Sonnet 4.6 / Haiku 4.5' is aspirational and will upgrade via profileConfig.ts when the newer IDs ship (RESEARCH §17 Risk #1 resolution)"
  - "Per-table updated_at trigger function instead of a shared one — repo never created the generic set_updated_at() the planner expected from 20260505; followed 20260461 narrow-trigger precedent so kotoiq_* tables stay self-contained and DROP TABLE removes their trigger function with them"
  - "kotoiq_pipeline_runs realtime publication ADD deferred — that table doesn't exist on remote yet (created in 20260419_kotoiq_automation.sql which is part of the 7-migration prod backlog); see Known follow-ups"
  - "Vitest resolve.conditions includes 'react-server' so the test runner mirrors Next.js's empty-stub resolution of `server-only` — without this, every test importing a server-only-marked module throws"
  - "pick() return type kept as `string` (not `string | null` from the plan's interface line) — matches the original JSX function's actual behavior; preserves zero-change contract for the proposal builder left-panel callers"

patterns-established:
  - "Phase 7 helper namespacing: clientProfile + clarifications live as nested objects on getKotoIQDb(agencyId) alongside templates/campaigns — keeps the agency_id injection contract single-sourced"
  - "Operator-edit-wins-ties sort for ProvenanceRecord[] — every helper that mutates a fields[fieldName] array applies the same sort so the winning value is consistent across read paths"
  - "Hot-column mirror: when fieldName ∈ PROFILE_HOT_COLUMNS, helpers also patch the indexed text column — keeps the launch-page list query fast without forcing every reader to compute the winning value from jsonb"

requirements-completed: [PROF-03, PROF-04]

# Metrics
duration: ~30min (continuation agent — Tasks 3-6 only; Task 1+2 in prior agent + operator action)
completed: 2026-04-19
---

# Phase 7 Plan 1: Profile Seeder Foundation Summary

**kotoiq_client_profile + kotoiq_clarifications tables shipped with full provenance shape, agency-scoped typed helpers (clientProfile + clarifications, 14 methods), shared profileTypes module, extracted pick() helper, and Vitest 1.6.1 wired up with 4/4 green tests on the first suite.**

## Performance

- **Duration:** ~30 min (Tasks 3-6 in this continuation agent; Task 1 was committed by prior agent at `94193ef`; Task 2 was operator action via Supabase Studio + `supabase migration repair`)
- **Started:** 2026-04-19T14:09:00Z (continuation start)
- **Completed:** 2026-04-19T14:39:27Z
- **Tasks (this run):** 4 (Tasks 3, 4, 5, 6)
- **Files modified (this run):** 10 (3 created in Task 3, 2 in Task 4, 1 in Task 5, 5 in Task 6)

## Accomplishments

- **Migration applied to live Supabase** (Task 2, operator confirmation): `kotoiq_client_profile` + `kotoiq_clarifications` exist on remote with both updated_at triggers and `kotoiq_clarifications` in the supabase_realtime publication
- **profileTypes module** (Task 3) exposes the 12 type/const exports every Phase 7 plan consumes — `SOURCE_TYPES`, `CANONICAL_FIELD_NAMES`, `ProvenanceRecord`, `ClientProfile` (with `margin_notes`), `EntityGraphSeed` + node/edge types, `Clarification` + the three string-literal unions, `NarrationEvent`. 4/4 invariant tests green.
- **pick() helper extracted** (Task 4) into `src/lib/kotoClientPick.ts` — `KotoProposalBuilderPage` imports from the new home; semantics preserved verbatim (first-non-empty-wins across `client[k]` / `onboarding_answers[k]` / `onboarding_data[k]`, arrays joined with ', ', empty string when nothing matches)
- **getKotoIQDb extended** (Task 5) with 14 new methods across `clientProfile` and `clarifications`. `updateField`, `addField`, `deleteField` are real implementations (not stubs) — all three apply the operator-edit-wins-ties + descending-confidence sort and mirror updates onto hot columns when applicable
- **Vitest 1.6.1 wired up** (Task 6) — `npm test` runs `tests/profileTypes.test.ts` to 4/4 green; fixtures + Anthropic SDK mock helpers staged for Plans 2-5
- **DST = '#DC2626' destructive token** appended to `src/lib/theme.ts` for the field-rejection confirmation flow

## Task Commits

1. **Task 1: Migration — kotoiq_client_profile + kotoiq_clarifications** — `94193ef` (feat) — committed by previous executor before checkpoint
2. **Task 2: [BLOCKING] supabase db push — apply migration to live DB** — operator action via Supabase Studio (split into 3 parts because Studio editor chokes on DO blocks); migration history reconciled locally with `supabase migration repair --status applied 20260507`
3. **Task 3: profileTypes.ts + first Vitest test** — `3517358` (feat)
4. **Task 4: Extract pick() helper** — `5c7831d` (refactor)
5. **Task 5: Extend kotoiqDb with clientProfile + clarifications** — `494babc` (feat)
6. **Task 6: Vitest install + config + fixtures + DST token** — `6f72942` (chore)

**Plan metadata:** _to be filled by final docs commit_

## Files Created/Modified

**Created (this continuation agent):**
- `src/lib/kotoiq/profileTypes.ts` — Phase 7 type surface; mirrors the migration shape; D-04 / D-10 / D-11 / D-22 contracts encoded
- `tests/profileTypes.test.ts` — 4 Vitest cases asserting source type count, hot column coverage, ProvenanceRecord shape, EntityGraphSeed key set
- `src/lib/kotoClientPick.ts` — extracted pick() with full JSDoc on the dual-storage fallback chain
- `vitest.config.ts` — node env, tests/**/*.test.ts include, react-server condition for server-only stub resolution, @ alias
- `tests/fixtures/profiles.ts` — COMPLETE / PARTIAL / DISCREPANCY golden-file Partial<ClientProfile> fixtures
- `tests/fixtures/anthropicMock.ts` — three vi.fn() factories for one-shot JSON, tool_use blocks, SSE text-delta streams

**Created (prior agent):**
- `supabase/migrations/20260507_kotoiq_client_profile.sql` — both tables + indexes + RLS + realtime + per-table updated_at triggers

**Modified:**
- `src/lib/kotoiqDb.ts` — DIRECT_AGENCY_TABLES extended; KotoIQDb interface extended; clientProfile + clarifications helper namespaces added (282 lines)
- `src/views/KotoProposalBuilderPage.jsx` — pick import; inline definition removed
- `src/lib/theme.ts` — DST destructive token appended (existing exports unchanged)
- `package.json` — test/test:watch/test:ui scripts; vitest + @vitest/ui + jsdom devDependencies
- `package-lock.json` — Vitest dependency tree

## Decisions Made

- **Per-table updated_at trigger function (vs shared)** — Plan Task 1 expected the executor to grep `20260505_kotoiq_builder.sql` for an existing `set_updated_at()` shared function. There is none — the repo's precedent (20260461_clients_updated_at_trigger.sql) creates a narrowly-scoped function per table. Followed that precedent so each `kotoiq_*` table stays self-contained and `DROP TABLE` removes its trigger function with it. Documented inline in the migration file.
- **Pinned model IDs `claude-sonnet-4-5-20250929` and `claude-haiku-4-5-20251001`** as the canonical IDs the Phase 7 seeder will use. CONTEXT.md's "Sonnet 4.6 / Haiku 4.5" naming is aspirational; downstream Plan 2-5 work will reference these via a `profileConfig.ts` constant (not yet shipped) so the upgrade is a one-line change when the newer IDs land. (RESEARCH §17 Risk #1 resolution.)
- **Vitest `resolve.conditions: ['react-server', 'node', 'import', 'default']`** — necessary because `server-only`'s npm package throws unconditionally from its `default` export and only resolves to a no-op `empty.js` stub under the `react-server` condition (which Next.js sets at build time). Without this, any test importing a `server-only`-marked module — including `tests/profileTypes.test.ts` importing `src/lib/kotoiq/profileTypes.ts` — would fail at import.
- **`pick()` return type is `string`, not `string | null`** — the plan's interface comment said `string | null` but the original JSX function returns `''` (empty string). Kept the actual semantics to preserve the zero-change contract for `KotoProposalBuilderPage`'s left-panel field-resolution callers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration trigger function — pattern mismatch**
- **Found during:** Task 1 (prior agent, prior session — included here for completeness)
- **Issue:** Plan instructed: "use the repo's existing trigger function. Grep 20260505_kotoiq_builder.sql for the function name". The grep returns nothing — `20260505_kotoiq_builder.sql` does not declare any shared `set_updated_at()` function. The repo never had one.
- **Fix:** Followed the actual precedent (`20260461_clients_updated_at_trigger.sql`) which creates a narrow per-table `set_updated_at_on_<table>()` function. Created `set_updated_at_on_kotoiq_client_profile()` and `set_updated_at_on_kotoiq_clarifications()` inline in the new migration.
- **Files modified:** supabase/migrations/20260507_kotoiq_client_profile.sql
- **Verification:** Migration applied cleanly to live Supabase (Task 2 operator confirmation); both triggers exist on remote (`tables_created=2, triggers_created=2`)
- **Committed in:** `94193ef`

**2. [Rule 1 - Bug] `pick()` return type signature**
- **Found during:** Task 4
- **Issue:** Plan's interface comment specified `function pick(client, ...keys): string | null` but the original JSX implementation returns `''` (empty string) when no key matches.
- **Fix:** Typed the extracted function as `(...): string` to match actual semantics. Preserves zero-change contract for existing callers in `KotoProposalBuilderPage.jsx`.
- **Files modified:** src/lib/kotoClientPick.ts
- **Verification:** `npx tsc --noEmit` clean; KotoProposalBuilderPage still type-checks
- **Committed in:** `5c7831d`

---

**Total deviations:** 2 auto-fixed (1 blocking pattern mismatch, 1 type/contract preservation).
**Impact on plan:** Both deviations preserve plan intent — the trigger pattern matches existing repo precedent (which the planner missed), and the pick() type matches actual code (which the planner mis-specified). No scope creep.

## Issues Encountered

- **`server-only` runtime guard in tests:** Caught at Task 6 — without `resolve.conditions: ['react-server', ...]`, every Vitest run would throw `"This module cannot be imported from a Client Component module"` at the top of `profileTypes.ts`. Resolved by mirroring Next.js's condition set in vitest.config.ts.
- **`@typescript-eslint/no-explicit-any` count grew from 33 → 70 in `kotoiqDb.ts`** — the existing file pre-uses `any` 33 times in its established `Record<string, any>` helper signatures (templates, campaigns, builderSites, scopedInsert, scopedFrom). My Task 5 helpers add 37 more `any` usages following the same idiom. Per Deviation Rules SCOPE BOUNDARY, pre-existing lint warnings in unchanged code are out of scope; my additions strictly follow the established style. The `kotoiq/no-unscoped-kotoiq` custom rule (the plan's actual lint acceptance criterion) is NOT triggered — every helper routes through `scopedFrom`/`scopedInsert`.
- **Pre-existing lint errors in `KotoProposalBuilderPage.jsx`** (set-state-in-effect, unescaped apostrophes, unused vars) at lines 71/128/234 — none are in the lines I touched (24, 42-44). Out of scope.

## Known Stubs

None. All Task 5 helpers are real implementations — `updateField`, `addField`, `deleteField` apply the operator-edit-wins sort and hot-column mirror. The `tests/fixtures/anthropicMock.ts` helpers are mocks by design (not production code).

## Known Follow-ups

- **`kotoiq_pipeline_runs` realtime publication ADD deferred** — the migration's `DO` block tries `ALTER PUBLICATION supabase_realtime ADD TABLE kotoiq_pipeline_runs` but that table doesn't exist on remote yet (it's defined in `20260419_kotoiq_automation.sql`, one of 7 prod-backlog migrations not yet applied). Operator's Task 2 verification confirmed `realtime_added=1` (only `kotoiq_clarifications`). The D-23 live ribbon work in Plans 4-8 needs the `pipeline_runs` realtime add to land before its subscribers light up — schedule that as a one-line follow-up migration once the 7-migration prod backlog is applied (or add the publication ADD to the next migration that creates `kotoiq_pipeline_runs` if it gets re-shipped). See CLAUDE.md schema-drift note + project memory `feedback_schema_drift.md` for the broader context.
- **Migration history repair was needed** — operator ran the SQL split into 3 parts via Supabase Studio (the editor chokes on DO blocks), then `supabase migration repair --status applied 20260507` to align local migration history with remote. STATE.md / git history reflect only the migration file commit at `94193ef` — there is no separate operator-apply commit.
- **`profileConfig.ts`** (model ID pinning module) is not yet shipped — Plan 2 should create it on first use of Anthropic in the seeder, with `MODEL_SONNET = 'claude-sonnet-4-5-20250929'` and `MODEL_HAIKU = 'claude-haiku-4-5-20251001'` as constants so the upgrade to "Sonnet 4.6 / Haiku 4.5" (when those IDs publish) is a one-line edit.

## Threat Flags

None — plan stayed within its declared `<threat_model>` surface (kotoiq_client_profile + kotoiq_clarifications cross-agency reads mitigated by `DIRECT_AGENCY_TABLES` membership; RLS pattern verbatim from 20260505; vitest config has no Supabase init / no real keys read).

## User Setup Required

None — no external service configuration introduced.

## Next Phase Readiness

Plans 2-8 in this phase can now build on:
- The two new tables on live Supabase
- `getKotoIQDb(agencyId).clientProfile` and `.clarifications` typed helpers
- `src/lib/kotoiq/profileTypes.ts` types (import everywhere — no duplication)
- `pick()` from `src/lib/kotoClientPick.ts` (Plan 2 ingest pullers)
- `npm test` / Vitest + the three fixtures + the three Anthropic SDK mock helpers
- `DST` token in theme.ts for Plan 7's field-delete confirmation UI

**Blocker for downstream waves:** Plans 4-8 that subscribe to `kotoiq_pipeline_runs` via realtime will need the realtime publication ADD to land (see Known follow-ups above).

## Self-Check: PASSED

All claimed files exist and all commits are in `git log`:
- supabase/migrations/20260507_kotoiq_client_profile.sql — FOUND (Task 1)
- src/lib/kotoiq/profileTypes.ts — FOUND (Task 3)
- tests/profileTypes.test.ts — FOUND (Task 3)
- src/lib/kotoClientPick.ts — FOUND (Task 4)
- vitest.config.ts — FOUND (Task 6)
- tests/fixtures/profiles.ts — FOUND (Task 6)
- tests/fixtures/anthropicMock.ts — FOUND (Task 6)
- Commit 94193ef — FOUND (Task 1, prior agent)
- Commit 3517358 — FOUND (Task 3)
- Commit 5c7831d — FOUND (Task 4)
- Commit 494babc — FOUND (Task 5)
- Commit 6f72942 — FOUND (Task 6)
- `npm test` — 4/4 green
- `npx tsc --noEmit` — 0 errors

---
*Phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder*
*Completed: 2026-04-19*
