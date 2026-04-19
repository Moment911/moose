---
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
plan: 06
subsystem: api
tags: [vitest, typescript, kotoiq, profile-seeder, http-route, next16, agency-isolation, prof-01, prof-02, prof-03, prof-04, prof-05, prof-06, d-05, d-15]

# Dependency graph
requires:
  - phase: 07-01
    provides: getKotoIQDb(agencyId) — clientProfile.{get,upsert,updateField,addField,deleteField,list,markLaunched} + clarifications.{list,get,create,update,markAnswered,markForwarded,markSkipped}; ProvenanceRecord + CANONICAL_FIELD_NAMES type surface; Vitest infra
  - phase: 07-02
    provides: profileConfig.MAX_PASTED_TEXT_CHARS (50000) + SEED_DEBOUNCE_SECONDS + SMS_RATE_LIMIT_PER_CLIENT_HOUR (3)
  - phase: 07-03
    provides: extractFromPastedText (Sonnet tool-use) + detectDiscrepancies (pure)
  - phase: 07-04
    provides: seedProfile (Stage 0 master orchestrator) + computeCompleteness (Sonnet judge)
  - phase: 07-05
    provides: recomputeClarifications + pickClarificationChannel + forwardViaSMS/Email/Portal (D-19 non-blocking dispatch)
provides:
  - /api/kotoiq/profile POST route — single 14-action JSON dispatcher consumed by Launch Page (Plan 7) and chat widget (Plan 8) for every profile + clarification operation EXCEPT streaming narration
  - 15 new vitest cases (project total 74/74, was 59)
  - Established canonical pattern for kotoiq HTTP routes: verifySession FIRST → agencyId from session NEVER from body → dispatch action switch → all writes via getKotoIQDb(agencyId)
affects:
  - 07-07 (Launch Page UI calls every action above except seed which uses /stream_seed for the narrated path)
  - 07-08 (Conversational chat widget calls the same actions to mutate profile + answer clarifications inline)

# Tech tracking
tech-stack:
  added: []   # no new dependencies — uses Plans 1-5 lib modules + existing apiAuth.verifySession + Next 16 NextRequest/NextResponse
  patterns:
    - "Action dispatcher idiom: verifySession FIRST → fail-closed 401 if !verified || !agencyId → parse body → if (action === '...') guard chain → fall-through 400 with allowed_actions list. Matches src/app/api/kotoiq/pipeline/route.ts pattern verbatim so future kotoiq routes have one shape to mirror."
    - "Cross-agency clientId guard via .from('clients').eq('id', X).eq('agency_id', agencyId).is('deleted_at', null).maybeSingle() returning 404 NOT 403. Same shape used in seed (line 116-124) + forward_to_client (line 396-404). 404 prevents existence-confirmation per RESEARCH §15 T-07."
    - "Cross-table query pattern (clients, agencies — NOT kotoiq_*): db.client.from(...) + explicit .eq('agency_id', agencyId) per CLAUDE.md isolation rule. The kotoiqDb helper only auto-injects for DIRECT_AGENCY_TABLES; explicit scoping for non-kotoiq tables keeps the boundary visually obvious (and the kotoiq/no-unscoped-kotoiq lint rule remains green)."
    - "Fire-and-forget rescore in update_field: completeness recompute + recomputeClarifications wrapped in IIFE w/ try/catch — D-19 non-blocking, the field write already succeeded so a downstream rescore failure must not surface to the operator."
    - "answer_clarification dual-write contract: db.clarifications.markAnswered AND db.clientProfile.updateField (with source_type='operator_edit', confidence=1.0) when target_field_path is set AND update_field !== false. The 'reject' path (clarification answered but operator opts out of updating the field) is via update_field=false explicit opt-out."
    - "Plan deviation pattern (3rd time used): planner pseudocode assumed db.raw() — method does NOT exist on KotoIQDb. Used db.client.from(...) + explicit agency_id filter. Same deviation as Plans 04 + 05; the pattern is now sufficiently established that future planners should reference it."

