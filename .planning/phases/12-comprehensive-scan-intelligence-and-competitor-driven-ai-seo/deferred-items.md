# Deferred Items — Phase 12

Out-of-scope discoveries logged during execution (NOT fixed — unrelated to the current plan's changes).

## 12-01

- **Pre-existing test failure (out of scope):** `tests/kotoiq/phase8/profileGBPPlaces.test.ts` — 2 tests fail because the expected error string `'GOOGLE_PLACES_API_KEY missing'` no longer matches the implementation's `'GOOGLE_PLACES_API_KEY / GOOGLE_PLACES_KEY missing'` (the impl was patched in commit `9becf78` to accept both env-var names; the test was never updated). Pre-dates Phase 12. None of the 12-01 commits touch `phase8/` or `profileGBPPlaces`. Trivial one-line test fix, but belongs to a Phase 8 maintenance pass, not this plan.

## 12-02

- **Pre-existing test failures (out of scope):** Full `npx vitest run` at 12-02 time shows 12 failures across 5 files, NONE touched by 12-02 (this plan only edited `src/components/kotoiq/CategoryChips.jsx` + `ServiceChips.jsx`, which have no dedicated test):
  - `tests/kotoiq/phase8/profileGBPOAuth.test.ts` (1) + `profileGBPPlaces.test.ts` (1) — the same `9becf78` env-var dual-name drift noted under 12-01.
  - `tests/trainer/phase1/intakeCompleteness.test.ts` (1), `tests/trainer/phase2/prompts.test.ts` (6), `tests/trainer/phase2/generateRoute.test.ts` (3) — unrelated fitness-trainer module (coach-voice string drift + generate route mocks). Pre-dates Phase 12, not in this plan's scope.
  - The 12-02-relevant tests are green: `comprehensiveExtractor.test.ts` (10/10) + `serviceInference.test.ts` (6/6) pass; `npx tsc --noEmit` clean.

## 12-04 deferred (out of scope)
- [vercel-functions/ai-sdk] route.ts (lines 3, 136) pre-existing `@anthropic-ai/sdk` direct usage flagged for migration to Vercel AI SDK. Pre-existing across 50+ call sites in this 7000-line route; a provider migration is a separate architectural initiative, not part of WS5. Not introduced by 12-04.

## Pre-existing test failures (observed during 12-04, NOT caused by WS5)
- tests/kotoiq/phase8/profileGBPPlaces.test.ts — expects 'GOOGLE_PLACES_API_KEY missing'; code now says 'GOOGLE_PLACES_API_KEY / GOOGLE_PLACES_KEY missing' (Phase 8 env-name change per STATE.md commit 9becf78). Test assertion is stale.
- tests/kotoiq/phase8/profileGBPOAuth.test.ts — similar stale assertion ('Missing GOOGLE_OAUTH_CLIENT_ID or ...'). Both predate Phase 12; unrelated to competitor-intel.

## 12-05 (out of scope — same pre-existing failures)
- Full `npx vitest run` at 12-05 time shows the SAME 12 failures across 5 files, none touched by 12-05 (this plan only added `src/lib/kotoiq/opportunityList.ts` + its test + the `opportunity_list` route action):
  - `tests/kotoiq/phase8/profileGBPOAuth.test.ts` (1) + `profileGBPPlaces.test.ts` (1) — the `9becf78` env-var dual-name drift (logged under 12-01/12-04).
  - `tests/trainer/phase1/intakeCompleteness.test.ts` (1) + `tests/trainer/phase2/prompts.test.ts` (6) + `generateRoute.test.ts` (3) — unrelated fitness-trainer module (logged under 12-02).
  - 12-05-relevant tests green: `opportunityList.test.ts` (4/4); `npx tsc --noEmit` clean.
- [vercel-functions/ai-sdk] route.ts (lines 3, 137) pre-existing `@anthropic-ai/sdk` direct usage re-flagged on edit. Same separate architectural initiative noted under 12-04; not introduced by 12-05's opportunity_list action (which makes no Claude call).
