---
phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo
plan: 04
subsystem: api
tags: [competitor-intel, dataforseo, google-places, aeo, share-of-voice, data-integrity, supabase, kotoiq]

# Dependency graph
requires:
  - phase: 11-kotoiq-wp-guided-onboarding-and-competitor-driven-gap-engine
    provides: aeoVisibilityEngine (setup/scan/getCompetitorCompare), analyze_competitors/getSERPResults organic lens, grid-scan map-pack, scoreServiceCityGrid provenance pattern, kotoiq_client_profile.fields store
  - phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo
    provides: 12-01 extract_comprehensive/save_field actions + serviceInference.saveConfirmedField (route action-chain shape this rides)
provides:
  - "competitorIntel.ts three-lens aggregator (organic + GEO + AEO) with pure cross-lens identity reconciliation"
  - "competitor_intel /api/kotoiq action (V5 input validation + Census city filter; rides V4 ownership gate)"
  - "kotoiq_client_profile.fields.competitor_intel jsonb (unified per-competitor × per-lens set, no new table)"
  - "AEO roster auto-seeding from organic domains + GEO business names before the paid scan"
affects: [12-05 extensive-opportunity-list, 12-06 fast-rank-strategy, StepCompetitors UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-lens reconciliation: AEO row seeds the merge (carries both domain + aliases), organic attaches by hostOf, GEO attaches by normalizeBrand/alias — single-lens rows preserved, never double-counted"
    - "Pure-fn anchor + IO orchestrator in one lib (mirrors scoreServiceCityGrid computeCellScore/bucketCell) so the merge unit-tests on fixtures without DB/network"
    - "Spend cap = deterministic representative service×city subset by default; fullScan=true unlocks full grid + paid AEO; capped combos logged"
    - "Lens degradation: failed lens → status 'unavailable' (never empty-as-no-competitors); no bare catch{} — every failure logged + surfaced in notes[]"
    - "Persist via read-merge-write of fields (clientProfile.upsert overwrites fields wholesale, so existing WS1 category lists must be merged, not clobbered)"

key-files:
  created:
    - src/lib/kotoiq/competitorIntel.ts
    - tests/kotoiq/competitorIntel.test.ts
  modified:
    - src/app/api/kotoiq/route.ts

key-decisions:
  - "AEO lens GATED behind fullScan to bound real Claude/engine $; when skipped, free read of any existing share-of-voice still surfaces (lens not blank if a prior scan ran)"
  - "GEO lens calls /api/seo/grid-scan via internal NEXT_PUBLIC_APP_URL fetch (established codebase pattern) rather than duplicating the Places-grid engine"
  - "Persisted to fields.competitor_intel jsonb (CONTEXT preference, no new table); payload is one object per client — small. A dedicated kotoiq_competitor_intel table is NOT warranted yet (see Volume note)"
  - "ai_available reflects whether the Claude-funded AEO lens actually produced data (scan.successes > 0), driving the UI 'AI unavailable' banner per CONTEXT"

patterns-established:
  - "normalizeBrand drops trailing legal suffixes (LLC/Inc/Co/...) so 'Acme Plumbing LLC' (GEO) reconciles with 'Acme Plumbing' (AEO)"
  - "hostOf returns '' on garbage rather than throwing, so a malformed competitor URL can't crash the merge"

requirements-completed: [COMP-01, COMP-02, COMP-03]

# Metrics
duration: 18min
completed: 2026-06-10
---

# Phase 12 Plan 04: Competitor-Intel Aggregator (organic + AEO + GEO) Summary

**Three-lens competitor aggregator with pure domain↔brand↔business-name identity reconciliation, per-lens createVerifiedData provenance (rankings 24h), representative-subset spend caps, AEO roster auto-seeding before the paid scan, and a competitor_intel action persisting to fields.competitor_intel.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-10T19:48:00Z
- **Completed:** 2026-06-10T19:55:00Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `reconcileCompetitorIdentities` (pure, IO-free) collapses organic (DataForSEO domain rows), GEO (grid-scan business-name rows), and AEO (kotoiq_aeo_competitors brand rows) into ONE per-competitor × per-lens set — single-lens rows preserved, the same competitor never double-counted. 9 fixture unit tests, all green.
- `aggregateCompetitorIntel` orchestrates the three lenses: ORGANIC via `getSERPResults` (top 3-5 by best `rank_group`), GEO via internal `/api/seo/grid-scan` (local-pack winners across cells + client avg rank), AEO via `setupClientForAEO` → roster seed → `runAEOVisibilityScan` → `getCompetitorCompare`.
- Every lens fact wrapped in `createVerifiedData` + `buildExpiresAt('rankings')` = 24h. Failed lens → `'unavailable'` (never empty-as-no-competitors). Spend bounded to a representative service×city subset by default (cap=3), with capped combos logged; `fullScan=true` unlocks the full grid + the paid AEO scan.
- AEO roster (organic domains + GEO business names + self) seeded BEFORE the scan so share-of-voice is non-empty.
- `competitor_intel` action wired into `/api/kotoiq`: V5 validation (services/cities/state required, cities Census-filtered via `getPlacesForState`, grid_size clamped 1..7), V4 ownership via the existing top-level gate. Returns the unified set + lens statuses + provenance + capped info + `ai_available`.

## Task Commits

1. **Task 1: reconcileCompetitorIdentities — pure domain↔brand merge** — `d990df37` (feat)
2. **Task 2: aggregateCompetitorIntel — orchestrate 3 lenses with provenance + spend caps** — `0742a4eb` (feat)
3. **Task 3: competitor_intel action in /api/kotoiq** — `9d1d4951` (feat)

_Task 1 authored test + lib together (the lib is the correctness anchor); committed as one feat per the plan's TDD note._

## Files Created/Modified
- `src/lib/kotoiq/competitorIntel.ts` — three-lens aggregator: pure `reconcileCompetitorIdentities`/`normalizeBrand`/`hostOf` + IO `aggregateCompetitorIntel` (organic/GEO/AEO orchestration, provenance, spend caps, roster seeding, persistence).
- `tests/kotoiq/competitorIntel.test.ts` — 9 pure reconciliation/dedup/normalize unit tests on fixtures (no DB/network).
- `src/app/api/kotoiq/route.ts` — import + `competitor_intel` action (validation + Census city filter + `aggregateCompetitorIntel` call).

## Decisions Made
- **AEO gated behind `fullScan`.** The 5-engine scan costs real money per call; default runs only organic + GEO and reads any pre-existing share-of-voice for free. Explicit `fullScan=true` spends the paid scan.
- **GEO via internal HTTP** to `/api/seo/grid-scan` (the grid logic lives only in that route handler; an established `NEXT_PUBLIC_APP_URL` self-fetch pattern is used across this codebase) rather than duplicating the Places-grid engine.
- **Persistence: `fields.competitor_intel` jsonb** (no new table, per CONTEXT). Read-merge-write to avoid clobbering WS1's category lists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Read-merge-write persistence to avoid clobbering fields**
- **Found during:** Task 2 (aggregateCompetitorIntel persistence)
- **Issue:** `clientProfile.upsert` overwrites the entire `fields` jsonb column. A naive `upsert({ fields: { competitor_intel } })` would wipe the WS1 `keywords/phrases/services/offerings` lists that 12-01 persists to the same column.
- **Fix:** Read the current profile first, spread existing `fields`, then attach `competitor_intel` before upserting.
- **Files modified:** src/lib/kotoiq/competitorIntel.ts
- **Verification:** tsc clean; logic verified against kotoiqDb.ts:377 upsert semantics.
- **Committed in:** 0742a4eb (Task 2 commit)

**2. [Rule 2 - Missing Critical] Census fallback when state known but no city matched**
- **Found during:** Task 3 (competitor_intel action city validation)
- **Issue:** Strict Census filtering could silently drop ALL operator-typed cities (e.g. casing/abbreviation mismatch) and scan nothing.
- **Fix:** If Census loads the state's places but none of the requested cities match, fall back to the requested list rather than an empty scan. If Census lookup itself fails, skip validation (don't block the lens).
- **Files modified:** src/app/api/kotoiq/route.ts
- **Verification:** tsc clean.
- **Committed in:** 9d1d4951 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 - missing critical correctness).
**Impact on plan:** Both protect data integrity (no field clobber, no silent empty scan). No scope creep.

