---
phase: 08-client-profile-seeder-v2-external-source-parsers
plan: 06
subsystem: kotoiq-client-profile-seeder-v2
tags: [kotoiq, gbp, google-business-profile, oauth, places-api, profile-seeder]
requires:
  - 08-01 (SOURCE_CONFIG.gbp_authenticated/gbp_public ceilings, FEATURE_TAGS.GBP_AUTH_EXTRACT/GBP_PUBLIC_EXTRACT/GBP_REVIEW_THEMES, RATE_LIMITS.CONNECT_GBP_OAUTH_START_PER_AGENCY_PER_HOUR, koto_agency_integrations table)
  - 08-02 (checkBudget, applyOverride, checkRateLimit)
  - 08-03 (encryptSecret/decryptSecret envelope-encryption vault + agencyIntegrations db helper)
provides:
  - generateConsentUrl / validateState / decodeState / exchangeCode / refreshAccessToken (profileGBPOAuth.ts)
  - pullFromGBPAuth + summarizeReviewThemes + formatHours (profileGBPPull.ts)
  - pullFromGBPPlaces (profileGBPPlaces.ts)
  - GET /api/kotoiq/profile/oauth_gbp/start (Google consent redirect + state cookie)
  - GET /api/kotoiq/profile/oauth_gbp/callback (state verification + code exchange + encrypted token upsert)
  - connect_gbp_oauth_start / list_gbp_locations / seed_gbp_auth / seed_gbp_places actions on /api/kotoiq/profile
affects:
  - /api/kotoiq/profile route dispatcher (4 new actions added to ALLOWED_ACTIONS)
  - koto_agency_integrations table (rows with integration_kind = gbp_agency_oauth | gbp_client_oauth)
  - Plan 08 Launch Page UI will bind the GBP connect wizard + three seed actions
tech-stack:
  added: [Google OAuth 2.0 (business.manage scope), Google Business Information API v1, Google Business Account Management API v1, Google My Business Reviews (legacy v4), Google Places API (New) v1]
  patterns:
    - HMAC-SHA256 signed OAuth state cookie (httpOnly, secure, sameSite=lax, 10 min TTL) bound to agencyId via HMAC key=CLIENT_SECRET
    - Timing-safe state comparison via Buffer.compare
    - 401 → refreshAccessToken → persist encrypted → retry-once pattern on Business Information API
    - Haiku strict-JSON review-theme summarization (no tool-use; raw JSON output)
    - Places API (New) mandatory X-Goog-FieldMask + X-Goog-Api-Key headers
key-files:
  created:
    - src/lib/kotoiq/profileGBPOAuth.ts
    - src/lib/kotoiq/profileGBPPull.ts
    - src/lib/kotoiq/profileGBPPlaces.ts
    - src/app/api/kotoiq/profile/oauth_gbp/start/route.ts
    - src/app/api/kotoiq/profile/oauth_gbp/callback/route.ts
    - tests/kotoiq/phase8/profileGBPOAuth.test.ts
    - tests/kotoiq/phase8/profileGBPPull.test.ts
    - tests/kotoiq/phase8/profileGBPPlaces.test.ts
  modified:
    - src/app/api/kotoiq/profile/route.ts (+4 actions: connect_gbp_oauth_start, list_gbp_locations, seed_gbp_auth, seed_gbp_places)
    - _knowledge/env-vars.md (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_PLACES_API_KEY documented)
decisions:
  - Single multi-plan commit (75ac2ff "feat(08): implement Phase 8 — external source parsers (PROF-07..11)") shipped plans 04-07 as one unit; per-task atomic commits were consolidated ahead of this executor run.
  - HMAC key for OAuth state signing = GOOGLE_OAUTH_CLIENT_SECRET (already a 40+ char high-entropy secret; no separate secret needed). Trade-off: rotating client secret rotates existing in-flight state cookies, which is acceptable since state TTL is 10 min.
  - Reviews API uses legacy v4 endpoint (mybusiness.googleapis.com/v4) — Google has not yet migrated reviews to the v1 Business Profile API surface as of 2026-04. Flagged for re-verification each deploy.
  - Places API FieldMask kept broad (13 fields) for v1; tighten later if preview deploys show 400s on specific fields.
