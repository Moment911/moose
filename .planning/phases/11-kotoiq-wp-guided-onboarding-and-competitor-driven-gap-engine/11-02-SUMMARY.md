---
phase: 11-kotoiq-wp-guided-onboarding-and-competitor-driven-gap-engine
plan: 02
subsystem: kotoiq-wp-baseline-snapshot
tags: [ws2, baseline, immutable-inventory, page-discovery, migration, ssrf-guard]
requires:
  - "pageDiscovery.discoverPages + pageContentExtractor.fetchAndExtract (Phase B engines)"
  - "kotoiqDb.getKotoIQDb agency-scoped client"
  - "11-01 soft-dep contract: captureBaseline / diffChangedPost export names + param shapes"
provides:
  - "kotoiq_site_baseline table (manual-apply migration) — immutable day-1 page inventory"
  - "captureBaseline({agencyId,clientId,siteId,siteUrl}) — full-site inventory capture, insert-only"
  - "diffChangedPost({agencyId,clientId,siteId,siteUrl,postId,event}) — live per-post diff vs latest baseline"
  - "diffAgainstBaseline + baselineRowFromExtracted — pure helpers"
  - "pageDiscovery.discoverAllUrls(domain) — full same-domain sitemap list (bypasses 5-page cap)"
affects:
  - "src/lib/kotoiq/orchestrateOnboarding.ts (11-01) — its guarded captureBaseline import now resolves"
  - "src/app/api/kotoiq/wp-event/route.ts (11-01) — its guarded diffChangedPost import now resolves"
  - "Plan 11-03 (service inference reads baseline pages); WS5 coverage; WS7 'Your site today' step"
tech-stack:
  added: []
  patterns:
    - "Immutable insert-only inventory: UNIQUE(client_id,url,captured_at) + engine never UPDATE/DELETE"
    - "Full-inventory discovery path (discoverAllUrls) distinct from the 5-page competitor quick-look"
    - "SSRF guard: all fetches constrained to the client's own paired origin host"
    - "Pure-helper-first: shaping + hash-compare unit-tested without DB/network"
    - "Manual-apply migration + pointer appended to _pending_bundle / _paste_all_pending aggregates"
key-files:
  created:
    - "supabase/migrations/20260608_kotoiq_site_baseline.sql"
    - "src/lib/kotoiq/baselineSnapshot.ts"
    - "tests/kotoiq/baselineSnapshot.test.ts"
  modified:
    - "src/lib/kotoiq/pageDiscovery.ts"
    - "supabase/migrations/_pending_bundle.sql"
    - "supabase/migrations/_paste_all_pending.sql"
decisions:
  - "captureBaseline uses a NEW discoverAllUrls full-inventory path, not discoverPages (the 5-page competitor cap would silently truncate a client baseline — RESEARCH WS2)"
  - "diffChangedPost re-fetches the changed post on the paired origin (?p={id} → permalink via redirect) and diffs current hash vs latest baseline; performs NO writes (baseline stays immutable, 11-01 contract)"
  - "Baseline rows carry source_url + fetched_at (data-integrity standard) in addition to the proposed interface columns"
  - "kotoiq_site_baseline NOT added to DIRECT_AGENCY_TABLES; agency_id passed explicitly on every insert (mirrors pageGapEngine.saveSuggestions)"
metrics:
  duration: ~12min
  completed: 2026-06-08
  tasks: 2
  files: 6
---

# Phase 11 Plan 02: Day-1 Site Baseline Snapshot Summary

An immutable, insert-only inventory of the client's OWN pages — captured once at onboarding via the existing `discoverAllUrls`+`fetchAndExtract` engines — plus a live per-post diff that compares a changed post's current content hash against the latest baseline row, satisfying the 11-01 soft-dependency contract exactly.

## What Was Built

**Task 1 — Migration `kotoiq_site_baseline` (`supabase/migrations/20260608_kotoiq_site_baseline.sql`)**
New table: `id, agency_id, client_id, site_id(nullable), url, page_type, title, h1, word_count, content_hash, source_url, fetched_at, captured_at` with `UNIQUE(client_id, url, captured_at)`. The unique key + an engine that only ever INSERTs make the inventory immutable: a re-capture is a new dated row, never an overwrite. Indexes `(client_id, captured_at desc)` and `(client_id, url)` serve the latest-per-url diff lookups. RLS mirrors `kotoiq_page_suggestions`' `agency_members → auth.uid()` policy (page_factory lines 37-45). `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS` make it re-runnable. A top-of-file **"⚠️ APPLY MANUALLY via the Supabase SQL editor — do NOT run `supabase db push`"** block is present. A pointer + idempotent DDL was appended to both `_pending_bundle.sql` and `_paste_all_pending.sql` so the operator's one-shot paste includes this table.

