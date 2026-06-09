# Phase 11 — Deferred Items (out-of-scope discoveries)

Items found during execution that are NOT caused by the current plan's changes.
Logged here per the executor scope-boundary rule; NOT fixed in this phase.

## Pre-existing test failures (Phase 8 — unrelated to Phase 11)

Discovered during 11-05 execution. Both fail on a clean tree (verified via
`git stash` → run → restore), so they pre-date Phase 11 and are out of scope.

| Test | Failure | Root cause |
|------|---------|------------|
| `tests/kotoiq/phase8/profileGBPPlaces.test.ts` > "throws when GOOGLE_PLACES_API_KEY is missing" | expects `'GOOGLE_PLACES_API_KEY missing'`, code now throws `'GOOGLE_PLACES_API_KEY / GOOGLE_PLACES_KEY missing'` | Phase 8 SUMMARY notes the env-var fallback `GOOGLE_PLACES_KEY \|\| GOOGLE_PLACES_API_KEY` was added (commit 9becf78); the test's expected string was never updated. |
| `tests/kotoiq/phase8/profileGBPOAuth.test.ts` > "throws when GOOGLE_OAUTH_CLIENT_ID missing" | expected error string drift (`GOOGLE_OAUTH_CLIENT_ID` vs `GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIE…`) | Same Phase 8 env-var fallback drift. |

Fix (future, Phase 8 follow-up): update the two `.toThrow(...)` expected strings
to match the current fallback-aware error messages. One-line edits each. NOT a
code bug — the runtime messages are correct; only the test assertions are stale.
