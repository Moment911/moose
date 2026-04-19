---
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
plan: 02
subsystem: api

tags: [supabase, postgres, vitest, typescript, kotoiq, profile-seeder, ingest, provenance]

# Dependency graph
requires:
  - phase: 07-01
    provides: profileTypes (ProvenanceRecord + SOURCE_TYPES + CANONICAL_FIELD_NAMES) + extracted pick() helper + Vitest 1.6.1 wired up
  - phase: 02-eslint-rule
    provides: kotoiq/no-unscoped-kotoiq (not triggered — pullers query non-kotoiq tables clients/recipients/discovery)
provides:
  - profileConfig.ts — single source of truth for MODELS / HALO_THRESHOLDS / DISCREPANCY_TOLERANCE / STAGE_DEMANDS / FEATURE_TAGS / CONFIDENCE_RUBRIC / SEVERITY_RULES / CHANNEL_RULES / HOT_COLUMNS / hard-cap constants
  - profileIngestInternal.ts — pullFromClient + pullFromRecipients + pullFromDiscovery + pullFromVoiceCallAnalysis (4 deterministic ingest pullers)
  - mapOnboardingKeyToCanonical() onboarding-form alias map shared between recipients + discovery pullers
  - 18 vitest cases (8 config + 10 ingest) covering cross-agency guard, D-04 ProvenanceRecord shape, multi-recipient aggregation, voice _call_analysis extraction
affects:
  - 07-03 (Stage 0 orchestrator wire-in — consumes ProvenanceRecord arrays and merges into kotoiq_client_profile.fields jsonb; runs Haiku per-section discovery extraction on top of pullFromDiscovery)
  - 07-04 (Launch Page — reads HALO_THRESHOLDS for halo rendering)
  - 07-05 (Clarification queue — reads STAGE_DEMANDS for completeness, SEVERITY_RULES + CHANNEL_RULES for Haiku classifiers, FEATURE_TAGS for koto_token_usage)
  - 07-06 (Live ribbon)
  - 07-07 (Operator field UX — reads HOT_COLUMNS to know which fields mirror to indexed columns)
  - 07-08 (Soft launch gate — reads STAGE_DEMANDS + Sonnet COMPLETENESS_GATE)

# Tech tracking
tech-stack:
  added: []   # no new dependencies — uses existing @supabase/supabase-js + vitest from Plan 1
  patterns:
    - "Per-puller cross-agency guard pattern: every Supabase query in this plan ends with .eq('agency_id', ctx.agencyId), and the clients query also chains .is('deleted_at', null) — verified by tests via mockFrom routing on agency_id mismatch returning null"
    - "ProvenanceRecord factory (makeRec) — sane defaults (source_type='onboarding_form', captured_at=now, confidence=0.8) with confidence always clamped to [0, 1] via clamp01 (T-07-11 jsonb-tampering guard)"
    - "mapOnboardingKeyToCanonical alias map — shared by pullFromRecipients + pullFromDiscovery so the same onboarding-form keys (products_services, why_choose_you, monthly_ad_budget, ...) resolve to the same canonical field name in both ingestion paths"
    - "Test stub pattern for Supabase fluent builder: chainable supports both .maybeSingle() (single-row) and `await chain` (list query via thenable .then) so the same stub serves both patterns"

key-files:
  created:
    - src/lib/kotoiq/profileConfig.ts (Task 1, 549756b)
    - src/lib/kotoiq/profileIngestInternal.ts (Task 2, 23de689)
    - tests/profileConfig.test.ts (Task 1, 549756b)
    - tests/profileIngestInternal.test.ts (Task 2, 23de689)
  modified: []

key-decisions:
  - "Reused the kotoiqDb.ts `Record<string, any>` row-shape idiom (with eslint-disable-next-line) rather than introducing a stricter unknown-narrowing pattern — keeps the new pullers consistent with Plan 1's established style across kotoiqDb.ts (70 pre-existing same-pattern occurrences)"
  - "pullFromVoiceCallAnalysis uses a separate select column list (`id, answers, updated_at, created_at`) instead of `select('*')` — saves 4-5KB per recipient because the answers jsonb already contains _call_analysis and we don't need the rest of the row for this extraction"
  - "_call_analysis array values (upsell_signals, hot_lead_reasons, notable_insights) stored as ProvenanceRecord.value: string[] (not joined string) so the discrepancy catcher in Plan 3 can do list-symmetric-diff per DISCREPANCY_TOLERANCE.list_symmetric_diff = 0.5"
  - "Pulled hot_lead_reasons AND notable_insights both into pain_point_emphasis (two records) instead of merging — RESEARCH §3.4 mapping table shows both source fields target the same canonical field; appending separately preserves provenance per source"
  - "source_url for clients pulls = `${APP_URL}/clients/${clientId}` (the operator-facing record), source_url for recipients = `${APP_URL}/onboarding-dashboard/${clientId}` (the operator-facing dashboard), source_url for discovery = `${APP_URL}/discovery/${engagement.id}` — every record has at least one of source_url or source_ref so VerifiedDataSource invariants hold"

