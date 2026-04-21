---
phase: 08-client-profile-seeder-v2-external-source-parsers
plan: 04
subsystem: kotoiq
tags: [kotoiq, form-parsers, typeform, jotform, google-forms, playwright-fallback, phase-8]
status: complete
dependency_graph:
  requires:
    - plan-08-01 (SOURCE_CONFIG.typeform_api / jotform_api / google_forms_api / form_scrape ceilings; FEATURE_TAGS.FORM_EXTRACT)
    - plan-08-02 (checkBudget / applyOverride / checkRateLimit + estimateCost)
    - plan-08-03 (decryptSecret + db.agencyIntegrations.getByKind for vendor keys)
    - plan-08-05 (refuseIfInternalIp shared SSRF helper — Wave 3 cross-import)
    - Phase 7 profileExtractClaude.extractFromPastedText (canonical extraction entrypoint)
    - Phase 7 profileSeeder.seedProfile (merge/upsert persistence path)
  provides:
    - "detectFormProvider(url) — pure URL classifier; UI-safe (no server-only)"
    - "pullFromTypeform adapter — /forms/{id}/responses Bearer auth → ExtractedFieldRecord[] @ ≤0.9"
    - "pullFromJotform adapter — /form/{id}/submissions APIKEY header (T-08-30 mitigation) → ≤0.85"
    - "pullFromGoogleForms adapter — /v1/forms/{id}/responses OAuth Bearer + 401→refresh once → ≤0.9"
    - "scrapeFormUrl fallback — Playwright (primary) or Cheerio (env-gated) → ≤0.7"
    - "seedFromFormUrl dispatcher — provider-API-first, graceful scrape fallback (D-01)"
    - "seed_form_url route action — rate-limited, budget-gated, cross-agency safe"
  affects:
    - plan-08-08 (UI IngestPanel form-URL detection banner reuses detectFormProvider verbatim)
tech-stack:
  added:
    - "playwright-core + @sparticuz/chromium (serverless Chromium) — dynamic-imported so Cheerio deploys skip the bundle"
    - "cheerio — static-HTML fallback when ENABLE_PLAYWRIGHT=false"
  patterns:
    - "Provider-API-first, scrape-fallback (D-01) — key present → vendor call; key absent OR call fails → scrape"
    - "Q&A text blob → extractFromPastedText → overwrite source_type + clamp confidence per SOURCE_CONFIG ceiling"
    - "Jotform header-based auth (APIKEY: <key>) instead of querystring — T-08-30 log-leak mitigation"
    - "Google Forms OAuth: single 401 → refresh → persist re-encrypted tokens → retry once"
    - "SSRF guard runs before every scrape fetch (shared with Plan 05)"
    - "Cross-agency client_id → 404 (not 403) to prevent link enumeration — T-08-34"
key-files:
  created:
    - src/lib/kotoiq/profileFormDetect.ts
    - src/lib/kotoiq/profileFormTypeform.ts
    - src/lib/kotoiq/profileFormJotform.ts
    - src/lib/kotoiq/profileFormGoogleForms.ts
    - src/lib/kotoiq/profileFormScrape.ts
    - src/lib/kotoiq/profileFormSeeder.ts
    - tests/kotoiq/phase8/profileFormDetect.test.ts
    - tests/kotoiq/phase8/profileFormTypeform.test.ts
    - tests/kotoiq/phase8/profileFormJotform.test.ts
    - tests/kotoiq/phase8/profileFormGoogleForms.test.ts
    - tests/kotoiq/phase8/profileFormScrape.test.ts
    - tests/kotoiq/phase8/formRoute.test.ts
  modified:
    - src/app/api/kotoiq/profile/route.ts
decisions:
  - "Playwright-or-Cheerio selection: runtime env var ENABLE_PLAYWRIGHT (default true) — not build-time, so ops can pivot without a redeploy if Plan 05's spike reveals Fluid Compute issues later"
  - "Dynamic import of playwright-core + @sparticuz/chromium so Cheerio-only deploys don't drag ~200MB into the Lambda bundle"
  - "Jotform: querystring auth deliberately rejected — header-only APIKEY: <key> (T-08-30). Test asserts no apiKey= in the request URL"
  - "Google Forms refresh path re-encrypts + upserts the new access_token via encryptSecret (NOT plaintext write) so the integration row stays at rest encrypted even after rotation"
  - "Google Forms plaintext shape: JSON string {access_token, refresh_token} stored encrypted (not raw token) — allows per-kind structure without breaking vault's string-in/string-out contract"
  - "Dispatcher: provider API failure (auth error, HTTP 5xx, JSON parse) logs a console.warn and falls through to scrape — never surfaces provider error to operator (D-01 graceful degradation)"
  - "seed_form_url source_type inferred from detector result as `${provider}_api` for cost estimation; scrape path costs are estimated separately when fallback engages (scrape ceiling 0.7 reflects lower confidence)"
  - "Cross-agency clientId returns 404 not 403 — matches Phase 7 pattern + T-08-34 link-enumeration mitigation"
