---
phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo
plan: 02
subsystem: kotoiq-multi-category-chips
tags: [ui, chips, data-integrity, ws2, ws4, back-compat]
requires:
  - extract_comprehensive / save_field (12-01 category-aware actions + ai_available flag)
  - StoredServiceRecord shape {value, source_type, confidence, source_url, captured_at}
  - DESIGN.md koto primitives (SectionHeader, EducationalNote, ActionCallout, CtaButton, FlagChip, Skeleton)
provides:
  - CategoryChips.jsx — category-parameterized editable chips for keywords/phrases/services/offerings
  - ServiceChips.jsx — thin <CategoryChips category="services"/> back-compat wrapper
affects:
  - 12-03 (synergy accept-to-promote chips reuse the CategoryChips save_field path)
  - 12-06 (guided steps hydrate four CategoryChips from one extract_comprehensive call via seedItems)
tech-stack:
  added: []
  patterns:
    - "ServiceChips generalized to a category-parameterized component; original reduced to a wrapper (no behavior change for StepGaps)"
    - "seedItems prop hydrates from one parent fetch — avoids four extract_comprehensive round-trips"
    - "visible ai_available:false notice (never a silent $0-credit degrade) — data-integrity"
key-files:
  created:
    - src/components/kotoiq/CategoryChips.jsx
  modified:
    - src/components/kotoiq/ServiceChips.jsx
decisions:
  - "CategoryChips owns ALL chip behavior; ServiceChips pins category='services' + infer_services/save_services so score_grid fields.services[] read path is untouched"
  - "recordToChip normalizes both the 12-01 StoredServiceRecord {value,source_type,...} and the legacy infer_services {name,provenance} shapes → one chip model"
  - "save payload branches on saveAction: save_field sends {category,items}; save_services sends {services} for back-compat"
  - "AI flag = any source_type that is NOT user_added/user_confirmed renders the AiBadge (verify-me, T-12-06)"
metrics:
  duration: ~6m
  completed: 2026-06-10
---

# Phase 12 Plan 02: Multi-Category Editable Chips + Manual Entry Summary

Generalized `ServiceChips.jsx` into a category-parameterized `CategoryChips.jsx` that renders editable, AI-flagged chips for any of the four comprehensive categories (keywords / phrases / services / offerings) with manual entry (WS4) and a visible "AI unavailable" signal — then reduced `ServiceChips` to a thin `<CategoryChips category="services"/>` wrapper so the existing `StepGaps` usage and the `score_grid` `fields.services[]` read path stay unchanged.

## What Was Built

- **`CategoryChips.jsx` (new, ~330 lines)** — props `{ agencyId, clientId, category, title, subtitle, icon, placeholder, seedItems, inferAction='extract_comprehensive', saveAction='save_field', onConfirmed }`.
  - **Hydration:** if `seedItems` is provided (the parent fetches `extract_comprehensive` ONCE and passes `d[category]` — or the whole response — down), it seeds from that and skips the network; otherwise it fetches `{ action: inferAction, agency_id, client_id }` and reads `d[category]` (falling back to `d.services` for the `infer_services` path). The effect only syncs the external source → local chip state; nothing is derived during render.
  - **Provenance / AI flag (T-12-06):** `recordToChip` normalizes both the 12-01 `StoredServiceRecord` (`{value, source_type, confidence, source_url, captured_at}`) and the legacy `infer_services` (`{name, provenance:{...}}`) shapes. Any item whose `source_type` is NOT `user_added`/`user_confirmed` renders the `AiBadge` (info/violet, "verify me").
  - **Select / delete:** per-chip remove button (unchanged from ServiceChips).
  - **Manual add (WS4):** the add-chip path creates a `user_added` chip at `confidence 1.0`.
  - **Save:** Confirm CTA maps provenance (`user_added` / `user_confirmed` / `ai_inferred`) and POSTs `{ action: saveAction, category, items }` for `save_field`, or `{ ..., services }` for the `save_services` back-compat path. Calls `onConfirmed(names)` after a successful save.
  - **Visible AI-unavailable notice (T-12-08):** when the source reports `ai_available:false`, a warning `ActionCallout` ("AI unavailable — showing heuristic suggestions") renders instead of swallowing the degrade. `ai_available` defaults to `true` when an action doesn't report it (e.g. `infer_services`), so the banner only appears on an explicit `false`.
  - Built only on DESIGN.md koto primitives (navy/cream) — no blazly reskin.

- **`ServiceChips.jsx` (reduced to a wrapper)** — now returns `<CategoryChips category="services" icon={Wrench} title="Your services" subtitle="…" placeholder="Add a service…" inferAction="infer_services" saveAction="save_services" {...} />`, preserving the `{ agencyId, clientId, onConfirmed }` props and the original services-specific copy. `StepGaps.jsx:100` renders identically; the `score_grid` `fields.services[]` read path is untouched (still saved via `save_services`).

## Verification

- `npx tsc --noEmit` → **clean** (both tasks).
- `grep -q "CategoryChips" src/components/kotoiq/ServiceChips.jsx` → present (wrapper confirmed).
- `npx vitest run tests/kotoiq/comprehensiveExtractor.test.ts tests/kotoiq/serviceInference.test.ts` → **16/16 pass** (the kotoiq tests relevant to this plan's data shape + save path).
- Manual (browser, behind Supabase auth — Adam verifies): four `CategoryChips` groups render; AI badge visible; add a custom keyword → appears as `user_added`; Confirm persists via `save_field`. Service chips unchanged in `StepGaps`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks (create `CategoryChips`, reduce `ServiceChips` to a wrapper) completed as specified.

## Deferred Issues

- Full `npx vitest run` shows **12 pre-existing failures across 5 files, none touched by 12-02** (this plan only edited two `.jsx` components, which have no dedicated test):
  - `tests/kotoiq/phase8/profileGBPOAuth.test.ts` (1) + `profileGBPPlaces.test.ts` (1) — the `9becf78` env-var dual-name string drift already logged under 12-01.
  - `tests/trainer/phase1/intakeCompleteness.test.ts` (1), `tests/trainer/phase2/prompts.test.ts` (6), `tests/trainer/phase2/generateRoute.test.ts` (3) — unrelated fitness-trainer module (coach-voice string drift + generate-route mocks).
  - Logged to `deferred-items.md`. Out of scope per the scope-boundary rule.

## Known Stubs

None. CategoryChips is fully wired — it reads real `d[category]` records from `extract_comprehensive` / `infer_services`, manual entry produces real `user_added` records, and Confirm posts to the live `save_field` / `save_services` actions (12-01 persistence). The `ai_available:false` path surfaces a real heuristic-fallback notice, not a placeholder.

## Self-Check: PASSED

- FOUND: src/components/kotoiq/CategoryChips.jsx
- FOUND: src/components/kotoiq/ServiceChips.jsx (contains "CategoryChips")
- FOUND commit: f7706081 (feat: CategoryChips)
- FOUND commit: 6774b233 (refactor: ServiceChips wrapper + deferred log)