key-files:
  created:
    - src/app/api/kotoiq/profile/route.ts (Task 1, db94c55)
    - tests/profileRoute.test.ts (Task 1 RED 9e7bcb4 + GREEN fix db94c55)
  modified: []

key-decisions:
  - "Used db.client.from(...) + explicit .eq('agency_id', agencyId) for non-kotoiq tables (clients, agencies) instead of the plan's nonexistent db.raw().from(...) — KotoIQDb has no raw() method. Same fix as Plan 4/5; this is now the canonical Phase 7 pattern."
  - "Imported CANONICAL_FIELD_NAMES from profileTypes (NOT profileConfig as the plan pseudocode suggested) — profileConfig only exports HOT_COLUMNS. Verified against src/lib/kotoiq/profileTypes.ts:55-85 (the canonical 26-name list) + grep of every importer."
  - "session.userId from verifySession is { string | null } — defaulted to 'operator' in the route (used as added_by + answered_by) so the audit trail always has a non-null actor even on legacy unverified-but-allowed paths."
  - "add_source upsert uses { client_id, sources } only — NO agency_id passed. The kotoiqDb.clientProfile.upsert helper auto-injects agency_id (line 343-352 of kotoiqDb.ts). Defense in depth: only the helper writes agency_id, which keeps cross-agency writes structurally impossible. Test assertion updated to match this contract."
  - "extractClientId helper accepts either body.client_id OR body.url — URL_RE restricted to /onboard, /onboarding-dashboard, /clients (the 3 places clientIds appear in Koto URLs). External URLs don't match → clientId stays null → 400. Documented in route header comment."
  - "Launch is non-blocking (D-15) — runFullPipeline fires REGARDLESS of completeness_score. Even when score < 0.7 the operator's launch click is honored; the score is stored on the profile but is NOT a gate. Test 'launch fires runFullPipeline + markLaunched even when completeness low' explicitly asserts this with score=0.4."

patterns-established:
  - "Canonical kotoiq HTTP route shape: (1) export const runtime = 'nodejs', maxDuration = 60; (2) verifySession FIRST, fail-closed 401 if !verified || !agencyId; (3) parse body in try/catch, 400 on bad JSON; (4) ALLOWED_ACTIONS readonly list for input validation + 400 fall-through; (5) const db = getKotoIQDb(agencyId); const sb: any = db.client; (6) action chain (if (action === 'x') ...); (7) try/catch wrap with 500 fallback. Future plan 07-08+ chat widget endpoints can mirror this verbatim."
  - "Test helper pattern for Next 16 route handlers: mkReq = (body) => ({ json: async () => body }) as unknown as Request — the route only ever calls req.json(), so we can satisfy the NextRequest type with a minimal duck-typed object. Avoids importing the full NextRequest constructor in tests."
  - "vi.mock for the kotoiqDb helper: return a single object with the typed accessors (clientProfile, clarifications) + a `client: dbClient` shim so route code paths that hit db.client.from(...) work uniformly. Inside the dbClient mock, dbFrom.mockReturnValue() per-test sets up the chain stub for that test's expected query."

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06]

# Metrics
duration: ~10min
completed: 2026-04-19
---

# Phase 7 Plan 6: /api/kotoiq/profile JSON Dispatcher Summary

**Single HTTP surface composes Plans 2-5 into a 14-action POST route consumed by the Launch Page (Plan 7) and chat widget (Plan 8). Every action runs verifySession FIRST and reads agencyId from the session — never from body (T-07-01d). Cross-agency clientId returns 404 NOT 403 (T-07 link enumeration mitigation). Oversized pasted_text returns 413 (T-07-07b). SMS rate-limit bubbles as 429 (T-07-03). Launch is D-15 non-blocking — runFullPipeline + markLaunched fire even when completeness < 0.7. answer_clarification dual-writes markAnswered AND clientProfile.updateField with operator_edit + confidence 1.0 when target_field_path is set (PROF-05). reject_field preserves the ProvenanceRecord[] under rejected:true (PROF-05 audit trail). 15 new vitest cases green; project total now 74/74. Build + lint clean. Route registered.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-19T16:55:20Z
- **Completed:** 2026-04-19T17:05:00Z (approx)
- **Tasks:** 1 (TDD: RED 9e7bcb4 → GREEN db94c55)
- **Files created:** 2 (route.ts + test.ts)
- **Files modified:** 0