## Issues Encountered
- **2 pre-existing test failures observed** in `tests/kotoiq/phase8/profileGBPPlaces.test.ts` and `profileGBPOAuth.test.ts` — stale assertions on Google env-var error-message wording (Phase 8 renamed env vars per STATE.md commit 9becf78). NOT caused by 12-04 (my commits touch only competitorIntel.ts + its test + the route action). Logged to `deferred-items.md`; out of scope per scope-boundary rule.
- **Route AI-SDK migration recommendation** (plugin hook flagged the pre-existing `@anthropic-ai/sdk` import on route.ts lines 3/136) — pre-existing across 50+ call sites; a provider migration is a separate architectural initiative. Logged to `deferred-items.md`.

## Spend / Cost Notes (per success criteria)
- **DataForSEO (organic):** 1 SERP call per scanned service×city combo (default cap = 3 combos).
- **Google Places (GEO):** one grid-scan per combo; each grid-scan = grid_size² Places calls (default 5×5 = 25 cells × ~3 combos ≈ 75 Places calls). grid_size clamped ≤7.
- **AEO (paid, gated):** ONLY runs on `fullScan=true` — active prompts × 5 engines (ChatGPT/Claude/Gemini/Perplexity/Google AIO). Engine cost surfaced via `scan.total_cost_usd` and logged; logged into `notes[]`. The AEO engine logs its own Claude/parser token usage; the aggregator makes no direct Claude calls.
- **Capping:** non-fullScan runs log `scanned vs skipped` combos; `notes[]` reports the cap to the caller.

## Volume / Future-Table Note
The persisted `fields.competitor_intel` is ONE object per client (≤10 competitors × 3 lens sub-objects + provenance + capped lists). This is small and well within a jsonb column. **A dedicated `kotoiq_competitor_intel` table is NOT warranted yet.** It would only become worth it if the product later needs time-series history (per-scan snapshots) or per-service×city cell-level retention — at which point a table keyed `(client_id, service, city, scanned_at)` would beat ever-growing jsonb.

## Next Phase Readiness
- 12-05 (extensive opportunity list) can read `fields.competitor_intel.competitors[].organic`/`.geo`/`.aeo` and feed competitor domains/keywords into `analyzePageGaps`/`scoreServiceCityGrid`.
- 12-06 (fast-rank strategy) + StepCompetitors UI can render the per-competitor × per-lens set with provenance badges + the `ai_available` banner.
- **Runtime gate (not a build blocker):** the AEO lens returns `ai_available:false` until a FUNDED `ANTHROPIC_API_KEY` is set; organic + GEO work without it.

## Self-Check: PASSED

---
*Phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo*
*Completed: 2026-06-10*
