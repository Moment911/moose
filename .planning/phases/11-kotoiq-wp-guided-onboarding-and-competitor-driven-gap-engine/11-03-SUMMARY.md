---
phase: 11-kotoiq-wp-guided-onboarding-and-competitor-driven-gap-engine
plan: 03
subsystem: kotoiq-wp-service-auto-extraction
tags: [ws3, service-inference, ai-inferred-editable, provenance, haiku, chips, data-integrity]
requires:
  - "11-02: kotoiq_site_baseline (captureBaseline output) — the client's own scanned pages"
  - "kotoiqDb.getKotoIQDb + clientProfile.{get,upsert} (Phase 7 agency-scoped, auto-injects agency_id)"
  - "tokenTracker.logTokenUsage (mandatory on every Claude call)"
  - "kotoiq route AUTH gate (verifySession → agency overwrite → client-ownership)"
provides:
  - "inferServices({agencyId,clientId,pages}) — heuristic-first, Haiku-escalation service inference over baseline pages; ai_inferred + confidence provenance per item"
  - "saveConfirmedServices({agencyId,clientId,services}) — persists confirmed services to kotoiq_client_profile.fields.services[] with user_confirmed/user_added/ai_inferred provenance"
  - "servicesFromHeuristic + normalizeServiceName + toInferredService — pure, unit-tested helpers"
  - "/api/kotoiq infer_services + save_services + derive_phrases actions"
  - "ServiceChips.jsx — editable add/remove chips with AI-inferred badge (DESIGN.md primitives)"
affects:
  - "WS5 gap grid — confirmed services[] feed scoreServiceCityGrid"
  - "11-06 guided shell — consumes ServiceChips at 'Your site today'/'Your gaps' handoff"
  - "PageSuggestionsTab manual comma-separated services box — superseded by ServiceChips in the guided flow"
tech-stack:
  added: []
  patterns:
    - "AI-inferred → user-editable with a visible AI flag (data-integrity: verify before drive)"
    - "Heuristic-first (free, deterministic, unit-testable) → single Haiku pass only when thin"
    - "Self-contained ai_inferred provenance — does NOT extend the typed Phase-7/8 SOURCE_TYPES enum (length asserted at 18 by the parity test)"
    - "Append-to-monolith route dispatch (no refactor); all actions covered by the existing AUTH gate"
    - "Latest-capture selection: read most-recent captured_at from kotoiq_site_baseline, use that immutable batch"
key-files:
  created:
    - "src/lib/kotoiq/serviceInference.ts"
    - "src/components/kotoiq/ServiceChips.jsx"
    - "tests/kotoiq/serviceInference.test.ts"
  modified:
    - "src/app/api/kotoiq/route.ts"
decisions:
  - "Did NOT extend SOURCE_TYPES with 'ai_inferred' — tests/kotoiq/phase8/profileConfig.test.ts asserts SOURCE_TYPES.length===18. The data-integrity requirement is the FLAG, not enum membership, so serviceInference carries its own provenance shape and writes the untyped kotoiq_client_profile.fields jsonb directly."
  - "Heuristic-first inference (free /services/ path + H1 extraction); Haiku ('claude-haiku-4-5-20251001') escalation only when the heuristic yields < 2 services. Keeps service inference at ~zero token cost on a normal WP site."
  - "infer_services reads the LATEST kotoiq_site_baseline capture (most-recent captured_at batch) — the immutable day-1 inventory — and degrades gracefully to an empty list when no baseline exists yet."
  - "An AI chip the user LEAVES in place on Confirm is persisted as 'user_confirmed' (confirming = verifying); a hand-added chip is 'user_added'. Untouched-but-confirmed still records the act of verification."
  - "derive_phrases pulls from kotoiq_keywords (GSC + DataForSEO populated) filtered to the service, each phrase carrying source:'kotoiq_keywords' + fetched_at (data-integrity)."
metrics:
  duration: ~14min
  completed: 2026-06-08
  tasks: 3
  files: 4
---

# Phase 11 Plan 03: Service Auto-Extraction (WS3) Summary

