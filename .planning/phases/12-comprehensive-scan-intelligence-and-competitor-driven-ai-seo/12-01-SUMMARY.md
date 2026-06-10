---
phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo
plan: 01
subsystem: kotoiq-comprehensive-extraction
tags: [extraction, haiku, graceful-degrade, data-integrity, ws1]
requires:
  - kotoiq_site_baseline (11-02 baseline capture)
  - serviceInference (servicesFromHeuristic, normalizeServiceName, pageSignalsForClaude)
  - kotoiq_client_profile.fields jsonb (clientProfile.upsert helper)
provides:
  - comprehensiveExtractor.extractComprehensive (four-category Haiku + heuristic)
  - keywordsFromHeuristic / phrasesFromHeuristic / offeringsFromHeuristic (pure)
  - saveConfirmedField(category, items) — generalized fields[category] persistence
  - /api/kotoiq actions extract_comprehensive + save_field
affects:
  - 12-02 (CategoryChips read the four fields[category] lists)
  - 12-03 (synergy reads confirmed services/offerings)
  - 12-05 (opportunity list), 12-06 (strategy)
tech-stack:
  added: []
  patterns:
    - "serviceInference heuristic-first → single Haiku pass, generalized to 4 categories"
    - "graceful-degrade guard (no ! assertion, no bare catch) + ai_available flag"
    - "StoredServiceRecord {value, source_type, confidence, source_url, captured_at} reused across all categories"
key-files:
  created:
    - src/lib/kotoiq/comprehensiveExtractor.ts
    - tests/kotoiq/comprehensiveExtractor.test.ts
  modified:
    - src/lib/kotoiq/serviceInference.ts
    - src/app/api/kotoiq/route.ts
decisions:
  - "Baseline select uses only existing columns (url/h1/title/page_type/word_count); h2_list/hero_copy/meta_description/cta_list live on kotoiq_page_diff NOT kotoiq_site_baseline — extractor degrades to h1/title signal"
  - "saveConfirmedServices kept as a thin category='services' delegating wrapper for back-compat (score_grid reads fields.services[] unchanged)"
  - "Heuristic items flagged source_type:'ai_inferred' (machine-inferred → UI badges, user confirms)"
metrics:
  duration: ~8m
  completed: 2026-06-10
---

# Phase 12 Plan 01: Unified Four-Category Comprehensive Extractor Summary

Unified four-category (keywords / phrases / services / offerings) extractor over the client's own baseline pages — one Haiku pass with per-category pure-heuristic fallback and a `serviceInference`-style graceful-degrade guard — plus a generalized `saveConfirmedField(category)` persistence and two new `/api/kotoiq` actions.

## What Was Built

- **`comprehensiveExtractor.ts`** — `extractComprehensive({agencyId, clientId, pages})` runs ONE Haiku pass (`claude-haiku-4-5-20251001`, 20s AbortController, fence-stripping `safeParseComprehensive`, `logTokenUsage({feature:'kotoiq_comprehensive_extraction'})` exactly once) returning strict-JSON four lists. Per-category pure heuristics: `keywordsFromHeuristic` (stopword-stripped frequency-sorted tokens), `phrasesFromHeuristic` (2-4 word n-grams from h2/hero), `offeringsFromHeuristic` (CTA/h2 noun phrases with imperative-verb stripping), and `servicesFromHeuristic` reused from `serviceInference`. Every item wrapped in the `StoredServiceRecord` `ai_inferred` shape.
- **Graceful AI-degrade (mandatory pattern, verified):** copies `serviceInference.ts:216` — `if (!process.env.ANTHROPIC_API_KEY) return {ok:false, ai_available:false, reason:'ai_unavailable', ...all-four-heuristic}`. No `process.env.ANTHROPIC_API_KEY!` non-null assertion; no bare `catch {}` (the catch logs via `console.error` then degrades). An `ai_available` boolean is surfaced for the UI banner.
- **`saveConfirmedField(category, items)`** — category-parameterized copy of `saveConfirmedServices` writing `kotoiq_client_profile.fields[category]` in the identical `StoredServiceRecord` shape with the same dedup/sort/provenance logic. Validates `category ∈ {keywords,phrases,services,offerings}` (T-12-01). `saveConfirmedServices` now delegates with `category='services'`.
- **Two `/api/kotoiq` actions** appended to the if-chain: `extract_comprehensive` (loads latest `kotoiq_site_baseline` batch via the same loader `infer_services` uses → returns four flagged lists + `ai_available`) and `save_field` (category-validated → `saveConfirmedField`). Both ride the existing `verifySession` gate (no new auth surface).

## Verification

- `npx vitest run tests/kotoiq/comprehensiveExtractor.test.ts` → **10/10 pass** (heuristics non-empty deduped; graceful-degrade returns `ok:false`+heuristic fill without throwing; `safeParse` fenced/bare/garbage; `logTokenUsage` once on Haiku path).
- `npx vitest run tests/kotoiq/serviceInference.test.ts` → **6/6 pass** (saveConfirmedServices delegation preserves behavior).
- `npx tsc --noEmit` → **clean**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed non-existent baseline columns from the extract_comprehensive select**
- **Found during:** Task 3
- **Issue:** Initial `extract_comprehensive` handler selected `meta_description, h2_list, hero_copy, cta_list` from `kotoiq_site_baseline`. Schema check (`20260608_kotoiq_site_baseline.sql`) confirmed those columns live on `kotoiq_page_diff`, NOT the baseline table — the PostgREST select would have thrown at runtime.
- **Fix:** Select only existing columns (`url, h1, title, page_type, word_count, captured_at`); the four richer fields stay `undefined`. The extractor's heuristics + Haiku already work from the h1/title signal (12-RESEARCH WS1 line 87 anticipated this). The richer `ExtractorPageInput` fields remain optional so a future re-`fetchAndExtract` path can populate them without an interface change.
- **Files modified:** src/app/api/kotoiq/route.ts
- **Commit:** fd24fc2c

## Deferred Issues

- 2 pre-existing Phase 8 test failures in `tests/kotoiq/phase8/profileGBPPlaces.test.ts` (stale expected error string after the `9becf78` env-var dual-name patch). Not touched by any 12-01 commit; logged to `deferred-items.md`. Out of scope.

## Known Stubs

None. The four-category extraction is fully wired — heuristics are real (derive from actual page content), the Haiku path is live, and persistence writes real `fields[category]` records. The richer baseline columns being absent is a documented data-source limitation (h1/title signal), not a stub.

## Self-Check: PASSED

- FOUND: src/lib/kotoiq/comprehensiveExtractor.ts, tests/kotoiq/comprehensiveExtractor.test.ts, src/lib/kotoiq/serviceInference.ts, src/app/api/kotoiq/route.ts
- FOUND commits: ce279d5f (test/RED), af57f996 (extractor), 71675a61 (saveConfirmedField), fd24fc2c (actions)
- Exports verified: keywordsFromHeuristic, phrasesFromHeuristic, offeringsFromHeuristic, safeParseComprehensive, extractComprehensive, saveConfirmedField, saveConfirmedServices (delegating)