metrics:
  duration_minutes: 12
  tasks_completed: 2
  tasks_total: 2
  files_created: 12
  files_modified: 1
  tests_added: 36
  completed: 2026-04-21T00:00:00Z
requirements: [PROF-07]
---

# Phase 8 Plan 4: Form Parsers (Typeform/Jotform/Google Forms) + Scrape Fallback + Dispatcher Summary

Wired the four external form adapters (3 provider APIs + 1 Playwright/Cheerio
scrape fallback) behind a single `seed_form_url` route action. Every adapter
emits the Phase 7 `ExtractedFieldRecord[]` shape so the existing
`mergeFields()` + `detectDiscrepancies()` + entity-graph serializer consume
them unchanged. PROF-07 closes with this plan.

## URL regex patterns (for Plan 08 UI URL-detection banner reuse)

`profileFormDetect` is intentionally server-only-free so the UI path can
import it directly. The patterns:

```ts
const TYPEFORM_HOST     = /\.typeform\.com$/i                         // xyz.typeform.com
const JOTFORM_HOST      = /^(?:form\.|www\.)?jotform\.com$/i          // form.jotform.com, www.jotform.com, jotform.com
const GOOGLE_FORMS_HOST = /^docs\.google\.com$/i                      // docs.google.com
const GOOGLE_FORMS_PATH = /\/forms\/d(?:\/e)?\/([\w-]+)/               // /forms/d/XYZ or /forms/d/e/XYZ

// Typeform form ID: /(?:to|c)\/([A-Za-z0-9]+)/  — covers /to/ABC123 and /c/ABC123
// Jotform form ID:  /(\d{10,})/                 — 10+ numeric digits
```

Returns `{provider: 'typeform'|'jotform'|'google_forms'|'unknown', form_id: string|null}`.
Malformed URLs (non-URL, non-http(s)) → `unknown, null`. Protocol check happens
before host matching so `javascript:` / `file:` / `data:` never classify as
a provider.

## Playwright-or-Cheerio selection mechanism

Runtime env var `ENABLE_PLAYWRIGHT` (default `true`):

```ts
const useJs = args.useJs ?? (process.env.ENABLE_PLAYWRIGHT !== 'false')
```

- `true` (default) — dynamic imports `playwright-core` + `@sparticuz/chromium`,
  launches a headless browser, waits for `networkidle`, extracts innerText
  (50KB cap).
- `false` — dynamic imports `cheerio`, static fetches the URL, strips
  `<script>`/`<style>`/`<noscript>`, extracts body text (50KB cap).

Runtime env var (not build-time flag) so ops can flip in Vercel dashboard
if Plan 05's Fluid Compute spike surfaces a bundle-size or cold-start issue
post-deploy. Dynamic `import()` means the Cheerio-only path doesn't pull
Chromium binaries into the Lambda bundle when disabled.

**Plan 05 spike status at deploy time:** Plan 05 ships in the same wave
(Wave 3) as this one; the dedicated probe route `src/app/api/kotoiq/debug/playwright_probe/route.ts`
was added in commit `75ac2ff` so ops can smoke-test Chromium boot on Vercel
Fluid Compute before flipping the flag. Default remains `true` — fallback
to Cheerio-only is one env-var change away.

## Provider API response-shape surprises encountered

### Typeform
Multi-type answers — `a.text | a.number | a.boolean | a.choice.label | a.choices.labels[]`.
Resolved via chained nullish-coalesce; JSON.stringify is the last-resort for
nested object answers. Field label falls back through `a.field.ref → a.field.id → 'question'`
(ref is human-readable; id is UUID; both may be absent).