The client's services are now inferred FROM their own baseline-scanned pages (not the keyword scan), presented as editable add/remove chips pre-seeded from the real site and visibly flagged AI-inferred, and persisted with provenance so confirmed services feed the WS5 gap grid. Inference is heuristic-first (free, deterministic) and only escalates to a single Claude Haiku pass when the heuristic is thin — every Claude call logs via `logTokenUsage`.

## What Was Built

**Task 1 — `serviceInference` engine (`src/lib/kotoiq/serviceInference.ts`, TDD)**
- `inferServices({agencyId, clientId, pages})` reads baseline pages (`h1` + `meta_title` + URL path segments) and returns a deduped, sorted services list, each item wrapped in an `ai_inferred` provenance record `{source_type:'ai_inferred', confidence, source_url, captured_at}` so the UI can badge it.
- **Heuristic-first** (`servicesFromHeuristic`, pure): extracts service names from `/services/{slug}` (and `/what-we-do/`, `/solutions/`) URL paths + service-page H1s, normalizes (`normalizeServiceName`: hyphen/underscore split, boilerplate-stopword strip, title-case), dedupes case-insensitively, sorts. On a normal WP site with a `/services/` section this is all that runs — zero token cost.
- **Haiku escalation** only when the heuristic yields `< 2` services (or `forceClaude`): a single `claude-haiku-4-5-20251001` pass over the page signals returning strict JSON. Logs `logTokenUsage({feature:'kotoiq_service_inference', model:'claude-haiku-4-5-20251001'})` exactly once. Falls back to the heuristic result if Claude is unavailable. Never throws.
- `saveConfirmedServices({agencyId, clientId, services})` persists confirmed services to `kotoiq_client_profile.fields.services[]` via the Phase-7 `clientProfile.upsert` helper (agency_id auto-injected — cross-agency writes structurally impossible). Provenance per chip: `user_added` (hand-added), `user_confirmed` (AI chip the user kept), or `ai_inferred`.

**Task 2 — `infer_services` + `save_services` + `derive_phrases` actions (`src/app/api/kotoiq/route.ts`)**
- Appended three handlers to the existing if-chain dispatcher (no monolith refactor), all covered by the route's existing AUTH block (`verifySession` → agency_id overwrite → client-ownership check, lines 444-466).
- `infer_services` loads the client's **latest** `kotoiq_site_baseline` capture (most-recent `captured_at` batch), maps rows to `BaselinePageInput`, calls `inferServices`, and returns the flagged list — does NOT auto-confirm.
- `save_services` validates + persists the user-confirmed `services[]` with provenance.
- `derive_phrases` returns per-service target phrases from `kotoiq_keywords` filtered to the service, each carrying `source:'kotoiq_keywords'` + `fetched_at` (data-integrity).

**Task 3 — `ServiceChips` component (`src/components/kotoiq/ServiceChips.jsx`)**
- `"use client"` component built entirely on the DESIGN.md `koto/*` primitives + `koto-tokens` `t` (NOT the legacy `#111`/FH/FB theme — Pitfall 6): `SectionHeader`, `EducationalNote`, `ActionCallout`, `CtaButton`, `FlagChip`, `Skeleton`, `KotoKeyframes`.
- On mount calls `infer_services` and pre-seeds editable chips. Each AI-inferred chip renders an **"AI" badge** (info/violet variant, Pattern 8 — mirrors the AEOVisibilityTab AI chip) so the user knows to verify before services drive builds.
- Remove a chip, add a chip (text input → `user_added` chip), and a **single** primary "Confirm services" CTA (WS7 one-primary-action convention) that POSTs `save_services`. Shows an AI-inferred count FlagChip and the inference source line.

## Verification

