---
phase: 08-client-profile-seeder-v2-external-source-parsers
verified: 2026-04-21T21:22:00Z
status: human_needed
score: 5/5 roadmap success-criteria have implementation evidence; 5/5 requirements have code artifacts; operator setup + schema push + live UAT still required before pilot
re_verification: false
verifier: gsd-verifier
plans_verified:
  - plan: "08-01"
    status: passed
    note: "11 SOURCE_TYPES + SOURCE_CONFIG + BUDGETS + RATE_LIMITS + koto_agency_integrations migration + vault fixture all present; migration push to Supabase DEFERRED by design"
  - plan: "08-02"
    status: passed
    note: "checkBudget / applyOverride / estimateCost / checkRateLimit all present and exercised by 24 tests"
  - plan: "08-03"
    status: passed
    note: "AES-256-GCM vault + /api/kotoiq/integrations 5-action dispatcher present; runtime blocked on Plan 01 migration push + KEK env var"
  - plan: "08-04"
    status: passed
    note: "Typeform/Jotform/Google Forms/Playwright-scrape adapters all present with real HTTP calls; seed_form_url route action wired"
  - plan: "08-05"
    status: passed
    note: "SSRF guard + robots + crawl + seed_website action + Playwright probe route all present; Fluid Compute probe needs live preview deploy"
  - plan: "08-06"
    status: passed
    note: "generateConsentUrl/exchangeCode/refreshAccessToken + pullFromGBPAuth/Places + 4 actions wired; blocked on Google Cloud Console setup + Vercel env vars"
  - plan: "08-07"
    status: passed
    note: "detectFileType + upload storage + PDF/DOCX/Image extractors + seed_upload/list_uploads actions present; multipart route enforces 25 MB + 415 gates"
automated_verification:
  test_suite: "npx vitest run tests/kotoiq/phase8/"
  result: "232/232 passed across 24 test files"
  tsc_result: "npx tsc --noEmit — clean (exit 0)"
  migration_file_present: true
  migration_pushed: false  # Deferred per deferred-items.md
deferred:
  - truth: "koto_agency_integrations table exists in live Supabase"
    addressed_in: "operator action — supabase db push after resolving access token + pending migration cross-contamination"
    evidence: "deferred-items.md Plan 08-01 Task 3; acknowledged in Plan 03 via isTableMissingError 503 sentinel; matches Phase 7 kotoiq_pipeline_runs precedent"
  - truth: "KOTO_AGENCY_INTEGRATIONS_KEK set in Vercel for production + preview + dev"
    addressed_in: "operator action"
    evidence: "Plan 03 SUMMARY — 'openssl rand -hex 32' + Vercel dashboard entry required before Plan 04 form API paths work"
  - truth: "GOOGLE_OAUTH_CLIENT_ID / SECRET / PLACES_API_KEY set in Vercel + OAuth redirect URIs registered in Google Cloud Console"
    addressed_in: "operator action"
    evidence: "Plan 06 SUMMARY Task 4 (Google Cloud Console setup) + env-vars.md lines 27-29"
  - truth: "Playwright on Vercel Fluid Compute verified via live /api/kotoiq/debug/playwright_probe GET"
    addressed_in: "preview deploy smoke test"
    evidence: "Plan 05 Wave 0 infra probe; route file present at src/app/api/kotoiq/debug/playwright_probe/route.ts"
