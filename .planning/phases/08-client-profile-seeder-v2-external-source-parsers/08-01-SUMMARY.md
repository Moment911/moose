---
phase: 08-client-profile-seeder-v2-external-source-parsers
plan: 01
subsystem: kotoiq
tags: [kotoiq, source-registry, schema, foundation, phase-8]
status: complete
dependency_graph:
  requires:
    - phase-07 (profileTypes SOURCE_TYPES, profileConfig FEATURE_TAGS, kotoiqDb DIRECT_AGENCY_TABLES)
    - tests/fixtures/anthropicMock.ts (pattern reused for Vision mock)
    - supabase/migrations/20260507_kotoiq_client_profile.sql (precedent for RLS + per-table trigger)
  provides:
    - "SOURCE_TYPES extended with 11 Phase 8 values (D-26)"
    - "SOURCE_CONFIG registry (confidence_ceiling/default_cost_cap/feature_tag/display_label per source)"
    - "BUDGETS + RATE_LIMITS constants (D-22/23 + RESEARCH §Security)"
    - "koto_agency_integrations table (encrypted_payload jsonb + RLS + updated_at trigger)"
    - "kotoiqDb.agencyIntegrations typed helper (list/get/getByKind/upsert/delete/markTested)"
    - "tests/fixtures/anthropicVisionMock.ts (shared Vision fixture for Plans 06/07)"
  affects:
    - plan-08-02 (form parsers — consume SOURCE_CONFIG for confidence ceilings + cost caps)
    - plan-08-03 (profileIntegrationsVault + GBP OAuth — read/write koto_agency_integrations)
    - plan-08-04 (website crawl — consume SOURCE_CONFIG.website_scrape + BUDGETS)
    - plan-08-05 (GBP pullers — consume SOURCE_CONFIG.gbp_authenticated + gbp_public)
    - plan-08-06 (PDF + DOCX upload pipeline — consume anthropicVisionMock fixture)
    - plan-08-07 (image OCR — consume anthropicVisionMock + SOURCE_CONFIG.image_ocr_vision)
tech-stack:
  added: []
  patterns:
    - "Append-only SOURCE_TYPES + FEATURE_TAGS (Phase 7 order preserved; Phase 8 values appended)"
    - "SOURCE_CONFIG as Record<string, {...}> keyed by source_type (parity-test enforced)"
    - "Per-table updated_at trigger function (repo precedent — no shared set_updated_at helper)"
    - "DIRECT_AGENCY_TABLES auto-scope via scopedFrom (structural cross-agency defense)"
    - "upsert with onConflict clause respecting unique composite constraints"
key-files:
  created:
    - supabase/migrations/20260520_kotoiq_agency_integrations.sql
    - tests/fixtures/anthropicVisionMock.ts
    - tests/kotoiq/phase8/profileConfig.test.ts
    - tests/kotoiq/phase8/sourcesRegistry.test.ts
    - .planning/phases/08-client-profile-seeder-v2-external-source-parsers/deferred-items.md
  modified:
    - src/lib/kotoiq/profileTypes.ts
    - src/lib/kotoiq/profileConfig.ts
    - src/lib/kotoiqDb.ts
    - tests/profileTypes.test.ts
    - tests/profileConfig.test.ts
decisions:
  - "Per-table updated_at trigger function pattern used (repo precedent; reused Phase 7 Plan 1 decision)"
  - "koto_agency_integrations added to DIRECT_AGENCY_TABLES (not opted-out to db.client.from path) — structural agency scoping via scopedFrom"
  - "agencyIntegrations.upsert enforces agency_id invariant (mirrors scopedInsert) — cross-agency writes throw at helper boundary"
  - "Encryption boundary documented in helper JSDoc only; Plan 03 vault module enforces seal-before-write"
  - "Phase 7 profileTypes.test.ts + profileConfig.test.ts hard-coded count assertions updated inline (Rule 1 — append-only Phase 8 extensions broke SOURCE_TYPES length=7 and FEATURE_TAGS length=9 claims)"
  - "Task 3 Supabase push deferred (parallel worktree cannot safely run supabase db push — no token + would push unrelated pending migrations); documented in deferred-items.md matching Phase 7 kotoiq_pipeline_runs precedent"
metrics:
  duration_minutes: 10
  tasks_completed: 4
  tasks_total: 4
  files_created: 5
  files_modified: 5
  tests_added: 15
  tests_total: 89
  completed: 2026-04-20T20:58:25Z
---

# Phase 8 Plan 1: Foundation — SOURCE_TYPES + SOURCE_CONFIG + koto_agency_integrations Summary