- `npx vitest run tests/kotoiq/serviceInference.test.ts` → **6 passed** (normalize, heuristic dedup+sort, ai_inferred+confidence on every item, graceful empty, Haiku path logs token usage once with the service-inference feature).
- `npx vitest run` (new + dependency + parity) → **31 passed**: serviceInference 6, baselineSnapshot 6 (11-02), orchestrateOnboarding 4 + wpEventAuth 7 (11-01), phase8/profileConfig 8 (the SOURCE_TYPES.length===18 parity test — proves the no-enum-extension decision is correct).
- `npx tsc --noEmit` → **0 errors repo-wide**; touched files (`serviceInference`, `route`, `ServiceChips`) all clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `source_type:'ai_inferred'` cannot be added to the typed `SOURCE_TYPES` enum**
- **Found during:** Task 1 design (reading `profileTypes.ts` + the Phase-8 parity test).
- **Issue:** The plan/data-integrity standard require services flagged `source_type:'ai_inferred'`, and RESEARCH A3 suggested storing via the Phase-7 `kotoiq_client_profile.fields` provenance pattern. But `SOURCE_TYPES` is a frozen typed union and `tests/kotoiq/phase8/profileConfig.test.ts` line 55 asserts `SOURCE_TYPES.toHaveLength(18)`. Adding `'ai_inferred'` to the enum (or routing through the typed `clientProfile.updateField`, which rejects non-`SourceType`) would have broken that existing test — violating the success criterion "11-01/11-02 tests still pass" and the wider Phase 7/8 suite.
- **Fix:** `serviceInference` carries its own self-contained provenance shape (`ServiceProvenance` / `StoredServiceRecord`) with a literal `source_type: 'ai_inferred' | 'user_confirmed' | 'user_added'`, and persists into the **untyped** `kotoiq_client_profile.fields` jsonb directly via `clientProfile.upsert` (splices in `fields.services[]`). The data-integrity requirement — a visible AI flag the user verifies — is fully satisfied (the `ServiceChips` AI badge reads it); enum membership was never the requirement.
- **Files modified:** `src/lib/kotoiq/serviceInference.ts` (no change to `profileTypes.ts`).
- **Commit:** `f11df666`.

## Authentication Gates

None. All three actions ride the kotoiq route's existing soft-gate + `verifySession` AUTH block; no new auth surface, no operator login step.

## Threat Model — Verified

- **T-11-08 (cross-agency service read/write):** mitigated by the route AUTH gate (agency_id overwrite + client-ownership) and `clientProfile.upsert` auto-injecting agency_id — cross-agency profile writes are structurally impossible (Phase 7 helper). `infer_services` reads baseline rows scoped to `client_id` under the same gate.
- **T-11-09 (unverified AI services driving builds):** mitigated — every inferred chip is flagged `ai_inferred` and rendered with the AI badge; `infer_services` does NOT auto-confirm; only `save_services` (an explicit user Confirm) persists services that feed WS5.
- **T-11-10 (save_services with arbitrary client_id):** mitigated by the AUTH gate's client-ownership check (kotoiq route @455-463) that runs before any action handler.

## Known Stubs

None. `inferServices`, `saveConfirmedServices`, the three route actions, and `ServiceChips` are all fully implemented over real engines/data. (The lone `placeholder="Add a service…"` is an `<input>` affordance, not a data stub.)

## Threat Flags

None beyond the plan's `<threat_model>`. No new network endpoints, auth paths, or schema changes — the three actions append to an existing gated route and write an existing table's jsonb column.

## Migration / Operator Notes

No new migration. Persistence targets the existing `kotoiq_client_profile.fields` jsonb (Phase 7). `derive_phrases` and `infer_services` read existing tables (`kotoiq_keywords`, `kotoiq_site_baseline`). If 11-02's baseline is not yet captured for a client at runtime, `infer_services` returns an empty list (graceful degrade) and `ServiceChips` shows an "add them below" empty state.

## Commits

- `a42d1d89` — test(11-03): add failing tests for serviceInference engine (Task 1 RED)
- `f11df666` — feat(11-03): serviceInference engine — infer services from baseline pages (Task 1 GREEN)
- `37cdd6d9` — feat(11-03): infer_services + save_services + derive_phrases actions (Task 2)
- `a36538d5` — feat(11-03): ServiceChips editable AI-inferred service chips (Task 3)

## Self-Check: PASSED

All 4 files present on disk (`serviceInference.ts`, `ServiceChips.jsx`, `serviceInference.test.ts`, `11-03-SUMMARY.md`); all 4 task commits (`a42d1d89`, `f11df666`, `37cdd6d9`, `a36538d5`) in git history atop base `df5320e9`. serviceInference 6/6 green; 11-01 (11/11) + 11-02 (6/6) + Phase-8 parity (8/8) all still green; `npx tsc --noEmit` 0 errors repo-wide.