patterns-established:
  - "Deterministic ingest first, Haiku per-section extraction second: Plan 2 only does the cheap deterministic pulls (top-level columns, executive_summary, _call_analysis structured fields). Section-level Haiku extraction over discovery `sections` jsonb + per-transcript Haiku extraction over Retell raw transcripts both deferred to Plan 3 — keeps this plan's verify cycle fast (no live Anthropic calls in tests) and isolates the LLM cost surface"
  - "Pre-existing voice rollups read with elevated source_type: client.onboarding_call_summary is appended as `source_type: 'voice_call'` even though it lives on the clients table — provenance is determined by the underlying source, not the storage location"
  - "Onboarding confidence override pattern: when client.onboarding_confidence_scores jsonb has a per-field score, raise (never lower) the corresponding ProvenanceRecord.confidence — preserves the lower-confidence default if the voice score is missing or zero, and clamps untrusted jsonb values to [0, 1]"

requirements-completed: [PROF-01, PROF-04]

# Metrics
duration: ~35min
completed: 2026-04-19
---

# Phase 7 Plan 2: Internal Ingest + Config Module Summary

**Single-source-of-truth `profileConfig.ts` (MODELS / HALO_THRESHOLDS / STAGE_DEMANDS / FEATURE_TAGS / HOT_COLUMNS) + four cross-agency-safe internal pullers (`pullFromClient` / `pullFromRecipients` / `pullFromDiscovery` / `pullFromVoiceCallAnalysis`) that turn Koto's existing onboarding + discovery + voice-analysis data into ProvenanceRecord arrays per canonical field, with 18/18 vitest cases green and full D-04 provenance compliance.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-19T14:47:19Z
- **Completed:** 2026-04-19T15:13:00Z
- **Tasks:** 2 (both TDD: RED → GREEN, no REFACTOR needed)
- **Files created:** 4 (2 lib modules + 2 vitest suites)
- **Files modified:** 0 (purely additive)

## Accomplishments

- **profileConfig.ts** lands the single grep-upgradable surface for every Phase 7 tunable: MODELS pinned to `claude-sonnet-4-5-20250929` + `claude-haiku-4-5-20251001` (canonical IDs from Plan 1 SUMMARY), HALO_THRESHOLDS (CONFIDENT=0.85 / GUESSED=0.5) per UI-SPEC §3, DISCREPANCY_TOLERANCE per RESEARCH §6, STAGE_DEMANDS for the 5 downstream stages (hyperlocal_content / strategy / entity_graph / query_path / eeat) per RESEARCH §7, 9 FEATURE_TAGS for koto_token_usage routing, CONFIDENCE_RUBRIC + SEVERITY_RULES + CHANNEL_RULES verbatim from RESEARCH §4/§8, hard caps (MAX_VOICE_TRANSCRIPT_PULLS=10, MAX_PASTED_TEXT_CHARS=50000, SEED_DEBOUNCE_SECONDS=30, SMS_RATE_LIMIT_PER_CLIENT_HOUR=3), and HOT_COLUMNS exactly mirroring the migration column order from Plan 1.
- **profileIngestInternal.ts** ships the 4 deterministic source pullers wired to `clients` + `koto_onboarding_recipients` + `koto_discovery_engagements`. Each puller filters `.eq('agency_id', ctx.agencyId)` (T-07-01c), the clients puller adds `.is('deleted_at', null)` (T-07-09), and every emitted ProvenanceRecord carries the D-04 quintet (source_type + captured_at + confidence + source_url|source_ref).
- **`pullFromClient`** maps 15 canonical fields from clients-table dual storage via the shared `pick()` helper from Plan 1, applies the onboarding-form confidence schedule from RESEARCH §3.1 verbatim, appends a voice_call ProvenanceRecord for `onboarding_call_summary`, and applies `onboarding_confidence_scores` jsonb as an upper-bound override (clamped to [0, 1]).
- **`pullFromRecipients`** walks every recipient's `answers` jsonb, skips any key starting with `_` (covers _call_analysis + future internal meta), and routes recognised onboarding-form keys to canonical names via `mapOnboardingKeyToCanonical()`. Multi-recipient aggregation produces one ProvenanceRecord per recipient per field.
- **`pullFromDiscovery`** pulls executive_summary as a `discovery_doc` source for `welcome_statement` and walks client_answers top-level keys through the same canonical map. Section-level Haiku extraction over `sections` jsonb is intentionally deferred to Plan 3.
- **`pullFromVoiceCallAnalysis`** extracts caller_sentiment / follow_up_flag / expansion_signals (string[]) / pain_point_emphasis (appended from BOTH hot_lead_reasons AND notable_insights to preserve provenance) / welcome_statement (from call_summary) from the structured Haiku output the voice webhook already persists in `koto_onboarding_recipients.answers._call_analysis`.
- **18 vitest cases green:** 8 in profileConfig.test.ts (model IDs + thresholds + stage demands + feature-tag uniqueness + hot-column count + rubric content + hard caps), 10 in profileIngestInternal.test.ts (≥10-field client extraction, cross-agency guard returns null, voice-rollup promotion to voice_call source_type, multi-recipient extraction skipping _call_analysis, discovery executive_summary + client_answers extraction, voice _call_analysis 4-field extraction, no-recipient and no-engagement empty-result guards, full D-04 ProvenanceRecord shape audit).

