---
phase: 11-kotoiq-wp-guided-onboarding-and-competitor-driven-gap-engine
plan: 05
subsystem: builder / wp-shim (competitor-driven gap scoring + auto internal-linking)
tags: [WS5, WS6, page-factory, gap-engine, internal-links, data-integrity]
requires:
  - "analyzePageGaps signals (volume, competitor rank set, coverage, difficulty) — pageGapEngine"
  - "deployCampaign sibling/cross/hub link computation — topic-campaign/route.ts"
  - "createVerifiedData provenance — dataIntegrity.ts"
provides:
  - "scoreServiceCityGrid() — explicit-formula gap scoring + quick_win/net_new/big_bet bucketing"
  - "computeInternalLinks() — shared sibling/cross/hub link helper (reused by deploy + Page Factory)"
  - "score_grid action on /api/kotoiq — bucketed outcome report"
  - "gap-score columns on kotoiq_page_suggestions (manual-apply migration)"
affects:
  - "src/app/api/kotoiq/topic-campaign/route.ts (deploy + redeploy now call the shared helper)"
  - "src/lib/kotoiq/bulkPageBuilder.ts (Page Factory publish now weaves internal links)"
tech-stack:
  added: []
  patterns:
    - "Pure-function-first: computeCellScore/bucketCell + computeInternalLinks are IO-light/pure so they unit-test on fixtures"
    - "Wrapper-not-rewrite (RESEARCH A4 / Pitfall 3): re-express raw signals, never re-blend the additive priority"
    - "Byte-identical extraction proven via snapshot/regression test before reuse"
key-files:
  created:
    - "supabase/migrations/20260608_kotoiq_page_suggestions_gap_score.sql"
    - "src/lib/builder/scoreServiceCityGrid.ts"
    - "src/lib/wp-shim/computeInternalLinks.ts"
    - "tests/kotoiq/scoreServiceCityGrid.test.ts"
    - "tests/kotoiq/computeInternalLinks.test.ts"
  modified:
    - "src/app/api/kotoiq/route.ts (score_grid action)"
    - "src/app/api/kotoiq/topic-campaign/route.ts (deploy/redeploy call helper; inline buildCrossCampaignMap removed)"
    - "src/lib/kotoiq/bulkPageBuilder.ts (publishBriefToWp weaves internal links)"
    - "supabase/migrations/_paste_all_pending.sql (gap-score columns pointer appended)"
decisions:
  - "Gap-score persisted as NEW columns on kotoiq_page_suggestions (not a new table) — the UI already reads this row; additive priority kept for back-compat"
  - "Authoritative competitor rank = DataForSEO SERP rank_group + Google Places grid (via analyzePageGaps loaders), wrapped in VerifiedDataSource (T-11-13)"
  - "computeInternalLinks takes caller-computed newSiblings (resolveMaster-dependent) and does the byte-identical prior+new dedupe-by-city merge + cross-campaign map"
  - "No ALLOWED_ACTIONS constant exists on /api/kotoiq — plan text referenced one; appended to the if-chain in the canonical route shape instead"
metrics:
  duration: ~9m
  tasks: 3
  files: 9
  completed: 2026-06-09
---

# Phase 11 Plan 05: Competitor-Driven Gap Scoring + Auto Internal-Linking Summary

Competitor-rank-driven `scoreServiceCityGrid()` that re-expresses `analyzePageGaps`' raw signals as the explicit `(demand + competition_strength) × (1 − our_coverage) ÷ max(difficulty, MIN_DIFFICULTY)` formula with quick-win / net-new / big-bet bucketing and a "client city, no competitor" surfacing — plus an extracted `computeInternalLinks` helper that gives Page Factory builds the same sibling/cross/hub auto-linking `deployCampaign` already performs (approval gate retained, byte-identical proven).

## What Shipped