human_verification:
  - test: "Push migration 20260520_kotoiq_agency_integrations.sql to live Supabase"
    expected: "`supabase db pull --schema public --dry-run | grep -c koto_agency_integrations` → 1"
    why_human: "Executor has no SUPABASE_ACCESS_TOKEN; push would also include unrelated pending migrations (20260524_koto_pipelines.sql, 20260524_momenta_default_pipeline.sql) currently uncommitted in main"
  - test: "Provision KOTO_AGENCY_INTEGRATIONS_KEK in Vercel"
    expected: "`openssl rand -hex 32` output set in Production + Preview + Development; vault encryptSecret() succeeds without throwing 'KEK not set'"
    why_human: "Secret rotation + Vercel dashboard action — not executable by an agent"
  - test: "Register Google Cloud Console OAuth client + redirect URIs + Places API key; set 3 env vars in Vercel"
    expected: "`/api/kotoiq/profile/oauth_gbp/start?mode=agency` 302s to accounts.google.com consent screen; consent completes → callback lands at /kotoiq/launch?gbp_connected=1; koto_agency_integrations row with integration_kind='gbp_agency_oauth' appears"
    why_human: "GCP Console config + OAuth consent screen approval + URL list entry all require operator sign-in to Google + Vercel"
  - test: "Smoke-test Playwright on Vercel Fluid Compute via probe route"
    expected: "GET /api/kotoiq/debug/playwright_probe returns 200 + { ok: true, title: 'Example Domain' }"
    why_human: "Only meaningful against a preview deploy; local ts-node cannot emulate the Fluid Compute Lambda bundle + Chromium layer"
  - test: "End-to-end seed_form_url against a real Typeform public share URL"
    expected: "Pasting a real public Typeform URL seeds the client profile with Q&A-derived fields at source_type='typeform_api' and confidence ≤0.9; fallback path runs against same URL without API key and seeds at source_type='form_scrape' ≤0.7"
    why_human: "Requires a real Typeform form URL + agency API key; cross-API-cost concerns mean no automated fixture for this"
  - test: "End-to-end seed_website against momentamktg.com (or a pilot client site)"
    expected: "Scope-A targeted crawl completes within ~60s; ~5-10 pages_crawled; extracted records merged into profile at source_type='website_scrape' ≤0.6; cost_spent_usd under default $1.50 cap"
    why_human: "Live Playwright crawl against real site + Sonnet API costs; requires operator kick + review of extracted fields for quality"
  - test: "End-to-end seed_upload against a real PDF proposal + a scanned PDF + a HEIC business-card photo"
    expected: "Text PDF extracts via pdf-parse at source_type='pdf_text_extract' ≤0.75; scanned PDF falls through to Vision at source_type='pdf_image_extract' ≤0.6; HEIC image extracts via sharp→JPEG→Vision at source_type='image_ocr_vision' ≤0.6"
    why_human: "Real file uploads against Supabase Storage bucket; sharp HEIC→JPEG conversion needs native binary + memory headroom only verifiable in deployed environment"
  - test: "UAT blockers from Phase 7 resolved: /api/kotoiq/profile 401 bug + Sidebar React 19/Turbopack crash"
    expected: "Pasting the /onboard/:clientId URL into IngestPanel on /kotoiq/launch/:clientId successfully seeds profile instead of 401ing"
    why_human: "Phase 7 UAT blocker carries forward — Phase 8 UI actions sit on top of the same /api/kotoiq/profile route that's currently unreachable per STATE.md lines 138-147. This is the gating item before any Phase 8 human UAT can happen."
  - test: "Phase 8 operator UI (IngestPanel URL-detection branch + GBP connect wizard + DropZone upload) wired"
    expected: "IngestPanel detects Typeform/Jotform/Google Forms/website URLs and shows options panel; GBP connect wizard triggers OAuth flow; DropZone real upload → seed_upload path; cost preview visible before Go button"
    why_human: "No UI consumer currently references seed_form_url / seed_website / seed_upload / seed_gbp_* / connect_gbp_* actions (grep -rl against src/app + src/components + src/views found zero callers). Plan 08 (UI) was planned but no 08-08-PLAN or 08-08-SUMMARY exists in the phase directory. Either Plan 08 was intentionally deferred as post-gate work, or the UI wiring was lost."
---

# Phase 8: Client Profile Seeder v2 — External Source Parsers Verification Report

**Phase Goal:** Extend Stage 0 profile seeder to ingest external onboarding forms, client websites, Google Business Profile, and uploaded documents/images — every external source flows into `kotoiq_client_profile.fields` via the same Phase 7 provenance + entity-graph contract.

**Verified:** 2026-04-21T21:22:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Summary

Plans 01-07 are **code complete**. Every file listed in every SUMMARY exists on disk, every claimed export resolves, every claimed action is wired into `/api/kotoiq/profile`, all 232 tests across 24 test files pass, and `tsc --noEmit` is clean. No stubs, no missing imports, no fake return values in the hot paths.

**Passing gate:** automated verification and code-backed claims match the summaries 1:1.

**Not passing:** four categories of work require human operator action before Phase 8 delivers user-visible value. They are all explicitly documented as deferred by the plans themselves — they are not hidden defects — but they are real pre-UAT gaps:

1. **Supabase migration not pushed** — `20260520_kotoiq_agency_integrations.sql` exists as a file but has never been run against live Supabase. Until it is, Plans 03/04/06 will fail at runtime on first write (mitigated by Plan 03's `503 integrations_table_missing` sentinel).
2. **Secrets not provisioned** — `KOTO_AGENCY_INTEGRATIONS_KEK` + Google OAuth/Places keys not verified in Vercel; Plan 03 vault encrypt will throw, Plan 06 GBP flow cannot start.
3. **Playwright on Vercel Fluid Compute not smoke-tested in production environment** — probe route exists but has not been run against a preview deploy to confirm bundle + Chromium layer is viable.
4. **Operator UI wiring is absent** — no consumer in `src/components/` or `src/views/` references any Phase 8 action. Plan 08 (UI) was mentioned in every plan's "affects" list as the caller, but no `08-08-PLAN.md` or `08-08-SUMMARY.md` was produced. Phase 8 today is an API-and-library phase with no UI surface.

Plus the **carry-forward Phase 7 UAT blockers** (React 19 Turbopack + `/api/kotoiq/profile` 401) — these affect Phase 8 identically since Phase 8 extends the same route and the same Launch Page.

---

## Goal Achievement — Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Operator pastes a Typeform / Jotform / Google Forms public share link → profile populates with Q&A pairs mapped to canonical fields, low-confidence extractions flagged for review | VERIFIED (code) · HUMAN NEEDED (e2e) | `pullFromTypeform`/`pullFromJotform`/`pullFromGoogleForms` + `seedFromFormUrl` + `detectFormProvider` + `seed_form_url` route action all present; confidence clamped via `SOURCE_CONFIG.{typeform_api,jotform_api,google_forms_api}.confidence_ceiling` (0.9) and `SOURCE_CONFIG.form_scrape.confidence_ceiling` (0.7); 32 tests pass |
| 2 | Operator pastes a client's existing website URL → Playwright crawls About/Services/Contact/Locations/Team → profile + Stage 2 entity graph seeded with extracted entities + per-page citations | VERIFIED (code) · HUMAN NEEDED (e2e) | `crawlWebsite` + `refuseIfInternalIp` + `parseRobots`/`isAllowedForCrawl` + `seed_website` route action present; 3 crawl scopes (A targeted / B BFS / C sitemap) wired; 32+17+12 tests pass; Playwright probe route present but not yet smoke-tested on Fluid Compute |
| 3 | Operator connects a client's Google Business Profile via GMB API → LocalBusiness fields, service categories, hours, service area, review themes merged into profile | VERIFIED (code) · HUMAN NEEDED (e2e) | `generateConsentUrl`/`validateState`/`exchangeCode`/`refreshAccessToken` + `pullFromGBPAuth` + `pullFromGBPPlaces` + `summarizeReviewThemes` + start/callback routes + 4 dispatcher actions (`connect_gbp_oauth_start`, `list_gbp_locations`, `seed_gbp_auth`, `seed_gbp_places`) all present; 26 tests pass; blocked on GCP Console setup |
| 4 | Operator uploads a PDF, DOCX, or image (proposal, brochure, sales deck, business card) → OCR where needed → Claude extracts structured fields with per-chunk citation | VERIFIED (code) · HUMAN NEEDED (e2e) | `detectFileType` (magic-byte) + `uploadToStorage` (agency-scoped) + `extractFromPdf`/`extractFromDocx`/`extractFromImage` + `seedFromUpload` + `seed_upload`/`list_uploads` actions + multipart `/api/kotoiq/profile/upload` route with 25 MB gate and 415 unsupported-type gate all present; 52 tests pass |
| 5 | All external-source ingests are visible in `kotoiq_client_profile.sources` with `source_type`, `source_url` (or upload hash), confidence per field, and `captured_at` — fully auditable from the per-client profile view | VERIFIED (code) · PARTIAL (UI) | All 11 new `SOURCE_TYPES` values present; `SOURCE_CONFIG` registry enforces per-source `confidence_ceiling`; each puller sets `source_type` + `source_url`/`source_ref` + `confidence` in emitted records; `sources` jsonb registry extended per Phase 7 D-09 shape; 7 `sourcesRegistry` tests pass. **Per-client profile view UI that surfaces this does not yet consume Phase 8 actions** — see Human Verification #9. |

**Score (roadmap SCs):** 5/5 have implementation evidence; 5/5 need live human verification to close the loop from "code ships" → "feature works end-to-end".

---

## Plan-by-Plan Verification

### Plan 08-01 — Foundation: SOURCE_TYPES + SOURCE_CONFIG + koto_agency_integrations

**Status: PASSED (code)**

| Claim from SUMMARY | Verification | Result |
|---|---|---|
| 11 new SOURCE_TYPES in profileTypes.ts | Read profileTypes.ts — lines 28-39 list all 11 values in Phase 8 order | PASS |
| SOURCE_CONFIG Record with confidence ceilings matching D-04/09/12/19 | Read profileConfig.ts lines 151-168; typeform_api=0.9, website_scrape=0.6, gbp_authenticated=0.85, gbp_public=0.75, image_ocr_vision=0.6 all match | PASS |
| BUDGETS = {5,50,0.8} + RATE_LIMITS = {10,5} | profileConfig.ts lines 172-184 | PASS |
| koto_agency_integrations migration DDL (13 cols + unique + RLS + trigger) | Read 20260520_kotoiq_agency_integrations.sql — 13 columns, unique on (agency_id,integration_kind,scope_client_id), RLS `agency_integrations_all` policy, per-table updated_at trigger function | PASS |
| DIRECT_AGENCY_TABLES includes 'koto_agency_integrations' | kotoiqDb.ts line 45 | PASS |
| agencyIntegrations helper (list/get/getByKind/upsert/delete/markTested) | kotoiqDb.ts lines 564-609 | PASS |
| tests/fixtures/anthropicVisionMock.ts with 3 exports | File exists; grep confirmed `mockAnthropicVisionCall`, `expectPdfDocumentBlock`, `expectImageBlock` | PASS |
| Migration pushed to Supabase | **DEFERRED** per deferred-items.md — not pushed | HUMAN ACTION |

**Gaps:** Migration push deferred by design; Plan 03 implements graceful 503 fallback.

---

### Plan 08-02 — Cost Guardrails

**Status: PASSED (code)**

| Claim | Verification | Result |
|---|---|---|
| profileCostEstimate.ts with estimateCost() | Exists; pure function; per-source rules | PASS |
| profileCostBudget.ts with checkBudget/applyOverride/getTodaySpend/checkRateLimit | All 4 exports present (lines 73, 134, 213, 284) + `__resetRateLimits` test hook (line 323) | PASS |
| Writes to koto_audit_log with action='cost_budget_override' | applyOverride lines 216-233; `action: 'cost_budget_override' as const` | PASS |
| In-process sliding-window rate-limit buckets | RATE_BUCKETS Map, filter by now-windowMs (lines 256-316) | PASS |
| 24 tests (11 estimate + 13 budget) | vitest run confirms 11 + 13 = 24 green | PASS |

**Gaps:** None at code level. T-08-12 (cross-instance rate-limit leak) is an accepted residual.

---

### Plan 08-03 — profileIntegrationsVault + /api/kotoiq/integrations

**Status: PASSED (code); BLOCKED (runtime prerequisites)**

| Claim | Verification | Result |
|---|---|---|
| profileIntegrationsVault.ts with encryptSecret/decryptSecret/testConnection | All three exports present; AES-256-GCM with `cipher.setAAD(Buffer.from(agencyId))` at lines 65 + 103 | PASS |
| VaultError with code discriminant (DECRYPT_AAD_MISMATCH / DECRYPT_AUTH_FAIL / DECRYPT_FORMAT) | Class at line 78; thrown at lines 95, 107 | PASS |
| /api/kotoiq/integrations with 5 actions | Exists; ALLOWED_ACTIONS at line 40 lists all 5; switch handles each | PASS |
| Deferred-migration 503 sentinel | `isTableMissingError` helper + `integrations_table_missing` return path — Plan 03 SUMMARY commit 07e9e9b | PASS |
| KOTO_AGENCY_INTEGRATIONS_KEK documented in env-vars.md | env-vars.md line 24 | PASS |
| 18 tests | vitest confirms 7 + 11 = 18 green | PASS |
| KEK actually set in Vercel | **NOT VERIFIABLE from executor** — requires `vercel env ls` | HUMAN ACTION |

**Gaps:** KEK env var provisioning is an operator action; encrypt/decrypt will throw until set. Mitigated by intentional "fail-closed" design at lines 58-63 (lazy KEK load throws "KEK not set").

---

### Plan 08-04 — Form Parsers (Typeform / Jotform / Google Forms / Scrape Fallback)

**Status: PASSED (code)**

| Claim | Verification | Result |
|---|---|---|
| profileFormDetect.ts + 3 API adapters + scrape + seeder | 6 files present at claimed paths | PASS |
| Typeform Bearer auth → extract → clamp to 0.9 | Read profileFormTypeform.ts lines 13-52; Bearer header, confidence min clamp to `SOURCE_CONFIG.typeform_api.confidence_ceiling` | PASS |
| Jotform APIKEY header auth (NOT querystring) — T-08-30 mitigation | Read profileFormJotform.ts line 18: `headers: { APIKEY: args.apiKey }`; zero querystring uses of apiKey | PASS |
| Google Forms 401 → refresh → retry-once + re-encrypt persist | profileFormGoogleForms.ts flow + refreshAccessToken + upsert with encryptSecret | PASS |
| Playwright OR Cheerio scrape with SSRF guard | profileFormScrape.ts imports `refuseIfInternalIp` from `profileWebsiteSSRFGuard` | PASS |
| seed_form_url route action wired | profile/route.ts lines 788-840; ALLOWED_ACTIONS line 90; rate-limit + budget + override + seedProfile merge all in sequence | PASS |
| detectFormProvider is server-only-free for UI use | profileFormDetect.ts line 4 comment confirms intentional omission | PASS |
| 36 tests across 6 files | vitest confirms 15+3+3+2+4+9 = 36 green | PASS |

**Gaps:** None at code level.

---

### Plan 08-05 — Website Crawl (SSRF / robots / BFS / Sitemap)

**Status: PASSED (code); UNCERTAIN (Fluid Compute runtime viability)**

| Claim | Verification | Result |
|---|---|---|
| profileWebsiteSSRFGuard.ts + Robots.ts + Crawl.ts | All 3 files present | PASS |
| refuseIfInternalIp handles 127/10/172.16/192.168/169.254/::1/fe80/fc00 | Source confirmed (hand-rolled, not ipaddr.js — documented deviation) | PASS |
| 3 crawl scopes (A targeted / B BFS / C sitemap) | crawlWebsite signature takes `scope: CrawlScope` | PASS |
| seed_website action wired with rate-limit + budget | profile/route.ts lines 723-785 | PASS |
| Playwright probe route at debug/playwright_probe | Exists; uses @sparticuz/chromium + playwright-core dynamic import; ok=true on example.com goto | PASS (code) / UNCERTAIN (Fluid Compute) |
| 61 tests (32 SSRF + 17 robots + 12 crawl) | vitest confirms green | PASS |
| SUMMARY "summary_authored_retroactively: true" | Noted in frontmatter; does not reduce code verification, but signals retroactive reconciliation | INFO |

**Gaps:** Fluid Compute smoke test not yet run against preview. Bundle size risk real (playwright-core + @sparticuz/chromium ≈ 200MB cold start).

---

### Plan 08-06 — GBP (OAuth + Authenticated Pull + Places Fallback)

**Status: PASSED (code); BLOCKED (GCP Console + Vercel env setup)**

| Claim | Verification | Result |
|---|---|---|
| profileGBPOAuth.ts (generateConsentUrl/validateState/decodeState/exchangeCode/refreshAccessToken) | All 5 exports at lines 33, 74, 86, 117, 140 | PASS |
| profileGBPPull.ts (pullFromGBPAuth + summarizeReviewThemes + formatHours) | All 3 exports at lines 37, 167, 154 | PASS |
| profileGBPPlaces.ts (pullFromGBPPlaces) | Export at line 30; uses X-Goog-Api-Key + X-Goog-FieldMask headers | PASS |
| OAuth start + callback routes | Both route.ts files present at profile/oauth_gbp/{start,callback}/ | PASS |
| 4 new actions (connect_gbp_oauth_start / list_gbp_locations / seed_gbp_auth / seed_gbp_places) | profile/route.ts lines 920-1015; all 4 handlers present with real fetch calls + rate-limit + budget checks | PASS |
| HMAC-SHA256 state signing with CLIENT_SECRET as key | Code reviewed | PASS |
| 401 → refresh → retry-once with re-encrypt | pullFromGBPAuth pattern mirrored from Google Forms | PASS |
| 26 tests (13+6+7) | vitest confirms green | PASS |
| 3 env vars documented in env-vars.md | env-vars.md lines 27-29 | PASS |
| GCP Console redirect URIs + env vars actually set | **NOT VERIFIABLE from executor** | HUMAN ACTION |
| Reviews API endpoint still using legacy v4 | SUMMARY flag acknowledged; periodic re-check required | INFO |

**Gaps:** GCP Console setup is an operator action (Plan 06 Task 4). OAuth flow cannot complete until redirect URIs registered + env vars set.

---

### Plan 08-07 — File Upload + OCR Pipeline

**Status: PASSED (code)**

| Claim | Verification | Result |
|---|---|---|
| profileUploadDetect.ts with detectFileType | Magic-byte classifier returning pdf/docx/png/jpeg/webp/heic/unknown | PASS |
| profileUploadStorage.ts with uploadToStorage + buildUploadPath + getSignedUrl + deleteUpload + downloadForProcessing + parseUploadPath | All 6 exports present | PASS |
| profileUploadPdf.ts (pdf-parse primary + Anthropic Vision fallback) | extractFromPdf at line 26 | PASS |
| profileUploadDocx.ts (mammoth + section-split + Sonnet per section) | extractFromDocx at line 22 | PASS |
| profileUploadImage.ts (sharp HEIC→JPEG + Vision) | extractFromImage at line 26 | PASS |
| profileUploadSeeder.ts dispatcher | seedFromUpload at line 25; routes by detectFileType | PASS |
| /api/kotoiq/profile/upload multipart route with 25 MB + 415 gates | Route present; MAX_BYTES=25*1024*1024; 413 and 415 paths both wired | PASS |
| seed_upload + list_uploads actions in profile/route.ts | Lines 843-917 | PASS |
| 52 tests across 6 files | vitest confirms 12+14+5+6+7+8 = 52 green | PASS |
| SUMMARY "summary_authored_retroactively: true" | Noted in frontmatter | INFO |

**Gaps:** None at code level.

---

## Requirements Coverage

| Requirement | Plan Owner | Description | Status | Evidence |
|---|---|---|---|---|
| PROF-07 | 08-04 | External form URL parsing (Typeform/Jotform/Google Forms/generic) | SATISFIED (code) / NEEDS HUMAN (e2e) | 6 library modules + `seed_form_url` route action + 36 green tests |
| PROF-08 | 08-05 | Website crawl → profile + Stage 2 entity graph | SATISFIED (code) / NEEDS HUMAN (e2e) | 3 library modules + `seed_website` route action + 61 green tests; Fluid Compute probe pending |
| PROF-09 | 08-06 | GBP connect → LocalBusiness/categories/hours/service area/review themes | SATISFIED (code) / BLOCKED (GCP setup) | 3 library modules + 2 OAuth routes + 4 dispatcher actions + 26 green tests |
| PROF-10 | 08-07 | Upload PDF/DOCX/image → OCR + extraction | SATISFIED (code) / NEEDS HUMAN (e2e) | 6 library modules + multipart upload route + seed_upload/list_uploads + 52 green tests |
| PROF-11 | 08-01 | External-source ingests visible in `kotoiq_client_profile.sources` jsonb with source_type/url/confidence/captured_at | SATISFIED (code) / PARTIAL (UI absent) | SOURCE_TYPES/SOURCE_CONFIG/sources jsonb schema all present; UI to surface them to operator is not wired (see Human #9) |

**Orphaned requirements:** None — REQUIREMENTS.md line 225 maps exactly PROF-07..11 to Phase 8, and all five have claiming plans.

---

## Anti-Pattern Scan

Scanned all files created in Plans 01-07 for stubs, TODOs, empty returns, hardcoded empty data, console.log-only handlers.

| Pattern Check | Result |
|---|---|
| TODO / FIXME / XXX / HACK in Phase 8 src files | Found 0 TODO/FIXME; only contextual comments |
| `return null` / `return {}` / `return []` as only-body | 0 in hot paths; empty-array returns in pullers are guarded by explicit null-body / auth-error / empty-items checks and are correct behavior |
| Hardcoded empty fallbacks flowing to render | N/A — Phase 8 is API-and-library only (no JSX) |
| Console.log-only handlers | Only `console.error` on fail-open DB paths (Phase 7 D-19 pattern, intentional) |
| `return Response.json({message:'Not implemented'})` | 0 matches |
| "placeholder" / "coming soon" strings | 0 in src; only in `.planning/*.md` context |
| Fetch exists with no response handling | 0 — every vendor HTTP call either throws a typed error or awaits + parses JSON before returning |

**No anti-patterns found in Phase 8 source.**

---

## Data-Flow Trace (Level 4)

Phase 8 produces no JSX — all artifacts are server-side libraries and API routes. Level 4 does not apply (no "dynamic data rendered by a component" surface).

API route outputs were traced:

| Route Action | Data Source | Flows Real Data? |
|---|---|---|
| `seed_form_url` | `pullFromTypeform/Jotform/GoogleForms` (real vendor HTTP) or `scrapeFormUrl` (real Playwright/Cheerio) → `extractFromPastedText` (real Sonnet) | YES |
| `seed_website` | `crawlWebsite` → real Playwright crawl + Sonnet extraction | YES |
| `seed_gbp_auth` | `pullFromGBPAuth` → real Business Information API v1 | YES |
| `seed_gbp_places` | `pullFromGBPPlaces` → real Places API (New) v1 | YES |
| `seed_upload` | `seedFromUpload` → real pdf-parse / mammoth / Vision | YES |
| `list_uploads` | Reads live `kotoiq_client_profile.sources` jsonb | YES |
| `list_gbp_locations` | Real fetch to mybusinessaccountmanagement + mybusinessbusinessinformation | YES |

**No hollow props, no static returns masquerading as live data.**

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full Phase 8 test suite passes | `npx vitest run tests/kotoiq/phase8/` | 232/232 across 24 files | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Migration file exists and is valid SQL | Read 20260520_kotoiq_agency_integrations.sql | 13 cols + unique + RLS + trigger all present | PASS |
| Claimed aggregate commit exists | `git log --oneline \| grep 75ac2ff` | `75ac2ff feat(08): implement Phase 8 — external source parsers (PROF-07..11)` | PASS |
| Per-plan commits exist (86d791a, c49fcc0, 07e9e9b, 43fcbf8, ace6918, etc.) | git log reviewed lines 20-30 of output | All present | PASS |
| Phase 8 server-side code imports from @/lib/kotoiq/profileConfig | Plan modules all import SOURCE_CONFIG/BUDGETS/RATE_LIMITS | PASS | PASS |
| Cross-module wiring: routes call real library fns (not stubs) | Read profile/route.ts sections 723-1015 | Every handler calls the real puller + real seedProfile merge | PASS |
| Playwright on Vercel live probe | N/A — requires preview deploy + manual GET | SKIPPED | SKIP (human) |
| Real Supabase schema has koto_agency_integrations | N/A — requires Supabase access | SKIPPED | SKIP (human) |
| Real KEK + OAuth env vars present in Vercel | N/A — requires Vercel access | SKIPPED | SKIP (human) |

---

## Human Verification Required

### 1. Push Supabase migration `20260520_kotoiq_agency_integrations.sql`

**Test:**
```bash
export SUPABASE_ACCESS_TOKEN=<your token>
supabase db push --linked
supabase db pull --schema public --dry-run | grep -c koto_agency_integrations
```
**Expected:** Count = 1; `\d koto_agency_integrations` lists 13 columns + unique constraint + RLS + trigger.
**Why human:** Executor has no access token; cross-contamination risk from `20260524_koto_pipelines.sql` + `20260524_momenta_default_pipeline.sql` currently sitting uncommitted in working tree.

### 2. Provision `KOTO_AGENCY_INTEGRATIONS_KEK` in Vercel

**Test:** Run `openssl rand -hex 32` → paste into Vercel Dashboard → Project → Settings → Environment Variables (Production + Preview + Development). Redeploy.
**Expected:** `/api/kotoiq/integrations` action=save_agency_integration succeeds; `encryptSecret` does not throw "KEK not set".
**Why human:** Secret provisioning + Vercel Dashboard action.

### 3. Register Google Cloud Console OAuth client + Places API key; set 3 env vars in Vercel

**Test:**
1. Cloud Console → enable Business Profile API (or "My Business Business Information API" + "My Business Account Management API") + Places API (New).
2. Create OAuth 2.0 Web client; add redirect URIs: `https://hellokoto.com/api/kotoiq/profile/oauth_gbp/callback` + every preview URL needing OAuth.
3. Create server-side Places API key restricted to Places API; no HTTP referrer.
4. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_PLACES_API_KEY` in Vercel Production + Preview.
5. `GET /api/kotoiq/profile/oauth_gbp/start?mode=agency&agency_id=<ignored — session>` → 302 to `accounts.google.com/o/oauth2/v2/auth...`
6. Consent → confirm redirect to `/kotoiq/launch?gbp_connected=1` + new `koto_agency_integrations` row with `integration_kind='gbp_agency_oauth'`.

**Expected:** All 5 steps complete; `seed_gbp_auth` can then pull a real location.
**Why human:** GCP Console auth + OAuth consent screen + URL registration all require operator Google sign-in.

### 4. Smoke-test Playwright on Vercel Fluid Compute

**Test:** Deploy current HEAD to a preview; `GET <preview-url>/api/kotoiq/debug/playwright_probe`.
**Expected:** `200 { ok: true, title: "Example Domain", duration_ms: <30000 }`
**Why human:** Only a deployed preview exercises the Fluid Compute Lambda bundle + Chromium layer. Local dev does not.

### 5. End-to-end `seed_form_url` against a real public Typeform / Jotform / Google Forms URL

**Test:** POST `{ action: 'seed_form_url', client_id, url }` to `/api/kotoiq/profile` with a real public Typeform share link. Confirm response `{ via: 'typeform_api', extracted: >0 }`. Confirm client profile has new Q&A-derived fields at `source_type='typeform_api'` with confidence ≤ 0.9. Repeat with no API key provisioned → confirm fallback to `source_type='form_scrape'` ≤ 0.7.
**Expected:** Both provider-API and scrape paths return non-empty records; discrepancy detector flags any cross-source conflicts.
**Why human:** Real Typeform/Jotform/Google Forms URL + real API key required; cost-bearing calls against live Anthropic.

### 6. End-to-end `seed_website` against momentamktg.com

**Test:** POST `{ action: 'seed_website', client_id, url: 'https://momentamktg.com', scope: 'A' }`. Confirm `pages_crawled >= 5`, `extracted > 0`, cost under $1.50 cap.
**Expected:** Real Playwright crawl completes within 60s route maxDuration; fields merged into profile with `source_type='website_scrape'` ≤ 0.6; no SSRF errors.
**Why human:** Live network + Sonnet cost; review of extracted field quality against the real site content.

### 7. End-to-end `seed_upload` against PDF + scanned PDF + HEIC business card

**Test:**
1. POST multipart to `/api/kotoiq/profile/upload` with a text PDF (real proposal). Take returned `upload_id`. POST `{ action: 'seed_upload', client_id, upload_id, source_type: 'pdf_text_extract' }`. Confirm records with `source_type='pdf_text_extract'`.
2. Repeat with a scanned PDF (image-only content). Confirm records with `source_type='pdf_image_extract'`.
3. Repeat with a real HEIC business-card photo from iPhone. Confirm sharp HEIC→JPEG conversion succeeds; records with `source_type='image_ocr_vision'`.
**Expected:** All three paths produce non-empty records; confidence clamped per ceiling.
**Why human:** Real file uploads against Supabase Storage; sharp HEIC binary must load in deployed environment.

### 8. Resolve carry-forward Phase 7 UAT blockers before Phase 8 UAT

**Test:** Navigate to `/kotoiq/launch/<clientId>`; confirm page renders (Sidebar React 19/Turbopack crash fixed); paste an `/onboard/:clientId` URL into IngestPanel; confirm `/api/kotoiq/profile` returns 200 (not 401).
**Expected:** Both blockers from STATE.md lines 138-147 resolved.
**Why human:** Phase 8 UI actions sit on the same route and same Launch Page as Phase 7. These two bugs gate all Phase 8 operator UAT. UI-level debugging required; environment must be running locally with user session.

### 9. Wire and verify the operator UI for Phase 8 actions (Plan 08 — status uncertain)

**Test:** Grep `src/app/` + `src/components/` + `src/views/` for any consumer of `seed_form_url` / `seed_website` / `seed_upload` / `seed_gbp_*` / `connect_gbp_*` / `detectFormProvider`. Confirm IngestPanel detects form URLs and shows options panel; Connect GBP button triggers OAuth flow; DropZone uploads → seed_upload path; cost preview visible above Go.
**Expected:** At least IngestPanel + DropZone + a new GBP connect wizard reference the Phase 8 actions.
**Why human:** Executor ran the grep; **zero consumers found in UI code**. No `08-08-PLAN.md` or `08-08-SUMMARY.md` exists in the phase dir. Either:
- (a) Plan 08 (UI) was intentionally deferred to post-gate work and should be tracked outside this phase's scope, OR
- (b) UI work was lost between planning and execution and needs to land before Phase 8 delivers operator value.

Operator must decide (a vs b) and, if (b), plan and execute the UI wiring. Without this, Phase 8's operator-facing goal ("drop whatever you have, we'll figure it out") is not reachable — the plumbing exists but nothing calls it from a button.

---

## Gaps Summary

No code-level gaps: every file claimed in every SUMMARY exists, every claimed export resolves, every claimed test passes, TypeScript is clean, every route action calls real library code with no stubs.

Four gating categories are deferred/pending human action:

1. **Infrastructure:** Supabase migration not pushed; KEK + Google env vars not provisioned; Playwright-on-Fluid-Compute not smoke-tested. All three are explicitly documented in the SUMMARYs as operator action required.
2. **Live e2e UAT:** Form / website / GBP / upload flows all ship with code + tests but have never been exercised against real external endpoints. Every test uses mocked fetch or local fixtures.
3. **UI wiring absent:** No UI consumer for any Phase 8 action was found. `grep -rl 'seed_form_url\|seed_website\|seed_upload\|seed_gbp_\|connect_gbp_\|detectFormProvider'` on src/ returns only server-side route and lib files — zero JSX callers. No 08-08-PLAN/SUMMARY exists. This is the most material gap for Phase 8 delivering operator value.
4. **Phase 7 carry-forward:** Both Phase 7 UAT blockers (React 19/Turbopack Sidebar crash + /api/kotoiq/profile 401) gate Phase 8 UAT identically, per STATE.md line 147.

**Recommendation:** Status is `human_needed` because items 1-3 require operator action that an agent cannot perform in this sandbox, and item 4 is a known upstream blocker. Items 1-2 are expected deferred work consistent with Phase 7 precedent. Item 3 is a real scope question that needs a pre-UAT decision.

---

*Verified: 2026-04-21T21:22:00Z*
*Verifier: Claude (gsd-verifier)*
*Tests run: 232/232 passed · tsc --noEmit clean*
*Commits spot-checked: 75ac2ff, 86d791a, c49fcc0, f7a2938, d9191bb, 03e330c, 5e89ed7, e08a55a, 43fcbf8, ea90fd6, ace6918, bf4da82, 07e9e9b — all present in git log*
