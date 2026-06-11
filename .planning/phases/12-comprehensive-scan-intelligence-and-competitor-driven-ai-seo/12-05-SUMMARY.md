---
phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo
plan: 05
subsystem: api
tags: [opportunity-list, gap-engine, scoreServiceCityGrid, competitor-intel, data-integrity, kotoiq]

# Dependency graph
requires:
  - phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo
    provides: "12-04 competitor_intel aggregator → fields.competitor_intel jsonb (unified per-competitor × per-lens set); 11-04 scoreServiceCityGrid + analyzePageGaps (formula + bucketing + provenance); 11-03 saveConfirmedField → fields.services[]"
provides:
  - "opportunityList.ts: competitorKeywordsFromIntel (pure) + mergeServicePhrases (pure) + buildOpportunityList (IO glue over the reused grid)"
  - "opportunity_list /api/kotoiq action: ONE extensive ranked competitor-driven list (items + buckets + source_counts), graceful when WS5 intel absent"
affects: [12-06 fast-rank-strategy, StepGaps UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Competitor-keyword injection: WS5 competitor phrases merged into the service seed set as extra phrases → fed through the SAME scoreServiceCityGrid so there is ONE ranked/bucketed/provenance-preserving list (research A5 — NOT the Sonnet content-gap/keyword-gap routes that lack logTokenUsage and throw on a missing key)"
    - "Pure extraction + dedup anchor (competitorKeywordsFromIntel / mergeServicePhrases) lazy-importing the server-only grid (mirrors competitorIntel.ts) so the merge logic unit-tests on fixtures without DB/network"
    - "Graceful intel-absent degradation: opportunity_list returns the own-only grid + competitor_intel_available:false flag rather than failing"

key-files:
  created:
    - src/lib/kotoiq/opportunityList.ts
    - tests/kotoiq/opportunityList.test.ts
  modified:
    - src/app/api/kotoiq/route.ts

key-decisions:
  - "Reuse scoreServiceCityGrid (which wraps analyzePageGaps) verbatim — no reimplementation of scoring or bucketing; competitor keywords enter as extra service-seed phrases"
  - "No Claude call anywhere in WS6 — extending the grid (research A5) means no new ANTHROPIC_API_KEY-throw risk and the Sonnet content-gap/keyword-gap routes are untouched"
  - "competitorKeywordsFromIntel reads from whatever the persisted competitor_intel carries: dfs_compare.intersection_keywords (verbatim, strongest), organic-lens competitor SERP titles (tokenized to short noun phrases), and aeo_cited_urls slugs — all OPTIONAL so a partial payload degrades to []"
  - "URL slugs treat dashes/underscores as WORD separators; SERP titles treat | / – as BRAND separators (take the descriptive head) — two distinct tokenizers for two distinct shapes"
  - "Persisted competitor_intel (12-04) does NOT retain raw SERP titles / cited URLs as separate arrays, so the title source is mined from the unified competitors[].name on organic-lens rows; dfs_compare/aeo_cited_urls/serp_titles are read when present (forward-compatible)"

patterns-established:
  - "mergeServicePhrases: own services lead (verbatim casing) + case-insensitive dedup against own AND prior competitor phrases → source_counts {own, competitor_derived} exposes that the list grew"
  - "normalizePhrase + a STOP_TOKENS noise filter + word-count clamp (1..5 words, ≥3 chars) keeps competitor seeds page-worthy"

requirements-completed: [OPP-01, OPP-02]

# Metrics
duration: 9min
completed: 2026-06-10
---

# Phase 12 Plan 05: Extensive Opportunity List (WS6) Summary

**Competitor keywords from WS5's `fields.competitor_intel` (dfs_compare intersection + organic SERP titles + AEO cited-URL slugs) are extracted, deduped, and merged into the client's confirmed service set, then fed through the reused `scoreServiceCityGrid` so the ranked, bucketed, provenance-preserving output becomes ONE extensive, competitor-driven opportunity list — with a `source_counts` field proving the list grew beyond the client's own services.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-10T20:56:00Z
- **Completed:** 2026-06-10T21:05:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `competitorKeywordsFromIntel(intel)` (pure, IO-free): extracts a deduped competitor keyword/phrase set from the persisted WS5 payload — dfs_compare intersection keywords (verbatim), organic-lens competitor SERP titles tokenized to short noun phrases, and AEO cited-URL slugs. Never throws; an absent/partial payload yields `[]`.
- `mergeServicePhrases(services, competitorPhrases)` (pure): unions the client's own services with the competitor phrases, case-insensitive dedup (against own services AND internal dups), own services lead with verbatim casing. Returns `{merged, source_counts:{own, competitor_derived}}` so the UI can show the list grew.
- `buildOpportunityList({agencyId, clientId, services, cities, state, intel})` (IO): derives the competitor seed phrases, merges, and feeds the EXTENSIVE seed set through `scoreServiceCityGrid` — REUSING its formula, its `quick_win/net_new/big_bet/low_demand_deprioritize` bucketing, and its `createVerifiedData` provenance verbatim. Returns `{items, buckets, source_counts, seeds, sources, headline}`. No Claude call; no Sonnet-route edits (research A5).
- `opportunity_list` action wired into `/api/kotoiq`: reads confirmed `fields.services[]` + `fields.competitor_intel`, validates `{cities[], state}` with the same Census-filter pattern as `competitor_intel` (V5), and degrades gracefully when WS5 intel is absent (returns the own-only grid + `competitor_intel_available:false` + a note, never a failure). Rides `verifySession` + the top-level ownership gate.
- 4 pure fixture unit tests (no DB/network): full-payload extraction + dedup, graceful empty/partial/missing intel, merge-grows-without-duplicating, and own-only-when-no-competitor-phrases.

## Task Commits

1. **Task 1: opportunityList.ts — competitor-keyword extraction + grid merge (TDD)** — `0abc1589` (feat)
2. **Task 2: opportunity_list action in /api/kotoiq** — `93e62a08` (feat)

_Task 1 authored the failing test first (RED — module missing), then the lib (GREEN — 4/4). Test + lib committed together per the plan's `tdd="true"` note (the lib is the correctness anchor; the pure extraction/merge is what the test exercises)._

## Files Created/Modified
- `src/lib/kotoiq/opportunityList.ts` — pure `normalizePhrase` + `competitorKeywordsFromIntel` + `mergeServicePhrases`; IO `buildOpportunityList` lazy-importing `scoreServiceCityGrid` (so the pure helpers stay importable from the Vitest react-server env — mirrors `competitorIntel.ts`).
- `tests/kotoiq/opportunityList.test.ts` — 4 pure fixture tests for the extraction + merge/dedup correctness.
- `src/app/api/kotoiq/route.ts` — import + `opportunity_list` action (confirmed-services read, Census city filter, graceful intel-absent degradation).

## Decisions Made
- **Extend the grid, never the Sonnet routes (research A5).** Competitor keywords enter `scoreServiceCityGrid` as extra service-seed phrases, producing ONE list with the existing bucketing + provenance. The `content-gap`/`keyword-gap` Sonnet routes — which lack `logTokenUsage` and throw on a missing key — are untouched, so WS6 introduces no new key-throw risk and makes no Claude call.
- **Two tokenizers for two shapes.** URL slugs (`basement-flood-cleanup`) treat dashes/underscores as word separators; SERP titles (`Emergency Water Damage Restoration | Acme`) treat `|`/`–`/`-` runs as brand separators and take the descriptive head. A single tokenizer mangled one or the other.
- **Mine titles from the unified set.** The persisted `competitor_intel` (12-04) doesn't retain raw SERP titles or cited URLs as separate arrays, so organic-lens competitor titles are read from `competitors[].name`; the optional `dfs_compare`/`aeo_cited_urls`/`serp_titles` fields are read when a future payload carries them (forward-compatible).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `VerifiedDataSource` import source**
- **Found during:** Task 2 (tsc verification)
- **Issue:** `opportunityList.ts` imported `VerifiedDataSource` from `../builder/scoreServiceCityGrid`, but that module only re-imports the type via `import type` and does not re-export it → `TS2459`.
- **Fix:** Import `VerifiedDataSource` directly from its source `../dataIntegrity`; keep `ScoredCell` from `scoreServiceCityGrid`.
- **Files modified:** src/lib/kotoiq/opportunityList.ts
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** 93e62a08 (Task 2 commit — it's the typecheck fix that lets Task 2's verify pass).

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking typecheck error). No scope creep.
**Impact on plan:** None — plan executed as written; the import fix is a mechanical correction.