## Task Commits

1. **Task 1: profileConfig — single source of truth for tunables** — `549756b` (feat) — TDD RED (tests/profileConfig.test.ts written first, failed for missing module) → GREEN (config module created, 8/8 tests pass on first run, no REFACTOR needed)
2. **Task 2: profileIngestInternal — 4 internal source pullers** — `23de689` (feat) — TDD RED (tests/profileIngestInternal.test.ts written first with 10 cases, failed for missing module) → GREEN (4 pullers implemented, 10/10 tests pass on first run; one tsc deviation auto-fixed in the same task — see Deviations below)

**Plan metadata:** _to be filled by final docs commit_

## Files Created/Modified

**Created:**
- `src/lib/kotoiq/profileConfig.ts` — 13 named exports (MODELS, HALO_THRESHOLDS, DISCREPANCY_TOLERANCE, STAGE_DEMANDS, FEATURE_TAGS, CONFIDENCE_RUBRIC, SEVERITY_RULES, CHANNEL_RULES, MAX_VOICE_TRANSCRIPT_PULLS, MAX_PASTED_TEXT_CHARS, SEED_DEBOUNCE_SECONDS, SMS_RATE_LIMIT_PER_CLIENT_HOUR, HOT_COLUMNS) — every constant carries a comment pointing back to the RESEARCH section that authorises it
- `src/lib/kotoiq/profileIngestInternal.ts` — 4 exported pullers + 3 row-shape aliases (ClientsRow / DiscoveryRow / RecipientRow) + 4 helpers (sb, nowIsoOr, makeRec, clamp01, toIntOrNull, mapOnboardingKeyToCanonical)
- `tests/profileConfig.test.ts` — 8 vitest cases against the 13 exports
- `tests/profileIngestInternal.test.ts` — 10 vitest cases with `vi.mock('@supabase/supabase-js', ...)` returning a stub chainable that handles both `.maybeSingle()` and `await chain` (list query) patterns

**Modified:** None — purely additive plan.

## Decisions Made