## Accomplishments

### Task 1: src/app/api/kotoiq/profile/route.ts — 14-action JSON dispatcher

The 14 actions mapped to their underlying lib calls:

| Action               | Payload (key fields)                                            | Response (key fields)                              | Lib call                                                         |
|----------------------|-----------------------------------------------------------------|----------------------------------------------------|------------------------------------------------------------------|
| `seed`               | `client_id` or `url`, `pasted_text?`, `force_rebuild?`          | `{profile, discrepancies, sources_added}`          | `seedProfile` (Plan 4)                                           |
| `get_profile`        | `client_id`                                                     | `{profile, discrepancies}`                         | `db.clientProfile.get` + `detectDiscrepancies` (Plan 3)          |
| `list_profile`       | `launched?`                                                     | `{profiles}`                                       | `db.clientProfile.list`                                          |
| `paste_text`         | `client_id`, `pasted_text`, `commit?`                           | `{extracted}` or `{extracted, profile, discrepancies}` if commit | `extractFromPastedText` (Plan 3) + optional `seedProfile`        |
| `update_field`       | `client_id`, `field_name`, `value`, `source_type?`              | `{ok}` (fire-and-forget rescore + clarif recompute)| `db.clientProfile.updateField` + bg `computeCompleteness` + `recomputeClarifications` |
| `add_field`          | `client_id`, `field_name` (NOT canonical), `value`              | `{ok}`                                             | `db.clientProfile.addField` (D-05 — operator custom)             |
| `delete_field`       | `client_id`, `field_name`                                       | `{ok}`                                             | `db.clientProfile.deleteField`                                   |
| `reject_field`       | `client_id`, `field_name`                                       | `{ok}` (records preserved w/ rejected:true)        | `db.clientProfile.upsert` (PROF-05 audit trail)                  |
| `add_question`       | `client_id`, `question` (≤2000), `severity?`, `target_field_path?` | `{clarification}`                                  | `db.clarifications.create`                                       |
| `launch`             | `client_id`, `target_keywords?`, `stages_to_run?`               | `{run_id, completeness_score, soft_gaps}`          | `computeCompleteness` + `runFullPipeline` + `db.clientProfile.markLaunched` |
| `list_clarifications`| `client_id?`, `status?`, `severity?`, `limit?`                  | `{clarifications}`                                 | `db.clarifications.list`                                         |
| `answer_clarification`| `clarification_id`, `answer_text`, `update_field?` (default true)| `{ok}` (dual-write)                               | `db.clarifications.markAnswered` AND `db.clientProfile.updateField` (when target set) |
| `forward_to_client`  | `clarification_id`, `channel?` (auto/sms/email/portal)          | `{ok, channel, error?}`                            | `pickClarificationChannel` + `forwardViaSMS`/`Email`/`Portal` (Plan 5) |
| `add_source`         | `client_id`, `source_type`, `source_url?`, `metadata?`          | `{ok}`                                             | `db.clientProfile.upsert` (appends to sources jsonb)             |

All 14 actions require **auth tier**: `verified: true` AND `agencyId !== null` (no anonymous, no bypass).

**Auth scaffolding (every action):**
1. `const session = await verifySession(req)`
2. `if (!session.verified || !session.agencyId) return err(401, 'Unauthorized')`
3. `const agencyId = session.agencyId` (used everywhere downstream)
4. `body.agency_id` is silently IGNORED — never read into a variable

**Verified verifySession return shape (src/lib/apiAuth.ts:11-18):**
```ts
{
  agencyId: string | null
  userId: string | null
  isSuperAdmin: boolean
  role: 'super_admin' | 'owner' | 'admin' | 'member' | 'viewer' | 'client' | null
  clientId: string | null
  verified: boolean
}
```
Route uses `session.verified` (gate) + `session.agencyId` (the only source of agencyId) + `session.userId` (defaulted to 'operator' for added_by / answered_by audit fields).