Landed the Phase 8 foundation layer — 11 new `SOURCE_TYPES` values, 10 new `FEATURE_TAGS`, per-source `SOURCE_CONFIG` registry, `BUDGETS` + `RATE_LIMITS` constants, `koto_agency_integrations` migration, `kotoiqDb.agencyIntegrations` typed helper, and the shared `anthropicVisionMock` test fixture. Plans 02-08 can now import a stable contract.

## Final SOURCE_TYPES list (18 values, Phase 7 → Phase 8)

Phase 7 (unchanged order):
1. `onboarding_form`
2. `voice_call`
3. `discovery_doc`
4. `operator_edit`
5. `claude_inference`
6. `uploaded_doc`
7. `deferred_v2`

Phase 8 (appended):
8. `typeform_api`
9. `jotform_api`
10. `google_forms_api`
11. `form_scrape`
12. `website_scrape`
13. `gbp_authenticated`
14. `gbp_public`
15. `pdf_text_extract`
16. `pdf_image_extract`
17. `docx_text_extract`
18. `image_ocr_vision`

## Migration status

**File:** `supabase/migrations/20260520_kotoiq_agency_integrations.sql`
**Push status:** **DEFERRED** — documented in `.planning/phases/08-client-profile-seeder-v2-external-source-parsers/deferred-items.md`.

Reason: parallel worktree executor has no `SUPABASE_ACCESS_TOKEN` and a `supabase db push --linked` from this branch would also push unrelated pending migrations present in main (`20260524_koto_pipelines.sql`, `20260524_momenta_default_pipeline.sql`). The plan itself anticipates this path at Task 3 lines 400-403: defer + document blocker + wrap Plan 03 vault calls in try/catch, matching Phase 7's `kotoiq_pipeline_runs` precedent (STATE.md lines 117-118).

**Resume action for operator (copy from deferred-items.md):**

```bash
export SUPABASE_ACCESS_TOKEN=<your token>
supabase db push --linked
supabase db pull --schema public --dry-run | grep -c koto_agency_integrations
```