metrics:
  completed: 2026-04-20
  tasks_completed: 3 of 4 (Task 4 is human-action: Google Cloud Console setup + Vercel env vars — blocking end-to-end verification)
  commit_hash: 75ac2ff (shared across Phase 8 Plans 04-07)
---

# Phase 8 Plan 06: GBP 3-Mode Connection + Authenticated/Public Pulls + Review-Theme Summarization

**One-liner:** Ships PROF-09 — Agency OAuth, per-client OAuth, and public Places API fallback for Google Business Profile ingestion, each emitting `ExtractedFieldRecord[]` with source-type-differentiated confidence ceilings (0.85 authenticated / 0.75 public) and Haiku-summarized review themes piped into `pain_point_emphasis`.

## What Shipped

Three library modules + two Next.js route handlers + four actions wired into the existing `/api/kotoiq/profile` dispatcher:

1. **`profileGBPOAuth.ts`** — consent URL generation (scope=`business.manage`, access_type=offline, prompt=consent), crypto-random 32-byte nonce packed into base64url state, HMAC-SHA256 state signing bound to `agencyId` (key = `GOOGLE_OAUTH_CLIENT_SECRET`), timing-safe `validateState`, `decodeState` for payload recovery, `exchangeCode` + `refreshAccessToken` against `oauth2.googleapis.com/token`.

2. **`profileGBPPull.ts`** — `pullFromGBPAuth` hits Business Information API v1 with `readMask=title,categories,phoneNumbers,websiteUri,regularHours,serviceArea,profile,storefrontAddress,labels`. On 401 → refreshes token → re-encrypts + upserts `koto_agency_integrations.encrypted_payload` → retries once. Maps GBP fields → `business_name | primary_service | phone | website | service_area | hours`. Calls `summarizeReviewThemes` (Haiku strict-JSON) against up to 50 reviews from the legacy `mybusiness.googleapis.com/v4/.../reviews` endpoint; themes flow to `pain_point_emphasis` records at confidence ≤ 0.7.

3. **`profileGBPPlaces.ts`** — `pullFromGBPPlaces` POSTs to `places.googleapis.com/v1/places/{place_id}` with mandatory `X-Goog-Api-Key` + `X-Goog-FieldMask` headers. Maps Places response → `business_name | primary_service | phone | website | city`. Embedded `place.reviews` feed back through `summarizeReviewThemes` with `sourceType='gbp_public'` (max 5 reviews, confidence ≤ 0.6).

4. **OAuth start route** (`/api/kotoiq/profile/oauth_gbp/start`) — rate-limited (5/agency/hour per `checkRateLimit`), sets `koto_oauth_gbp_state` httpOnly+secure+sameSite=lax cookie (maxAge 600s), 302-redirects to Google consent.

5. **OAuth callback route** (`/api/kotoiq/profile/oauth_gbp/callback`) — reads cookie via `await cookies()` (Next.js dynamic-async cookies API), validates HMAC-signed state, decodes payload, exchanges code, encrypts `{access_token, refresh_token, expires_at, scope}` JSON via `encryptSecret` bound to agency AAD, upserts `koto_agency_integrations` row with `integration_kind='gbp_agency_oauth'` or `'gbp_client_oauth'`, clears cookie, 302-redirects to `redirectAfter` with `?gbp_connected=1`.

6. **Route dispatcher** (`/api/kotoiq/profile`) gains four GBP actions mirroring the `seed_form_url` pattern: rate-limit → budget check → (decrypt token when needed) → call library → feed records into `seedProfile({ externalRecords })` merge ladder.

## Google Endpoints Used (capture for drift-detection)

| Purpose | Endpoint |
|---------|----------|
| OAuth consent | `https://accounts.google.com/o/oauth2/v2/auth` |
| OAuth token exchange / refresh | `https://oauth2.googleapis.com/token` |
| List accounts | `https://mybusinessaccountmanagement.googleapis.com/v1/accounts` |
| List locations | `https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations?readMask=...` |
| Location detail | `https://mybusinessbusinessinformation.googleapis.com/v1/{location}?readMask=title,categories,phoneNumbers,websiteUri,regularHours,serviceArea,profile,storefrontAddress,labels` |
| Reviews (legacy) | `https://mybusiness.googleapis.com/v4/{location}/reviews?pageSize=50` |
| Places API (New) detail | `https://places.googleapis.com/v1/places/{place_id}` with `X-Goog-FieldMask: displayName,formattedAddress,regularOpeningHours,primaryType,types,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,reviews,editorialSummary,googleMapsUri` |