### Tests

15 vitest cases in `tests/profileRoute.test.ts`:

1. ✓ returns 401 when session not verified
2. ✓ returns 401 when verified but agencyId missing
3. ✓ returns 400 on unknown action with allowed_actions list
4. ✓ seed returns 404 when client row missing (cross-agency guard — RESEARCH §15 T-07)
5. ✓ seed rejects oversized pasted_text with 413 (T-07-07b)
6. ✓ seed succeeds and forwards body fields to seedProfile (agencyId from session, NOT body)
7. ✓ launch fires runFullPipeline + markLaunched even when completeness low (D-15 non-blocking)
8. ✓ forward_to_client returns 429 when SMS forwarder reports rate limit
9. ✓ answer_clarification calls markAnswered AND updateField when target_field_path set (PROF-05)
10. ✓ answer_clarification skips updateField when update_field=false
11. ✓ add_question rejects ≥2000 char question
12. ✓ add_field rejects canonical field names (D-05 — use update_field instead)
13. ✓ list_profile returns the helper output
14. ✓ paste_text without commit returns extracted records without seeding
15. ✓ add_source appends a source record and upserts profile

**Project test total now 74/74** (was 59 — Plan 5).

## Verification

- `npm test -- tests/profileRoute.test.ts` → 15/15 green
- `npm test` → 74/74 green (12 test files)
- `npm run build` → exit 0; route registered as `ƒ /api/kotoiq/profile` (server-rendered on demand)
- `npm run lint` → exit 0; kotoiq/no-unscoped-kotoiq rule clean
- `grep "body\.agency_id" src/app/api/kotoiq/profile/route.ts` → 1 hit, in a comment documenting the security rule (NOT a code read)
- `grep -E "supabase\.from\('kotoiq_|sb\.from\('kotoiq_" src/app/api/kotoiq/profile/route.ts` → 0 hits (every kotoiq_* access goes through getKotoIQDb)

## Manual smoke (curl envelope — operator runs after login)

```bash
# Get a fresh JWT from a dev login first, then:
curl -s -X POST https://hellokoto.com/api/kotoiq/profile \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"list_profile"}'
# Expected: 200 { "profiles": [ { id, client_id, ... }, ... ] }

curl -s -X POST https://hellokoto.com/api/kotoiq/profile \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"seed","client_id":"<UUID>"}'
# Expected: 200 { "profile": {...}, "discrepancies": [...], "sources_added": [...] }
# OR 404 { "error": "Client not found" } if the UUID belongs to a different agency
```

(Smoke test deferred to operator verification on hellokoto.com — local Anthropic + live Supabase not exercised in this plan; the contract matches what stream_seed already calls in production.)

## New env var requirements surfaced

**None.** Every required env var (ANTHROPIC_API_KEY, SUPABASE_*, TELNYX_API_KEY, TELNYX_MESSAGING_PROFILE_ID, TELNYX_DEFAULT_FROM, RESEND_API_KEY, NEXT_PUBLIC_APP_URL) is already documented in `_knowledge/env-vars.md` and inherited by the underlying Plan 2-5 modules this route composes.

## Deviations from Plan

### Auto-fixed (Rule 1 — Bug fix)

**1. [Rule 1 - Bug] Plan pseudocode used `db.raw().from(...)` — method doesn't exist**
- **Found during:** Task 1 GREEN
- **Issue:** Plan 6 pseudocode (matching Plans 4 + 5 prior pseudocode) called `db.raw().from('clients')` and `db.raw().from('agencies')`. The `KotoIQDb` interface (Plan 1, src/lib/kotoiqDb.ts:58-155) has NO `raw()` method. It exposes `client: SupabaseClient` (raw service-role client) and `from(table)` (auto-scoping helper).
- **Fix:** Replaced every `db.raw().from(...)` call with `sb.from(...)` where `const sb: any = db.client`, plus explicit `.eq('agency_id', agencyId)` for non-kotoiq tables (matches the same pattern Plans 4 + 5 standardised on).
- **Files modified:** src/app/api/kotoiq/profile/route.ts (lines 116, 396, 405)
- **Commit:** db94c55