**WS5 — `scoreServiceCityGrid` (Task 1 + Task 2)**
- Manual-apply migration adds `score`, `bucket`, `our_coverage`, `competition_strength`, `score_sources jsonb` to `kotoiq_page_suggestions`; keeps the additive `priority` column for `PageSuggestionsTab` back-compat. Re-runnable (`ADD COLUMN IF NOT EXISTS`); a pointer is appended to `_paste_all_pending.sql`.
- New `src/lib/builder/scoreServiceCityGrid.ts`:
  - **Pure** `computeCellScore(signals)` = the explicit formula, with a `MIN_DIFFICULTY` floor (T-11-16, no divide-by-zero) and `our_coverage` clamped to [0,1].
  - **Pure** `bucketCell(signals)` → `quick_win` (existing page ranks 8-25, or uncontested client city with real demand) | `net_new` (competitors cover, no page) | `big_bet` (high demand × difficulty, no page) | `low_demand_deprioritize` (client city, no competitor, low demand) — each with a human-readable reason string.
  - Exported tunable constants: `SCORE_WEIGHTS`, `MIN_DIFFICULTY`, `QUICK_WIN_RANK_BAND`, `MIN_REAL_DEMAND`, `BIG_BET_DEMAND_X_DIFFICULTY`.
  - IO wrapper gathers signals via `analyzePageGaps` (reusing 11-04's `cities[]` scoping), wraps the competitor-rank + difficulty facts in `createVerifiedData` (`source_url` + `fetched_at`, T-11-13) into `score_sources`, scores+buckets, persists to the new columns (priority untouched), and returns the outcome report: *"N opportunities — X quick wins, Y net-new, Z big bets"*.
- `score_grid` action on `/api/kotoiq` (canonical route shape: verifySession gate → client/agency resolution mirroring `sync_page_factory` → call the wrapper → return report/cells/sources).

**WS6 — `computeInternalLinks` (Task 3)**
- Extracted the sibling/cross/hub computation from `deployCampaign` (~1745-1785) into `src/lib/wp-shim/computeInternalLinks.ts` (DB-reads-only). Returns `{ siblingLinks, crossByCity, hub? }`.
- `deployCampaign` + `redeployCampaign` now call the helper; the inline `buildCrossCampaignMap` was removed (logic moved verbatim into the helper). Output is **byte-identical** — proven by the snapshot/regression suite that reproduces the exact `siblingsByCity` merge on a fixture.
- `publishBriefToWp` (Page Factory) now computes the same sibling/cross/hub links for the brief's service×city (via the linked suggestion → topic campaign) and passes them into `generate_pages` as `internal_links`. The **approval gate is retained** — publish is an explicit operator action and the build publishes as a draft; no auto-publish (CONTEXT deferred). Linking is best-effort and never blocks a build.
- BreadcrumbList stays schema-only: the hub is passed as `ctx.hub` (JSON-LD), never injected into the post body (KSES).

## Tests

- `tests/kotoiq/scoreServiceCityGrid.test.ts` — 12 pure-fn tests: formula correctness, `our_coverage=1` ⇒ 0, monotonic ÷ difficulty, `difficulty=0` floor (no divide-by-zero), quick_win at sc_position band edges, net_new, big_bet, client-city deprioritize-with-reason, and uncontested-client-city quick_win.
- `tests/kotoiq/computeInternalLinks.test.ts` — 4 tests: sibling dedupe-by-city (new wins) + retention, cross-campaign grouping by city key, hub present only when provided, and a byte-identical merge assertion vs the inline deploy reference.
- Full `tests/kotoiq/` suite: **276 passed, 2 failed (pre-existing Phase 8, out of scope)**. `npx tsc --noEmit` clean. `topicCampaignGenerator.test.ts` (closest topic-campaign regression) still green.

## Deviations from Plan

### Auto-fixed / adjustments

**1. [Rule 3 - Blocking] No `ALLOWED_ACTIONS` constant on `/api/kotoiq`**
- **Found during:** Task 2
- **Issue:** The plan said to append `score_grid` "to the if-chain + ALLOWED_ACTIONS". `/api/kotoiq/route.ts` has no such constant — it dispatches purely via an `if (action === ...)` chain behind a verifySession soft-gate.
- **Fix:** Appended `score_grid` to the if-chain in the canonical route shape (mirroring `sync_page_factory`'s client/agency resolution). No allowlist to update.
- **Files:** `src/app/api/kotoiq/route.ts`

**2. [Rule 1 - Cleanup] Removed now-dead inline `buildCrossCampaignMap`**
- **Found during:** Task 3
- **Issue:** After deploy + redeploy were routed through `computeInternalLinks`, the inline `buildCrossCampaignMap` in `topic-campaign/route.ts` became unreferenced (tsconfig has no `noUnusedLocals`, so it wouldn't error — but it's dead code that would drift from the canonical helper).
- **Fix:** Deleted it, leaving a pointer comment to the extracted helper. The helper contains the identical logic.
- **Files:** `src/app/api/kotoiq/topic-campaign/route.ts`

## Operator / Manual Steps

- **Apply the gap-score migration MANUALLY** in the Supabase SQL editor before the pilot: paste `supabase/migrations/20260608_kotoiq_page_suggestions_gap_score.sql` (or run the appended block in `_paste_all_pending.sql`). **Do NOT run `supabase db push`** (prod has migration-tracking drift). The migration is idempotent (`ADD COLUMN IF NOT EXISTS`).
- `score_grid` results (the new columns) will be NULL on existing suggestion rows until the migration is applied and a `score_grid` run completes; `priority` continues to work in the meantime.

## Threat Model Coverage

- **T-11-13** (stale/fabricated ranks): competitor-rank + difficulty facts wrapped in `createVerifiedData` (`source_url` + `fetched_at`) into `score_sources`.
- **T-11-14** (cross-agency gap data): `score_grid` runs behind the `/api/kotoiq` verifySession + client-ownership gate; `kotoiq_page_suggestions` RLS is agency-isolated.
- **T-11-15** (auto-publish bypass): approval gate retained — Page Factory linking is applied on draft builds only; publish stays an explicit operator action.
- **T-11-16** (divide-by-zero): `MIN_DIFFICULTY` floor in `computeCellScore`, unit-tested.

## Known Stubs

None. The score, buckets, ranks (provenance-wrapped), and internal links are all real, computed values. The Page Factory `internal_links` payload is best-effort (returns null when no topic campaign exists for the service yet) but is functional when a campaign is present — not a placeholder.

## Deferred Issues

Two pre-existing Phase 8 test-assertion failures (env-var message drift) logged to `deferred-items.md` — out of scope (fail on a clean tree; not caused by this plan).

## Self-Check: PASSED

- Files verified present: migration, `scoreServiceCityGrid.ts`, `computeInternalLinks.ts`, both test files, SUMMARY.
- Commits verified present: `d018c2d7`, `f6db2639`, `8511769a`.