### Jotform
The envelope nests: `body.responseCode: 200` must match before indexing
`body.content[]`. Each submission's `answers` is a *keyed map* (not array)
whose keys are question IDs. Inner shape varies: `{text, answer}` for simple,
`{prettyFormat}` for formatted (dates, addresses). Also: `body.responseCode`
can be `200` when HTTP `r.status` is also 200 — we check both so upstream
HTTP-proxy errors don't bleed past as silent empty results.

### Google Forms
`responses[].answers` is a keyed map by question ID. `textAnswers.answers[]`
is the canonical text path; multi-value answers join with `' | '`. File-upload
and grid answers are intentionally skipped in v1 — they'd need the questions
resource to map to canonical fields, deferred to Phase 9 if needed.

## Deviations from Plan

### Rule 2 — Auto-added critical functionality

None above what the plan already called out. The plan's pseudocode was
complete and shipped verbatim with one exception below.

### Rule 1 — Auto-fixed bugs

**1. [Rule 1 - Bug] Scrape fallback `headless` chromium option**
- **Found during:** Task 1 wiring
- **Issue:** Plan pseudocode wrote `headless: chromium.headless` — the
  `@sparticuz/chromium` package exposes `headless` as a *getter property*
  returning a boolean but some versions return 'new' (string). Passing a
  string through to `chromium.launch({headless})` silently breaks the render.
- **Fix:** Hard-coded `headless: true` in `profileFormScrape.ts` launch
  args. Kept `args: chromium.args` + `executablePath` which are stable.
- **Files modified:** `src/lib/kotoiq/profileFormScrape.ts`
- **Commit:** `75ac2ff` (merged with full Phase 8)

### Deferred (out of scope for this plan)

**1. Partial-submission streaming for Typeform** — current pull fetches the
first `page_size=25` and stops. Typeform paginates via `before`/`after`
cursors. Acceptable for v1 because operators typically feed us fresh forms
with small submission counts; noted in `deferred-items.md` for Phase 9 if a
high-volume operator complains.

**2. Google Forms `questionId → question text` resolution** — the `/v1/forms/{id}`
metadata endpoint can be fetched separately to replace the opaque QID with
the question body, improving extraction accuracy. Requires a second network
call per pull. Noted in `deferred-items.md`.

## Tests added (36 total across 6 files)

- `profileFormDetect.test.ts` — **15 tests**: Typeform/Jotform/Google Forms
  (old + new URL formats) positive; malformed, unknown host, protocol-less,
  `javascript:` URL, empty string, absent path all → `unknown`.
- `profileFormTypeform.test.ts` — **3 tests**: 200 happy path asserts
  `source_type='typeform_api'` + confidence ≤0.9 + sourceUrl preserved; 401
  throws `TYPEFORM_AUTH_FAILED`; empty `items[]` returns `[]`.
- `profileFormJotform.test.ts` — **3 tests**: 200 + responseCode:200 happy
  path; asserts fetch URL contains no `apiKey=` querystring (T-08-30);
  asserts request headers include `APIKEY`; `responseCode:401` throws
  `JOTFORM_RESPONSE_401`.
- `profileFormGoogleForms.test.ts` — **2 tests**: 401 → refresh → retry-200
  happy path with exactly one `upsert({...encrypted_payload})` call; direct
  200 skips the refresh branch.
- `profileFormScrape.test.ts` — **4 tests**: `useJs=false` Cheerio branch
  (fetch mock); `useJs=true` Playwright branch (vi.mock returns fake browser
  + page); SSRF guard called before any fetch; HTTP 5xx → `FORM_SCRAPE_HTTP_503`.
- `formRoute.test.ts` — **9 tests**: unauthenticated → 401; missing url →
  400 `not_a_form_url`; typeform URL + agency key → typeform pull path;
  typeform URL + no agency key → scrape fallback path; non-form URL → 400
  `not_a_form_url`; budget block + no override → 402; budget block + override
  → applyOverride called + extraction proceeds; rate-limit → 429 with
  retry_after_ms; cross-agency clientId → 404.

## Verification signals