**2. [Rule 1 - Bug] Plan import suggested CANONICAL_FIELD_NAMES from profileConfig — actually exported from profileTypes**
- **Found during:** Task 1 GREEN
- **Issue:** Plan pseudocode imported `CANONICAL_FIELD_NAMES` from `profileConfig`, but profileConfig.ts only exports `HOT_COLUMNS` (the first 11 names). The full 26-name canonical list is in profileTypes.ts (lines 55-85).
- **Fix:** `import { CANONICAL_FIELD_NAMES } from '../../../../lib/kotoiq/profileTypes'`
- **Files modified:** src/app/api/kotoiq/profile/route.ts (line 5)
- **Commit:** db94c55

### Auto-fixed (Rule 2 — Add missing critical functionality)

**3. [Rule 2 - Auth gate] 401 also fires when verified=true but agencyId=null**
- **Found during:** Task 1 GREEN
- **Issue:** Plan only checked `!session.verified` for 401. But `verifySession` can return `verified: true` with `agencyId: null` (e.g. an authenticated user not yet linked to any agency). The route would then call `getKotoIQDb(null)` which throws.
- **Fix:** `if (!session.verified || !session.agencyId) return err(401, 'Unauthorized')` — fail-closed before any helper instantiation.
- **Files modified:** src/app/api/kotoiq/profile/route.ts (line 86)
- **Commit:** db94c55
- **Test added:** "returns 401 when verified but agencyId missing" — explicit coverage so this guard can't regress.

**4. [Rule 2 - PROF-05 audit] reject_field upsert needs explicit client_id**
- **Found during:** Task 1 GREEN
- **Issue:** Plan pseudocode passed `{ fields, last_edited_at }` to upsert but the kotoiqDb.clientProfile.upsert helper expects `client_id` to look up the row (line 343-352 of kotoiqDb.ts). Without it, the upsert would fail or insert a new orphan row.
- **Fix:** Always include `client_id: body.client_id` in the upsert payload.
- **Files modified:** src/app/api/kotoiq/profile/route.ts (line 287)
- **Commit:** db94c55

**5. [Rule 2 - Defense in depth] Don't pass agency_id from route to db.clientProfile.upsert**
- **Found during:** Task 1 test fix
- **Issue:** Plan pseudocode passed `agency_id: agencyId` to the upsert helper. The helper auto-injects `agency_id` (kotoiqDb.ts:343-352). Passing it from the route created two write paths for the same field — defense-in-depth dictates only the helper writes agency_id so cross-agency writes are structurally impossible.
- **Fix:** Removed `agency_id: agencyId` from every `db.clientProfile.upsert` call. The helper does it.
- **Files modified:** src/app/api/kotoiq/profile/route.ts (lines 222, 287, 311, 478) + tests/profileRoute.test.ts (line 415)
- **Commit:** db94c55

## Auth gates encountered

**None.** All required env vars present in the dev environment; no Anthropic / Supabase / Telnyx / Resend calls in this plan (all those calls live in the lib modules this route composes — already covered by prior plans). Tests use vi.mock for every external module so no live network access during verification.

## Threat surface scan

This plan implements the EXACT threat surface declared in the plan's `<threat_model>` (T-07-01d, T-07 link enum, T-07-03, T-07-07b, T-07-18, T-07-19, T-07-20). Every threat has a corresponding mitigation in code AND a test case. No additional threat surface introduced.

## Self-Check: PASSED

**Files:**
- `src/app/api/kotoiq/profile/route.ts` — FOUND
- `tests/profileRoute.test.ts` — FOUND

**Commits:**
- `9e7bcb4` (test RED) — FOUND
- `db94c55` (feat GREEN + test fix) — FOUND

**Verification:**
- 15/15 vitest cases pass
- 74/74 project total
- Build clean (route registered)
- Lint clean (kotoiq/no-unscoped-kotoiq green)
- 0 reads of body.agency_id (1 hit is in a comment)
- 0 unscoped supabase.from('kotoiq_*') calls