- **`Record<string, any>` row shape idiom retained** for ClientsRow / DiscoveryRow / RecipientRow with `eslint-disable-next-line` per usage. Plan 1's SUMMARY explicitly accepted this pattern (kotoiqDb.ts has 70 pre-existing same-style occurrences). Switching to `Record<string, unknown>` would have forced narrowing at every property access site (~40 places), breaking the established jsonb-shape vocabulary the codebase already uses. Strict typing isn't impossible but would dwarf the actual ingest logic and diverge from the rest of the file.
- **Voice `_call_analysis` array values preserved as `string[]`** (not joined into a single comma-string) so Plan 3's discrepancy catcher can do `DISCREPANCY_TOLERANCE.list_symmetric_diff` per RESEARCH §6 algorithm. Scalars (caller_sentiment, follow_up_recommended) stringify to `string`. The `ProvenanceRecord.value: string | number | string[] | null` union supports both shapes natively.
- **`pain_point_emphasis` is appended from both `hot_lead_reasons` AND `notable_insights`** (two separate ProvenanceRecord entries with different confidence values: 0.75 + 0.7) instead of being merged into one record. RESEARCH §3.4 maps both source fields to the same canonical name; keeping them as separate provenance records preserves source attribution for the Plan 5 chat widget's "where did this come from?" UX.
- **Voice-derived rollup `client.onboarding_call_summary` is appended as `source_type: 'voice_call'`** even though it lives on the clients table. Provenance is determined by the underlying source, not the storage location. Plan 3's discrepancy catcher will compare this voice-call entry against the form's `welcome_statement` entry.
- **`pullFromVoiceCallAnalysis` selects only the columns it needs** (`id, answers, updated_at, created_at`) instead of `*` — saves ~4-5KB per recipient row because we don't need the dozens of other answer fields that pullFromRecipients already covers from the same table.
- **Deferred to Plan 3 (intentional, documented in code comments):** section-level Haiku extraction over `koto_discovery_engagements.sections` jsonb (RESEARCH §3.3 — "sections vary by industry; the cheapest reliable path is Claude Haiku per section"); per-Retell-transcript Haiku extraction for competitor_mentions + objections + pain_point extraction (RESEARCH §3.4 — "Option A: fetch transcripts on demand from Retell; cap at 10 per RESEARCH §10 cost envelope"). Both are LLM-bound work that needs the merger + token-logging + Anthropic-mock plumbing from Plan 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate object literal key in `makeRec` factory**
- **Found during:** Task 2, post-GREEN tsc audit
- **Issue:** First-pass `makeRec` had `confidence` declared twice in the same object literal (once with `clamp01(partial.confidence ?? 0.8)` then again under spread). TS1117 error. Tests still passed because the second key won at runtime, but the code was incorrect by inspection.
- **Fix:** Destructured `partial` to extract `confidence`, `source_type`, `captured_at` separately, then spread the rest — single `confidence` key with clamping applied once. Semantics preserved (clamping happens on the input value before assignment).
- **Files modified:** src/lib/kotoiq/profileIngestInternal.ts (makeRec function only)
- **Verification:** `npx tsc --noEmit` clean (was: 1 error); 10/10 tests still green
- **Committed in:** `23de689` (folded into Task 2 commit)

