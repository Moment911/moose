# Deferred Items — Phase 12

Out-of-scope discoveries logged during execution (NOT fixed — unrelated to the current plan's changes).

## 12-01

- **Pre-existing test failure (out of scope):** `tests/kotoiq/phase8/profileGBPPlaces.test.ts` — 2 tests fail because the expected error string `'GOOGLE_PLACES_API_KEY missing'` no longer matches the implementation's `'GOOGLE_PLACES_API_KEY / GOOGLE_PLACES_KEY missing'` (the impl was patched in commit `9becf78` to accept both env-var names; the test was never updated). Pre-dates Phase 12. None of the 12-01 commits touch `phase8/` or `profileGBPPlaces`. Trivial one-line test fix, but belongs to a Phase 8 maintenance pass, not this plan.

## 12-02

- **Pre-existing test failures (out of scope):** Full `npx vitest run` at 12-02 time shows 12 failures across 5 files, NONE touched by 12-02 (this plan only edited `src/components/kotoiq/CategoryChips.jsx` + `ServiceChips.jsx`, which have no dedicated test):
  - `tests/kotoiq/phase8/profileGBPOAuth.test.ts` (1) + `profileGBPPlaces.test.ts` (1) — the same `9becf78` env-var dual-name drift noted under 12-01.
  - `tests/trainer/phase1/intakeCompleteness.test.ts` (1), `tests/trainer/phase2/prompts.test.ts` (6), `tests/trainer/phase2/generateRoute.test.ts` (3) — unrelated fitness-trainer module (coach-voice string drift + generate route mocks). Pre-dates Phase 12, not in this plan's scope.
  - The 12-02-relevant tests are green: `comprehensiveExtractor.test.ts` (10/10) + `serviceInference.test.ts` (6/6) pass; `npx tsc --noEmit` clean.
