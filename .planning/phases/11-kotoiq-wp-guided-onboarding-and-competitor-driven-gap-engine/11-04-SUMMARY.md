---
phase: 11-kotoiq-wp-guided-onboarding-and-competitor-driven-gap-engine
plan: 04
subsystem: ui
tags: [react, census, geo, page-gap-engine, city-picker, kotoiq, seo]

# Dependency graph
requires:
  - phase: 09-consolidate-wordpress-site-management-unified-kotoiq-wp-view
    provides: the /kotoiq-wp shell + TopicCampaignPanel that hosted the original city picker
  - phase: 10-kotoiq-wp-plugin-thin-shim-pivot
    provides: the v4 deploy path the campaign panel drives (unchanged here)
provides:
  - Shared Census-backed CityPicker controlled component (state select + filter + select-all-filtered + clear + 500-render cap + per-deploy cap)
  - analyzePageGaps explicit cities[] scoping — competitor discovery filters to chosen cities
  - selectCitiesToCheck pure helper (case-insensitive Census-set filter, drops unknown names)
affects: [11-05 gap scoring (consumes cities[] scoping), 11-06 guided shell (reuses CityPicker)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled component extraction: parent owns selection Set + chosen state; child owns list load/filter"
    - "Pure side-effect-free selection helper colocated with the engine for unit-testability"

key-files:
  created:
    - src/components/kotoiq/CityPicker.jsx
    - tests/kotoiq/pageGapEngineCities.test.ts
  modified:
    - src/components/kotoiq/TopicCampaignPanel.jsx
    - src/lib/builder/pageGapEngine.ts

key-decisions:
  - "CityPicker keeps the panel's existing old-theme styling (R/BLK/FH/FB) rather than koto/* primitives, so the still-old-theme panel renders byte-identically — behaviour-unchanged constraint outranks the styling instruction"
  - "selectCitiesToCheck is exported from pageGapEngine.ts (generic over {name}) so the explicit-cities filter is unit-testable without DB/network"
  - "Selection resets only on an ACTUAL state change (useRef guard), not on CityPicker re-mount, to match the original always-mounted picker"

patterns-established:
  - "Extract-and-reuse: lift a working in-panel control into a shared controlled component without altering host behaviour"
  - "Data-integrity filter: explicit user input only ever FILTERS an authoritative (Census) set; unknown values are dropped, never fabricated"

requirements-completed: [ONBOARD-05]

# Metrics
duration: ~20min
completed: 2026-06-08
---

# Phase 11 Plan 04: City Picker (Shared Component) Summary

**Extracted the Census-backed city multi-select out of TopicCampaignPanel into a reusable controlled `CityPicker`, and taught `analyzePageGaps` to scope competitor discovery to an explicit, user-chosen `cities[]` (Census-filtered, never fabricated).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-08T21:3x (worktree base reset to bcd03e89)
- **Completed:** 2026-06-08
- **Tasks:** 2 / 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

### Task 1 — Extract shared `CityPicker`
- New `src/components/kotoiq/CityPicker.jsx` (`"use client"`): a controlled Census city multi-select. Props: `agencyId`, `states`, `state`/`onStateChange`, `selectedCities` (Set of names), `onToggle`, `onSelectAllFiltered`, `onClear`, `cap`, plus `title`/`subtitle`/`renderCap`.
- The Census load path is **identical** to the original `loadCities()` — it POSTs `{ action: 'list_cities', agency_id, state_abbr }` to `/api/kotoiq/topic-campaign` (which wraps `geoLookup`), and each city keeps `{ name, fips, kind }` provenance. No fabrication.
- Preserved every behaviour: state `<select>`, city filter `<input>`, "Select all filtered" / "Clear", the 500-render cap with the "narrow the filter" hint, and the "Cap: 100 per deploy" line.
- `TopicCampaignPanel` now renders `<CityPicker .../>` in step 2. The panel keeps `selectedCities` + `selectedState`; the city-list state (`cities`/`loadingCities`/`citySearch`/`loadCities`/`filteredCities`) moved into the picker. `cityChip` style relocated; `reset()`'s now-dead `setCities([])` removed.

### Task 2 (TDD) — `analyzePageGaps` accepts explicit `cities[]`
- Added `cities?: string[]` to `GapAnalysisInput`. When non-empty, `citiesToCheck` is filtered to those names instead of `slice(0, cityLimit)`.
- Extracted the selection step into pure exported `selectCitiesToCheck<T extends {name}>(loaded, { cities, cityLimit })`: case-insensitive match against the Census-loaded set, **drops unknown names** (T-11-11), back-compat slice when absent/empty.
- 7 unit tests in `tests/kotoiq/pageGapEngineCities.test.ts` (RED → GREEN): named-only retention, case-insensitivity, slice fallback, empty-array fallback, unknown-name dropped, all-unknown → empty, original-object preservation.

## Behaviour-Unchanged Verification (success criterion)

- **Code-path equivalence (read-verified):** the extracted picker's load/filter/toggle/select-all/clear logic is a line-for-line lift of the originals (`loadCities` @1151, `toggleCity` @1169, `selectAllFiltered` @1177, `clearAll` @1181, `filteredCities` @1183, picker JSX @2480-2536). The panel still drives deploy/preview from the same `selectedCities` Set and `selectedState`.
- **One deliberate guard added:** because the original picker lived in an always-mounted parent while step 2 conditionally renders, a `useRef(lastLoadedState)` ensures selection resets only on an actual state change, not on re-mount — keeping the user-visible behaviour identical when toggling between step 1 and step 2.
- **Typecheck:** `npx tsc --noEmit` clean for `CityPicker`, `TopicCampaignPanel`, and `pageGapEngine` (and the full project typecheck reports no errors).
- **Tests:** `npx vitest run tests/kotoiq/pageGapEngineCities.test.ts` → 7/7 green.
- **Not browser-verified** (dashboard is behind Supabase auth — per STATE.md, live UAT requires `next dev --no-turbo`). Equivalence is established by code-path identity + typecheck.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Selection-reset-on-re-mount would diverge from original behaviour**
- **Found during:** Task 1
- **Issue:** The original picker's `loadCities` effect lived in the always-mounted `TopicCampaignPanel`, so it only fired on real state changes. Moving it into `CityPicker` (which unmounts/remounts when the panel toggles step 1 ⟷ 2) would have fired the reset on every re-entry, wiping the user's selection.
- **Fix:** Added a `useRef(lastLoadedState)` guard so `onClear()` only fires when the chosen state genuinely changes; on first mount with an already-chosen state it re-fetches the (identical) Census list without clearing the selection.
- **Files modified:** src/components/kotoiq/CityPicker.jsx
- **Commit:** c7251023

### Styling-instruction deviation (documented, intentional)

The plan's Task 1 action says "Use DESIGN.md koto/* primitives for the new component shell." The plan ALSO states (twice, as a critical constraint) that **TopicCampaignPanel behaviour must be unchanged**. The panel is still entirely old-theme (`R/BLK/FH/FB` from `../../lib/theme`); introducing koto/* primitives into the extracted picker would visibly change the panel's step-2 UI, violating the unchanged-behaviour constraint. Per RESEARCH Pitfall 6 / DESIGN.md §Migration Notes, restyling this panel is a separate in-progress migration and out of scope for an extraction plan. I therefore preserved the existing styling so the panel renders byte-identically, and documented the rationale in the CityPicker file header. The unchanged-behaviour constraint takes precedence (Rule priority).

## Threat Model Coverage

- **T-11-11 (Tampering — fabricated/non-Census city names):** mitigated. `selectCitiesToCheck` only ever filters the Census-loaded set; unknown names are dropped. Covered by tests "(3) drops a name not in the Census list" and "returns an empty list when every named city is unknown."
- **T-11-12 (Info disclosure — city list leakage):** accepted per plan (public Census data).

## Notes for Downstream Plans

- **11-05 (gap scoring):** call `analyzePageGaps({ ..., cities })` to scope the service×city grid to the chosen cities. `selectCitiesToCheck` is exported if a non-engine caller needs the same filter.
- **11-06 (guided shell):** import `CityPicker` from `src/components/kotoiq/CityPicker.jsx`. It's a controlled component — own `selectedCities` (Set) + `state` in the shell and pass the handlers. The shell can restyle via DESIGN.md primitives when the broader migration reaches this surface (the picker accepts `title`/`subtitle` for plain-English framing).

## Known Stubs

None — both deliverables are fully wired (the picker renders live Census data in the campaign panel; the engine scoping is exercised by tests). No placeholder/empty-data paths introduced.

## Self-Check: PASSED

- Files: `src/components/kotoiq/CityPicker.jsx`, `tests/kotoiq/pageGapEngineCities.test.ts`, `11-04-SUMMARY.md` — all FOUND.
- Commits: c7251023 (CityPicker), 17846910 (RED test), c2fbb212 (cities[] scoping) — all FOUND.