## Issues Encountered
- **12 pre-existing test failures observed** across `tests/kotoiq/phase8/profileGBP{Places,OAuth}.test.ts` (2 — stale Google env-var-wording assertions per Phase 8 commit `9becf78`) and the unrelated `tests/trainer/phase{1,2}/*` fitness module (10 — coach-voice string drift + generate-route mocks). NONE caused by 12-05 (my commits touch only `opportunityList.ts` + its test + the route action). Logged to `deferred-items.md`; out of scope per the scope-boundary rule. The 12-05-relevant test (`opportunityList.test.ts`, 4/4) is green and `tsc` is clean.
- **Route AI-SDK migration re-flagged** (plugin hook flagged the pre-existing `@anthropic-ai/sdk` import on route.ts lines 3/137) — pre-existing across 50+ call sites; the `opportunity_list` action makes no Claude call. Logged to `deferred-items.md` as a separate architectural initiative (same as 12-04).

## Next Phase Readiness
- 12-06 (fast-rank strategy) can call `opportunity_list` (or `buildOpportunityList` directly) to seed its strategy synthesis with the extensive competitor-driven ranked list; `source_counts.competitor_derived > 0` confirms the list is competitor-driven.
- **Runtime note (not a build blocker):** the competitor-derived count is non-zero only after `competitor_intel` (12-04) has run and persisted `fields.competitor_intel`. Without it, `opportunity_list` returns the own-only grid with `competitor_intel_available:false` (by design).

## Self-Check: PASSED

---
*Phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo*
*Completed: 2026-06-10*