## readMask Actually Used (Business Information API)

```
title,categories,phoneNumbers,websiteUri,regularHours,serviceArea,profile,storefrontAddress,labels
```

Drop `labels` if preview deploys 400 on it (Google has deprecated it for some verticals).

## Places API (New) FieldMask

```
displayName,formattedAddress,regularOpeningHours,primaryType,types,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,reviews,editorialSummary,googleMapsUri
```

If a field 400s in live testing, strip it and narrow the mask.

## OAuth Redirect URIs to Register (Google Cloud Console)

- `https://hellokoto.com/api/kotoiq/profile/oauth_gbp/callback` (production)
- `https://<preview-slug>.vercel.app/api/kotoiq/profile/oauth_gbp/callback` (each preview that needs OAuth; Google does not accept wildcards)

## Reviews Endpoint — IN FLUX FLAG

The plan explicitly asked us to verify whether reviews have migrated off the legacy v4 surface. As of the build date (2026-04-20), Google had NOT migrated reviews to the v1 Business Profile API surface — the canonical source remains `mybusiness.googleapis.com/v4/{location}/reviews`. Re-verify on each deploy; if v4 starts returning 404, swap to the v1 reviews endpoint when Google publishes it.

## Security Properties (Threat Register Mitigations)

- **T-08-50 (OAuth state CSRF):** 32-byte crypto-random nonce + HMAC-SHA256(state, agencyId) stored in http-only secure sameSite=lax cookie with 10-min TTL. Callback uses `Buffer.compare` (timing-safe). Mismatch → 400.
- **T-08-51 (Refresh token exfiltration):** Plan 03 `encryptSecret` with agency_id AAD; cross-agency decrypt throws `DECRYPT_AAD_MISMATCH`.
- **T-08-53 (Billing DoS via OAuth start spam):** `checkRateLimit({ actionKey: 'connect_gbp_oauth_start' })` → 5/agency/hour sliding window → 429.
- **T-08-54 (Places key client-side exposure):** `GOOGLE_PLACES_API_KEY` read only in server-only `profileGBPPlaces.ts`; never returned to the browser.
- **T-08-55 (Cross-agency token injection):** `verifySession()` on every route; `session.agencyId` is the only source of truth; request body `agency_id` is ignored.
- **T-08-56 (Prompt injection via review text):** Haiku prompt enforces strict JSON output; parse failures return `[]`. Review themes only flow into `pain_point_emphasis`, never into hot-column fields.
- **T-08-57 (Token refresh not audited):** Accepted residual — refresh events visible via `koto_token_usage WHERE feature='profile_gbp_auth_extract'`.
- **T-08-58 (OAuth params in browser history):** Callback responds with 302 to a clean destination (code/state only ever appear on the single callback URL).
- **T-08-59 (Per-client token reuse across clients):** `scope_client_id` column prevents cross-tenant binding.

## Deviations from Plan

### Execution-time deviations

**1. [Rule 2 — Missing docs] Added Google OAuth env vars section to `_knowledge/env-vars.md`**
- **Found during:** Summary wrap-up — Task 1's `<action>` block mandated the env-vars.md update, but it was not present in the previously shipped commit.
- **Fix:** Added a "Google OAuth / GBP" section with `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_PLACES_API_KEY`, each with purpose + Cloud Console restriction guidance and the list of redirect URIs operators must register.
- **Files modified:** `_knowledge/env-vars.md`
- **Commit:** (pending this summary commit)

### Plan-vs-implementation differences

- **ExtractedFieldRecord import:** The plan's pseudocode had the pullers import `ProvenanceRecord` directly from `./profileTypes`. The implementation uses `ExtractedFieldRecord` from `./profileExtractClaude`, which wraps the record with `{ field_name, record }` — this matches the shape `seedProfile({ externalRecords })` already consumes (same shape as the website crawl and form parser outputs). Strictly a naming-and-wrapper adjustment; the provenance contract is preserved.
- **Token-usage logging keys:** The plan referenced `input_tokens` / `output_tokens`; the actual `logTokenUsage` helper uses `inputTokens` / `outputTokens` (camelCase). The implementation matches the helper's real signature.
- **`list_gbp_locations` pagination:** Capped at first 10 accounts + first page of locations per account (no cursor iteration) — pragmatic v1 cutoff. Agencies with > 10 GBP accounts need pagination in a follow-up.

