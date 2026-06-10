# Deferred Items — Phase 12

Out-of-scope discoveries logged during execution (NOT fixed — unrelated to the current plan's changes).

## 12-01

- **Pre-existing test failure (out of scope):** `tests/kotoiq/phase8/profileGBPPlaces.test.ts` — 2 tests fail because the expected error string `'GOOGLE_PLACES_API_KEY missing'` no longer matches the implementation's `'GOOGLE_PLACES_API_KEY / GOOGLE_PLACES_KEY missing'` (the impl was patched in commit `9becf78` to accept both env-var names; the test was never updated). Pre-dates Phase 12. None of the 12-01 commits touch `phase8/` or `profileGBPPlaces`. Trivial one-line test fix, but belongs to a Phase 8 maintenance pass, not this plan.