**2. [Rule 1 - Bug] ESLint `@typescript-eslint/no-explicit-any` on 10 sites in new code**
- **Found during:** Task 2, post-tsc lint audit
- **Issue:** Initial implementation used `any` in row-shape aliases (`ClientsRow`, `DiscoveryRow`, `RecipientRow`) and in 4 callback signatures (`addIf` value param × 1, recipient/discovery answers casts × 2, _call_analysis cast × 1, `add` callback × 1) plus 2 sites in the test stub (`chain: any`, `then: (resolve: (v: any) => void)`). ESLint reported 10 errors.
- **Fix:** Annotated each site with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` and added an explanatory comment block on the row-shape aliases (matches the kotoiqDb.ts idiom Plan 1 established). Tried `Record<string, unknown>` first — it would have required narrowing at every property access (`client.name`, `r.answers`, `r.last_active_at`, etc., ~40 sites) and diverged from the established codebase pattern; reverted to `Record<string, any>` with disables.
- **Files modified:** src/lib/kotoiq/profileIngestInternal.ts (3 row-shape lines + 4 callback lines + 1 cast line) + tests/profileIngestInternal.test.ts (chain alias + then signature)
- **Verification:** `npx eslint` on the 4 new files exits clean (was: 10 errors); `npx tsc --noEmit` clean; 22/22 vitest cases green
- **Committed in:** `23de689` (folded into Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in my own initial code).
**Impact on plan:** Both deviations were defects in my first-pass implementation, not gaps in the plan. The plan's verify command (`npm test`) passed at every checkpoint; tsc + lint surfaced the additional issues which were fixed before commit. No scope creep.

## Issues Encountered

- **`npm run lint` (project-wide ESLint) OOMs on `.obsidian/plugins/dataview/main.js`** — V8 heap allocation failure parsing 500KB+ vendor bundles in the developer's local Obsidian vault. Pre-existing repo issue (unrelated to Phase 7); same OOM happens on `main` HEAD before this plan. Worked around by running `npx eslint <new files>` directly — exits clean. Recommend a future `eslint.config.mjs` `ignores: ['.obsidian/**']` follow-up; out of scope here.
- **Two unrelated changed files appeared in working tree** (`src/views/ProjectReviewPage.jsx`, `src/views/PublicReviewPage.jsx` — branding-color edits not from my work). Verified via `git diff --cached --stat` that only my Task 2 files were staged before commit; the unrelated files were left unstaged.

## Field Mapping Implemented (mapOnboardingKeyToCanonical)

Recipients + discovery share this alias map. Reference for Plans 3-7:

| Onboarding-form key (jsonb) | → Canonical field |
| --- | --- |
| `products_services` / `top_services` / `primary_service` | → `primary_service` |
| `ideal_customer_desc` / `customer_types` / `target_customer` | → `target_customer` |
| `why_choose_you` / `unique_selling_prop` | → `unique_selling_prop` |
| `monthly_ad_budget` / `budget_for_agency` / `marketing_budget` | → `marketing_budget` |
| `business_description` / `welcome_statement` | → `welcome_statement` |
| `marketing_channels` / `current_ad_platforms` / `current_channels` | → `current_channels` |
| `geographic_focus` / `service_areas` / `service_area` | → `service_area` |
| `founding_year` / `year_founded` / `business_age` | → `founding_year` |
| `competitors`, `differentiators`, `pain_points`, `customer_pain_points`, `trust_anchors` | → pass-through (same name) |
| `industry`, `website`, `phone`, `city`, `state` | → pass-through (same name) |

Confidence values per field source (from RESEARCH §3.1, §3.4 — verbatim):

| Field | clients-source confidence | recipients/discovery confidence | voice _call_analysis confidence |
| --- | --- | --- | --- |
| business_name | 1.0 | — | — |
| city / state | 0.95 | 0.8 | — |
| website | 0.95 | 0.8 | — |
| industry | 0.9 | 0.8 | — |
| phone | 0.9 | 0.8 | — |
| primary_service | 0.85 | 0.8 | — |
| target_customer | 0.85 | 0.8 | — |
| unique_selling_prop | 0.8 | 0.8 | — |
| service_area | 0.8 | 0.8 | — |
| marketing_budget | 0.8 | 0.8 | — |
| founding_year | 0.8 | 0.8 | — |
| customer_pain_points | 0.75 | 0.8 | — |
| current_channels | 0.7 | 0.8 | — |
| welcome_statement (form) | 0.7 | — | — |
| welcome_statement (call summary) | — | — | 0.85 (discovery executive_summary) / 0.85 (voice call_summary) / 0.8 (clients.onboarding_call_summary) |
| caller_sentiment | — | — | 1.0 |
| follow_up_flag | — | — | 1.0 |
| expansion_signals | — | — | 0.7 |
| pain_point_emphasis (hot_lead_reasons) | — | — | 0.75 |
| pain_point_emphasis (notable_insights) | — | — | 0.7 |

## Fields from RESEARCH §3.1-3.4 NOT yet implemented (with rationale)

- **`hot_lead` rollup field on clients** (RESEARCH §3.1, "Hot-lead flag … 0.9") — not promoted to a canonical ProvenanceRecord because it doesn't appear in `CANONICAL_FIELD_NAMES` (Plan 1 type surface). Plan 3 should decide whether to (a) add `hot_lead` to CANONICAL_FIELD_NAMES + the migration's hot-column tail, or (b) consume it directly from `clients.onboarding_hot_lead` at the merger layer without canonicalising. Logged for Plan 3 attention; not a blocker for downstream consumers.
- **`koto_token_usage` metadata backpull** (RESEARCH §3.5, optional enrichment) — out of scope for this plan; the deterministic _call_analysis pull already covers every analysis the seeder needs. Plan 4 (live ribbon) may want this for showing past Claude work in the activity feed.
- **Section-level Haiku extraction** over `koto_discovery_engagements.sections` jsonb (RESEARCH §3.3) — deferred to Plan 3 per RESEARCH's own recommendation ("the cheapest reliable path is Claude Haiku per section"). Plan 2 only does the deterministic top-level executive_summary + client_answers pull.
- **Per-Retell-transcript Haiku extraction** for `competitor_mentions[]` + `objections[]` + free-text pain_point extraction (RESEARCH §3.4, "raw transcript pull from Retell `/list-calls`") — deferred to Plan 3 per RESEARCH §3.4 Option A. Requires the `MAX_VOICE_TRANSCRIPT_PULLS=10` cap from profileConfig.ts (which this plan ships) plus the Anthropic mock infrastructure that Plan 1 staged.

## Threat Model Coverage

| Threat ID | Mitigation status |
| --- | --- |
| T-07-01c (cross-agency clientId guess → pullFromClient) | **Mitigated.** All 4 pullers `.eq('agency_id', ctx.agencyId)` — verified by tests/profileIngestInternal.test.ts "returns null + empty records when agency_id does not match" case. |
| T-07-09 (soft-deleted client leaked) | **Mitigated.** pullFromClient `.is('deleted_at', null)`. Soft-deleted rows return null, which the puller treats as not-found. |
| T-07-10 (malicious script in onboarding_answers jsonb → source_snippet) | **Partially mitigated (this plan).** source_snippet is sliced to 240 chars at every emit site. Plan 7's EditableSpan must render this as plain text via React (no dangerouslySetInnerHTML) — that final mitigation lands in Plan 7. |
| T-07-11 (untrusted onboarding_confidence_scores jsonb) | **Mitigated.** `clamp01(Number(voiceConf[field]))` always clamps to [0, 1] and rejects non-finite numbers. Override only raises confidence (never lowers), so a malicious zero can't sabotage a real voice score. |

## Threat Flags

None — plan stayed within its declared `<threat_model>` surface. No new network endpoints, no new auth paths, no new schema. Source-tagged data flows from existing Koto tables (clients, koto_onboarding_recipients, koto_discovery_engagements) to in-memory ProvenanceRecord arrays consumed by Plan 3.

## Known Stubs

None. All 4 pullers are real implementations against live table shapes. The test stub for Supabase is intentional (mocks the SDK boundary) and never reaches production.

## Known Follow-ups

- **`hot_lead` canonicalisation decision** — Plan 3 should resolve whether `clients.onboarding_hot_lead` becomes a CANONICAL_FIELD_NAMES entry or stays consumed directly at the merger layer.
- **`npm run lint` OOM on `.obsidian/**`** — pre-existing repo issue; recommend adding `ignores: ['.obsidian/**']` to `eslint.config.mjs` in a future cleanup commit (not blocking; per-file `npx eslint` works).
- **Plan 3 Anthropic-mock plumbing** is now load-bearing — Plan 2 deliberately did not run any LLM calls; Plan 3 will need the `tests/fixtures/anthropicMock.ts` helpers from Plan 1 to mock both the Haiku per-section discovery extraction and the per-transcript voice extraction.

## User Setup Required

None — no external service configuration introduced. profileConfig.ts only references env vars that are already in the project (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL).

## Next Phase Readiness

Plan 3 (Stage 0 orchestrator + merger + per-section Haiku) can now build on:
- `profileConfig.ts` for every model ID, threshold, and feature tag — single grep-upgradable surface
- `profileIngestInternal.ts` 4 pullers — call all 4 in parallel, merge their ProvenanceRecord arrays into `kotoiq_client_profile.fields` jsonb keyed by canonical field name, then sort each field's array by operator-edit-wins-ties + descending confidence (the sort pattern Plan 1 established in `getKotoIQDb.clientProfile`)
- `mapOnboardingKeyToCanonical()` is exportable if Plan 3 needs to canonicalise additional jsonb keys (e.g., from operator paste extraction); currently file-internal but trivially promotable
- 22/22 vitest baseline (config + types + ingest) — no regressions to maintain

**No blockers for downstream plans.** The deferred section-level + transcript extraction work is Plan 3's primary scope and was always planned as out-of-scope for Plan 2.

## Self-Check: PASSED

All claimed files exist and all commits are in `git log`:
- src/lib/kotoiq/profileConfig.ts — FOUND
- src/lib/kotoiq/profileIngestInternal.ts — FOUND
- tests/profileConfig.test.ts — FOUND
- tests/profileIngestInternal.test.ts — FOUND
- Commit 549756b — FOUND (Task 1)
- Commit 23de689 — FOUND (Task 2)
- `npm test` — 22/22 green (8 + 4 + 10)
- `npx tsc --noEmit` — 0 errors
- `npx eslint <4 new files>` — 0 errors

---
*Phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder*
*Completed: 2026-04-19*