**Task 2 — `baselineSnapshot` engine (`src/lib/kotoiq/baselineSnapshot.ts`, TDD)**
- `captureBaseline({agencyId, clientId, siteId, siteUrl})` — discovers the client's full page inventory via the **new `discoverAllUrls`** (the existing `discoverPages` caps at 5 for competitor quick-look; a client baseline needs the whole site, so this reuses the same robots→sitemap discovery path but returns the full deduped same-domain list, asset-filtered, 500-cap sanity only). Each page is extracted with `fetchAndExtract`, shaped into an immutable row (shared `captured_at` = one dated snapshot), and INSERTed in batches into `kotoiq_site_baseline`. Never UPDATE/DELETE. Never throws.
- `diffChangedPost({agencyId, clientId, siteId, siteUrl, postId, event})` — the live entry the wp-event receiver calls per changed post. Resolves the post's permalink on the paired origin (`{siteUrl}/?p={id}`, `fetchAndExtract` follows the redirect), re-extracts it, loads that URL's baseline rows newest-first, and runs the pure compare. **Performs no writes** — the baseline is immutable; this only reports whether the post changed vs day-1. Never throws (the receiver must not 500).
- Pure helpers, unit-tested without DB/network: `baselineRowFromExtracted` (ExtractedPage → insert row, incl. `source_url`/`fetched_at`), `diffAgainstBaseline` (current hash vs the LATEST baseline row per url; no baseline ⇒ changed:true with null hash).
- **SSRF guard (T-11-05):** every fetch is constrained to the client's own paired host — `discoverAllUrls` is same-domain-filtered, and `diffChangedPost` bails if a redirect leaves the client's domain.

## Soft-Dep Contract (11-01) — Verified

11-01's `orchestrateOnboarding` guard-imports `captureBaseline({agencyId,clientId,siteId,siteUrl})`; the wp-event receiver guard-imports `diffChangedPost({agencyId,clientId,siteId,siteUrl,postId,event})`. Both export names and param shapes match this plan's exports exactly, so the guarded variable-specifier dynamic imports now resolve at runtime with no edit to 11-01 code. 11-01's tests (`orchestrateOnboarding.test.ts`, `wpEventAuth.test.ts`) still pass 11/11.

## Verification

- `npx vitest run tests/kotoiq/baselineSnapshot.test.ts` → **6 passed** (shaping, diff changed/unchanged/new, immutability insert-only + one-row-per-URL, shared captured_at).
- `npx vitest run tests/kotoiq/orchestrateOnboarding.test.ts tests/kotoiq/wpEventAuth.test.ts` → **11 passed** (contract intact).
- `npx tsc --noEmit` → clean for all touched files (`baselineSnapshot`, `pageDiscovery`, test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `discoverPages` 5-page cap would silently truncate a client baseline**
- **Found during:** Task 2 implementation.
- **Issue:** The plan/RESEARCH flagged that `discoverPages` returns only the top ~5 pages (tuned for competitor quick-look). Relying on it would capture an incomplete baseline. `fetchSitemapUrls` (the full-list internal) is module-private and not exported.
- **Fix:** Added an exported `discoverAllUrls(domain)` to `pageDiscovery.ts` that reuses the identical robots→sitemap discovery path but returns the full deduped same-domain URL list (homepage first, asset-filtered, 500-URL sitemap sanity cap — NOT the 5-page cap). No new crawler. `captureBaseline` uses this.
- **Files modified:** `src/lib/kotoiq/pageDiscovery.ts`.
- **Commit:** `d05fb7df`.

**2. [Rule 1 - Bug] Test `getKotoIQDb` mock signature failed tsc**
- **Found during:** Task 2 verification.
- **Issue:** The `fromMock` was typed `vi.fn(() => ...)` (zero params) but called with the table name → `TS2554: Expected 0 arguments, but got 1`.
- **Fix:** Typed the mock as `vi.fn((_table: string) => ...)`.
- **Files modified:** `tests/kotoiq/baselineSnapshot.test.ts`.
- **Commit:** `d05fb7df`.

## OPERATOR ACTION REQUIRED — Apply Migration Manually

**`supabase/migrations/20260608_kotoiq_site_baseline.sql` must be applied MANUALLY via the Supabase SQL editor before baseline capture can persist.**

- **What:** Paste the file's contents into the Supabase SQL editor and run it. It is idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`), so re-running is safe. Alternatively it is already included (idempotent) in the `_pending_bundle.sql` / `_paste_all_pending.sql` one-shot aggregates.
- **Why manual:** prod has migration-tracking drift — **never** `supabase db push`.
- **Until applied:** `captureBaseline` inserts will error (table missing) and record `ok:false` per leg; the orchestration chain stays non-throwing, so pairing is unaffected — the baseline simply won't populate until the table exists.

## Known Stubs

None. Both contract entry points are fully implemented over real discovery/extract engines.

## Threat Flags

None beyond the plan's `<threat_model>`. T-11-05 (SSRF) is mitigated by same-host constraint; T-11-06 (cross-agency) by RLS + explicit agency_id on insert; T-11-07 (immutability) by insert-only engine + `UNIQUE(client_id,url,captured_at)` + read-only diff.

## Commits

- `6a2c9105` — feat(11-02): kotoiq_site_baseline migration (manual-apply, insert-only) (Task 1)
- `118c3106` — test(11-02): add failing tests for baselineSnapshot engine (Task 2 RED)
- `d05fb7df` — feat(11-02): baselineSnapshot engine — captureBaseline + diffChangedPost (Task 2 GREEN)

## Self-Check: PASSED

All 3 created files present on disk (migration, engine, test) + SUMMARY; all 3 task commits (`6a2c9105`, `118c3106`, `d05fb7df`) present in git history atop base `906afc1e`. baselineSnapshot 6/6 green, 11-01 contract tests 11/11 green, tsc clean for touched files.