- `grep -c "export function detectFormProvider" src/lib/kotoiq/profileFormDetect.ts` → **1**
- `grep -c "export async function pullFromTypeform" src/lib/kotoiq/profileFormTypeform.ts` → **1**
- `grep -c "APIKEY:" src/lib/kotoiq/profileFormJotform.ts` → **1** (header auth)
- `grep -c "querystring" src/lib/kotoiq/profileFormJotform.ts` → **0** (non-comment); comment only
- `grep -c "refreshGoogleToken\|grant_type.*refresh_token" src/lib/kotoiq/profileFormGoogleForms.ts` → **3**
- `grep -c "'typeform_api'" src/lib/kotoiq/profileFormTypeform.ts` → **1**
- `grep -rc "Math.min(record.confidence, ceiling)" src/lib/kotoiq/profileForm*.ts` → **4** (one per adapter file)
- `grep -c "refuseIfInternalIp" src/lib/kotoiq/profileFormScrape.ts` → **2**
- `grep -c "'seed_form_url'" src/app/api/kotoiq/profile/route.ts` → **4** (ALLOWED_ACTIONS + rate-limit key + branch guard + log)
- `grep -c "'paste_text'" src/app/api/kotoiq/profile/route.ts` → **≥1** (Phase 7 intact)
- `grep -c "'seed'" src/app/api/kotoiq/profile/route.ts` → **≥1** (Phase 7 intact)
- `grep -c "export async function seedFromFormUrl" src/lib/kotoiq/profileFormSeeder.ts` → **1**

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| Phase 8 aggregate (includes Plan 04) | `75ac2ff` | feat(08): implement Phase 8 — external source parsers (PROF-07..11) |

Plan 04 was executed as part of the larger Phase 8 aggregate commit in
`75ac2ff` (Apr 20, 2026). All 13 files listed above (12 created + 1 modified)
are present in that commit's diffstat, all 36 tests ship green per that
commit's test note "220 tests across 24 test files, all passing".

## Threat Flags

None beyond the plan's threat register. `<threat_model>` T-08-30..T-08-37
all mitigated by construction:

- **T-08-30** (Jotform querystring leak): header-only APIKEY, test-asserted.
- **T-08-31** (SSRF): `refuseIfInternalIp()` before every scrape fetch.
- **T-08-32** (prompt injection): Phase 7 EXTRACT_SYSTEM_PROMPT + tool-use
  strict schema reused verbatim — field_name locked to CANONICAL_FIELD_NAMES.
- **T-08-33** (DoS/cost): `checkRateLimit` + `checkBudget` both gate before
  any vendor fetch.
- **T-08-34** (cross-agency): route enforces `.eq('id', clientId).eq('agency_id', agencyId)`
  → 404 on mismatch.
- **T-08-35** (OAuth refresh exfil): refresh_token encrypted at rest; new
  access_token re-encrypted + upserted; plaintext in memory only during
  the refresh call.
- **T-08-36** (scrape timeout): Playwright 15s goto timeout + 60s route
  maxDuration — operator-visible "no Q&A pairs found" copy covers the
  empty-result case.
- **T-08-37** (repudiation): `applyOverride` writes `userId` from
  `verifySession`, never from request body.

## Known Stubs

None. Every adapter executes a real HTTP call against the documented
endpoint; SSRF guard is real pre-flight IP check (shared with Plan 05);
rate limit + budget gates are the real Plan 02 implementations. Playwright
fallback is real end-to-end (via `@sparticuz/chromium` on Vercel) when
`ENABLE_PLAYWRIGHT=true`; Cheerio path is real static HTML parse otherwise.

## Downstream handoff

- **Plan 05 (website crawl):** Shares `profileWebsiteSSRFGuard.refuseIfInternalIp`
  helper — our `profileFormScrape.ts` imports it verbatim. No breakage risk
  because both plans ship in Wave 3 aggregate commit.
- **Plan 06 (GBP):** Independent — no form-parser interaction.
- **Plan 08 (UI):** Import `detectFormProvider` (server-only-free) to drive
  the URL-detection banner; `seed_form_url` is the action to POST. Budget
  block → show 402 modal with override copy; rate-limit → show 429 toast
  with `retry_after_ms` countdown.

## Self-Check: PASSED

- All 13 files (12 created + 1 modified) present on disk and tracked in git.
- Phase 8 aggregate commit `75ac2ff` present in `git log --all`.
- All 8 acceptance grep assertions from PLAN.md §acceptance_criteria pass
  (verified above under "Verification signals").
- Route still has `'seed'` + `'paste_text'` actions (Phase 7 not regressed).
- ALLOWED_ACTIONS list includes `'seed_form_url'` on the expected line (90).
- Test files exist with 36 total test cases across 6 files.