### Auth gates

Task 4 is a checkpoint requiring human action in Google Cloud Console + Vercel env var config. End-to-end OAuth cannot complete in any env (prod or preview) until a human:
1. Enables Business Profile API (or "My Business Business Information API" + "My Business Account Management API") + Places API (New) in the chosen Cloud project.
2. Creates the OAuth 2.0 Web application client with the redirect URIs listed above.
3. Creates a server-side Places API key (no HTTP referrer restriction; API restricted to Places API).
4. Sets `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_PLACES_API_KEY` in Vercel **Production + Preview** envs.
5. Redeploys + probes `/api/kotoiq/profile/oauth_gbp/start?mode=agency` → consents → confirms `?gbp_connected=1` landing + new `koto_agency_integrations` row with `integration_kind='gbp_agency_oauth'`.

This is normal operator setup (not a defect).

## Verification

| Check | Status |
|-------|--------|
| `export function generateConsentUrl/validateState/exchangeCode/refreshAccessToken` in profileGBPOAuth.ts | PASS (9 matches for the 7 grep patterns) |
| `'gbp_authenticated'` + `pullFromGBPAuth` + `refreshAccessToken` in profileGBPPull.ts | PASS (12 pattern matches) |
| `X-Goog-FieldMask` + `X-Goog-Api-Key` + `'gbp_public'` + `pullFromGBPPlaces` in profileGBPPlaces.ts | PASS (9 pattern matches) |
| 4 GBP actions in `/api/kotoiq/profile` ALLOWED_ACTIONS | PASS (13 pattern matches — each action is referenced in both the ALLOWED_ACTIONS constant + its handler block) |
| OAuth start route: `koto_oauth_gbp_state` httpOnly + `dynamic = 'force-dynamic'` | PASS |
| OAuth callback route: `koto_oauth_gbp_state` + `validateState` | PASS |
| Test files shipped (profileGBPOAuth.test.ts, profileGBPPull.test.ts, profileGBPPlaces.test.ts) | PASS — all three present in `tests/kotoiq/phase8/` |
| Runtime `vitest` execution | NOT RUN (executor sandbox blocked Bash for test execution) |
| `npx tsc --noEmit` | NOT RUN (executor sandbox blocked Bash) |

Verification dependency on Task 4: the end-to-end live OAuth flow requires Google Cloud Console setup + Vercel env var configuration — blocking, human-action.

## Deferred Issues

- **Live `vitest run` confirmation:** Executor could not run `npx vitest` in this sandbox. All 3 test files exist on disk (sized 5466–8906 bytes) and mirror the behavior contract; authors should run `npx vitest run tests/kotoiq/phase8/profileGBPOAuth.test.ts tests/kotoiq/phase8/profileGBPPull.test.ts tests/kotoiq/phase8/profileGBPPlaces.test.ts` locally before marking Phase 8 closed.
- **Token refresh audit gap (T-08-57):** Accepted residual — no dedicated `koto_audit_log` row for token refresh events.
- **`list_gbp_locations` pagination:** First 10 accounts only. Extend when an agency reports missing locations.
- **Reviews endpoint drift:** Legacy v4 — revisit when Google publishes the Business Profile v1 reviews surface.

## Self-Check: PASSED

- `src/lib/kotoiq/profileGBPOAuth.ts` FOUND (158 lines, 5298 bytes)
- `src/lib/kotoiq/profileGBPPull.ts` FOUND (235 lines, 9103 bytes)
- `src/lib/kotoiq/profileGBPPlaces.ts` FOUND (123 lines, 4488 bytes)
- `src/app/api/kotoiq/profile/oauth_gbp/start/route.ts` FOUND (43 lines)
- `src/app/api/kotoiq/profile/oauth_gbp/callback/route.ts` FOUND (62 lines)
- `tests/kotoiq/phase8/profileGBPOAuth.test.ts` FOUND
- `tests/kotoiq/phase8/profileGBPPull.test.ts` FOUND
- `tests/kotoiq/phase8/profileGBPPlaces.test.ts` FOUND
- Shipping commit 75ac2ff FOUND in git log (contains all above files as part of consolidated Phase 8 commit)
- 4 GBP actions present in `/api/kotoiq/profile` route.ts (grep confirmed)