Until the push lands, Plan 03 `agencyIntegrations.*` calls will 404 silently (try/catch pattern mandated in Plan 03 per the plan's own Task 3 guidance).

## Deviations from RESEARCH §2 DDL or §9 config blocks

**Zero** deviations from RESEARCH §2 or §9 — the SQL and TS blocks were copied verbatim as the plan required, then adapted only for:
- `CREATE TABLE if not exists public.koto_agency_integrations` — added `public.` schema prefix to match repo idiom (other Phase 7 migrations do the same).
- `set_updated_at()` trigger: RESEARCH §2 block implied a shared `set_updated_at()` helper that does not exist in this repo. Used the per-table trigger function pattern (one CREATE FUNCTION per table) per Phase 7 Plan 1's established precedent (STATE.md line 79-80: *"Per-table updated_at trigger function pattern (one CREATE FUNCTION per table) — repo never had a shared set_updated_at helper"*). Function name: `koto_agency_integrations_set_updated_at()`. This matches 20260507_kotoiq_client_profile.sql exactly.
- SQL comment + migration header added per Phase 7 Plan 1 convention.

## Tests added

- `tests/kotoiq/phase8/profileConfig.test.ts` — 8 tests. SOURCE_TYPES contains 11 Phase 8 values + append-only invariant (18 total); SOURCE_CONFIG parity with SOURCE_TYPES; every feature_tag resolves to FEATURE_TAGS key; confidence_ceiling values match CONTEXT D-04/D-09/D-12/D-19 verbatim; BUDGETS = {5,50,0.8}; RATE_LIMITS = {10,5}; FEATURE_TAGS Phase 7 baseline + Phase 8 additions.
- `tests/kotoiq/phase8/sourcesRegistry.test.ts` — 7 tests. Duplicate SOURCE_TYPES check (catches single-file edits); type-level ClientProfile.sources[] shape checks for website_scrape, pdf_text_extract (with `upload:uuid#page=N` source_ref), gbp_authenticated; anthropicVisionMock fixture smoke tests (tool_use response, expectPdfDocumentBlock throws on wrong prefix/missing block, expectImageBlock throws on wrong media_type).
- `tests/fixtures/anthropicVisionMock.ts` — fixture module (not a test file). Exports `mockAnthropicVisionCall`, `expectPdfDocumentBlock`, `expectImageBlock`. Consumed by Plan 06 / Plan 07 unit suites.

Phase 7 regression: **zero**. `tests/profileTypes.test.ts` and `tests/profileConfig.test.ts` had hardcoded count assertions (SOURCE_TYPES length=7, FEATURE_TAGS length=9) that Phase 8's append-only extension broke; updated inline with the Phase 8 Task 1 commit per Rule 1 (correctness requirement, not scope creep).

## Phase 8 foundation tag

This plan is the foundation for Plans 02-08. Every downstream plan in Phase 8 depends on this commit:
- Plans 02/04/05/07 consume `SOURCE_CONFIG` + `BUDGETS` + `RATE_LIMITS`.
- Plan 03 reads/writes `koto_agency_integrations` via the new `agencyIntegrations` helper (try/catch-wrapped until Task 3 push lands).
- Plans 06/07 consume `anthropicVisionMock` from the fixtures module.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phase 7 test hardcoded counts broke on Phase 8 extension**
- **Found during:** Task 1 GREEN verification (post-implementation full-suite run)
- **Issue:** `tests/profileTypes.test.ts` asserted `SOURCE_TYPES.length === 7` and `tests/profileConfig.test.ts` asserted `FEATURE_TAGS.length === 9`. Both are append-only counts that Phase 8 intentionally extends (18 / 19) per D-26. These assertions reflected Phase 7 at time-of-write but encode an invariant the current plan explicitly overrides.
- **Fix:** Updated both assertions to the new Phase 8 totals with comments referencing the Phase 8 parity test as the authoritative source. No Phase 7 semantics changed — append-only invariant preserved.
- **Files modified:** `tests/profileTypes.test.ts`, `tests/profileConfig.test.ts`
- **Commit:** 86d791a (folded into Task 1 GREEN commit — single atomic change)

### Deferred

**1. Task 3 Supabase push (checkpoint:human-action)**
- **Reason:** Parallel worktree executor cannot safely invoke `supabase db push --linked` — no `SUPABASE_ACCESS_TOKEN` in env; push would also include unrelated pending main-branch migrations (`20260524_koto_pipelines.sql`, `20260524_momenta_default_pipeline.sql`), contaminating the Phase 8 change.
- **Plan-authorized:** Yes — Task 3 lines 400-403 explicitly permit "deferred" with STATE.md blocker note + try/catch wrapping in Plan 03.
- **Operator action required before Plan 03 runs:** See `deferred-items.md`.
- **File:** `.planning/phases/08-client-profile-seeder-v2-external-source-parsers/deferred-items.md`
- **Commit:** f7a2938

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| Task 1 (RED) | 6a44133 | test(08-01): add failing phase 8 profileConfig parity test |
| Task 1 (GREEN) | 86d791a | feat(08-01): extend SOURCE_TYPES + SOURCE_CONFIG + BUDGETS + RATE_LIMITS |
| Task 2 | c49fcc0 | feat(08-01): add koto_agency_integrations migration + kotoiqDb helper |
| Task 3 | f7a2938 | chore(08-01): document deferred Supabase push for migration 20260520 |
| Task 4 | d9191bb | test(08-01): scaffold anthropicVisionMock + sources registry parity |

## Verification signals

- `npx vitest run tests/kotoiq/phase8/` — **15/15 passed** (2 files)
- `npx vitest run tests/` — **89/89 passed** (14 files; zero Phase 7 regressions; +22 from Phase 7 baseline of 67)
- `grep -c "'typeform_api'" src/lib/kotoiq/profileTypes.ts` → 1
- `grep -c "'image_ocr_vision'" src/lib/kotoiq/profileTypes.ts` → 1
- `grep -c "SOURCE_CONFIG" src/lib/kotoiq/profileConfig.ts` → 1 (export declaration)
- `grep -c "export const BUDGETS" src/lib/kotoiq/profileConfig.ts` → 1
- `grep -c "RATE_LIMITS" src/lib/kotoiq/profileConfig.ts` → 1 (export declaration)
- `grep -c "create table if not exists public.koto_agency_integrations" supabase/migrations/20260520_kotoiq_agency_integrations.sql` → 1
- `grep -c "enable row level security" supabase/migrations/20260520_kotoiq_agency_integrations.sql` → 1
- `grep -c "trg_agency_integrations_updated" supabase/migrations/20260520_kotoiq_agency_integrations.sql` → 2
- `grep -c "'koto_agency_integrations'" src/lib/kotoiqDb.ts` → 8 (DIRECT_AGENCY_TABLES + all helper bodies)
- `grep "agencyIntegrations" src/lib/kotoiqDb.ts` → 4 matches (interface, const, return, JSDoc)
- `grep -c "expectPdfDocumentBlock\|expectImageBlock" tests/fixtures/anthropicVisionMock.ts` → 13

## Threat Flags

None. Threat surface unchanged from the plan's `<threat_model>` — this plan adds the `koto_agency_integrations` table whose `encrypted_payload` + RLS disposition T-08-01/T-08-02 were pre-mitigated in the plan and implemented verbatim. No new network endpoints, no new auth paths, no file-access patterns.

## Self-Check: PASSED

- All 9 created/modified files present on disk (5 created + 4 modified).
- All 5 task commits present in git log (`6a44133`, `86d791a`, `c49fcc0`, `f7a2938`, `d9191bb`).
- Full vitest run green: 89/89 tests across 14 files.
- All 8 acceptance grep assertions pass.
