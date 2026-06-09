# Phase 11: KotoIQ WP Guided Onboarding & Competitor-Driven Gap Engine — Research

**Researched:** 2026-06-08
**Domain:** Next.js 16 / React 19 dashboard wiring over existing SEO/GEO engines + Supabase + WP thin-shim RPC
**Confidence:** HIGH (all findings verified by reading source at named file:line; no external library claims needed)

---

<user_constraints>
## User Constraints (from 11-CONTEXT.md)

### Locked Decisions
- **Surface:** Everything lives at `/kotoiq-wp` (`src/views/kotoiq/KotoIQShellPage.jsx`). The first-run/client view replaces the tab-bag (Intel/Publish/Tune/Pipeline/Settings) with a **linear 6-step spine**: Connected → Your site today → Who you're up against → Your gaps → Your plan → Live + cited. Power-user tabs may remain reachable but the spine is the default guided path.
- **WS1 trigger is dashboard-side in the pair callback** (CONTEXT names `src/app/api/seo/wp-register`). On successful pair: mark connected, then fire scan + `/api/kotoiq?action=run_all_audits` (fire-and-forget, tracked via `kotoiq_sync_log`). Register `save_post` + `publish_post` webhooks via the shim `webhook.set` verb. **No plugin changes** (shim v4.2.5 is locked).
- **WS2:** Day-1 immutable snapshot of the client's OWN pages (URL, title, H1, type, word count, content hash) in a **new table**. Reuse `pageDiscovery` + `pageContentExtractor`. Ongoing state tracked separately.
- **WS3:** Infer services FROM scanned pages (not the keyword scan). Present as **editable add/remove chips** pre-seeded from the real site. Replaces the manual comma-separated textbox in `PageSuggestionsTab`. Optional per-service target phrases (auto-derive from GSC + DataForSEO AND manual pins). Flag AI-inferred services in UI.
- **WS4:** A **city multi-select** (Census-backed) replaces State+Counties as the targeting control. Chosen cities scope competitor discovery.
- **WS5:** New `scoreServiceCityGrid()`. Per cell `score = (demand + competition_strength) × (1 − our_coverage) ÷ difficulty`. Output a ranked build order bucketed into **quick wins** (already rank ~8-25), **net-new** (competitors cover, we have nothing), **big bets** (high volume/difficulty). Replaces generic best-practice strategy.
- **WS6:** Apply the link plan `localStrategistEngine` emits into published posts. Reuse `hubBuilder.ts` (pillar/hub + BreadcrumbList) for pillar→cluster + sibling cross-links. Schema-only breadcrumbs stay out of post content (KSES); link injection uses the established deploy/redeploy path. Keep an approval gate before publish.
- **WS7:** Linear 6-step spine. Every panel: plain-English "what this does" subtitle (no bare acronyms), exactly one primary action, visible status (done/running/waiting). Honor `DESIGN.md`.
- **Platform (locked, project-wide):** Data-integrity standard applies (cities via Census, ranks/competitors via live APIs, every fact wrapped in `VerifiedDataSource` with `source_url` + `fetched_at`, AI-generated flagged in UI). Supabase migrations shipped as a file but **applied manually via SQL editor — never `supabase db push`**. Every Claude call logs via `logTokenUsage`. Ship direct to `main`, no PRs.

### Claude's Discretion
- Exact schema/column names for the baseline snapshot table and the gap-score table.
- Scoring weights/normalization inside `scoreServiceCityGrid` (sane defaults, exposed constants).
- Component decomposition for the 6-step spine and how much of the old tab UI to retain.
- Service inference: cheap Claude pass over extracted page text vs heuristic over URL/H1 patterns (prefer cheapest that's accurate; flag AI-inferred in UI).
- Background-job mechanism for the orchestration chain (reuse existing `kotoiq_sync_log` fire-and-forget pattern).

### Deferred Ideas (OUT OF SCOPE)
- Auto-remediation on poor AEO (e.g. SoV<10% → rebuild schema). Step 6 surfaces citation status only.
- Auto-publish without human approval. Keep the approval gate.
- Per-site Ed25519 key rotation / any plugin-side change (owned by Phase 10 / M2).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

Requirement IDs are TBD (derive during plan per ROADMAP). The 7 workstreams map to plan units below. Research support per workstream is in the body.

| WS | Description | Research Support |
|----|-------------|------------------|
| WS1 | Orchestration spine (pair → scan + audits + webhook reg) | Pair point + `run_all_audits` + `webhook.set` all verified; one correction noted (see WS1) |
| WS2 | Day-1 baseline snapshot | `pageDiscovery`+`pageContentExtractor` ready; new table needed (existing snapshot tables are competitor-only) |
| WS3 | Service auto-extraction → chips | Current manual box found; inference is greenfield; chip patterns to mirror identified |
| WS4 | City multi-select picker | Full reusable Census city-picker already exists in `TopicCampaignPanel.jsx` |
| WS5 | Competitor-driven gap scoring | `pageGapEngine` + `localStrategistEngine` read fully; scoring is an extension/wrapper (see WS5) |
| WS6 | Auto internal-linking | Link injection ALREADY works in `deployCampaign`; reuse for Page Factory builds |
| WS7 | Guided 6-step UI shell | Shell state model + DESIGN.md primitives identified |
</phase_requirements>

---

## Summary

This phase is genuinely **wiring + one scoring function + UX assembly**. Almost every engine the CONTEXT names already exists and was read in full this session. The single most important correction for the planner: **the v4 pairing handshake does NOT run in `src/app/api/seo/wp-register/route.ts`** (that route is the legacy plugin-initiated settings-save callback and never calls `pairSite`). The real pairing completion — where `pairSite()` succeeds and `client_id`/`agency_id`/`site_id` are all in scope — is **`src/app/api/wp/route.ts`, `action === 'connect'`, immediately after line 568** (`if (!pairResult.ok)` guard) and before the success response at line 571-572. That is the correct, only-fires-once-per-pair insertion point for the orchestration chain. (See WS1 for full detail and a fallback if the planner wants to honor the CONTEXT literally.)

Three engines do the heavy lifting and are reused, not rebuilt: `pageGapEngine.analyzePageGaps()` (service×city gap scoring with competitor fingerprints + DataForSEO local volume), `localStrategistEngine.recommendLocalStrategy()` (Claude Sonnet strategy + internal-link plan), and the topic-campaign **`deployCampaign`** path which **already injects sibling + cross-campaign internal links at deploy time** via `tokenResolver` (`siblingLinks`, `ctx.hub`). WS5's `scoreServiceCityGrid()` is best built as a **thin wrapper/extension over `analyzePageGaps`** that re-expresses its existing signals as the explicit `(demand + competition_strength) × (1 − our_coverage) ÷ difficulty` formula and adds the quick-wins / net-new / big-bets bucketing — the raw inputs (search volume, competitor count, keyword difficulty, existing-page detection) are all already computed inside that engine.

**Primary recommendation:** Build as **6 plans** (orchestration spine; baseline snapshot table+capture; service inference + chips UI; city picker reuse; gap-scoring wrapper + bucketed report; guided shell) with WS6 folded into the gap/deploy plan since the linking machinery already exists. Wire orchestration at `/api/wp connect`, not `wp-register`. Reuse the `TopicCampaignPanel` city picker wholesale for WS4.

---

## Standard Stack

This phase adds **no new libraries**. Everything is already in `package.json` (verified via KOTOIQ_INVENTORY.md §1). Relevant existing deps:

| Library | Version | Purpose | Why standard here |
|---------|---------|---------|-------------------|
| Next.js | 16.2.2 | App-router API routes + SPA | Repo standard. AGENTS.md: read `node_modules/next/dist/docs/` before any new framework pattern |
| React | 19.2.4 | UI (jsx components, `"use client"`) | Shell + chips + picker are client components |
| @supabase/supabase-js | ^2.101.1 | DB | `sb()` service-role client in routes; `getKotoIQDb(agencyId)` for agency-scoped tables |
| @anthropic-ai/sdk | ^0.82.0 | Claude calls (service inference, strategist) | `logTokenUsage` mandatory on every call |
| cheerio | (in pkg) | HTML parsing in `pageContentExtractor` | Already used for content extraction + hash |
| react-router-dom | (in pkg) | `useSearchParams` for shell tab state | Shell already uses `?shell=&sub=` params |
| lucide-react | (in pkg) | Icons | **Gotcha:** Facebook/Instagram/Youtube not exported — alias to Globe/Camera/Play (MEMORY) |

**Models in use (verified across 33 call sites in `src/lib`):** `claude-sonnet-4-6-20250627` (strategist, quality), `claude-haiku-4-5-20251001` (cheap classification). [VERIFIED: grep src/lib] Use Haiku for service inference if a Claude pass is chosen (CONTEXT discretion).

**No `npm install` needed for this phase.**

---

## Architecture Patterns

### Where things live (verified)

```
src/app/api/wp/route.ts              # action='connect' → pairSite() → WS1 insertion point (line 556-572)
src/app/api/seo/wp-register/route.ts # legacy plugin settings-save callback (NOT the pair handshake)
src/app/api/kotoiq/route.ts          # ~6400-line monolith; run_all_audits @5635, analyze_competitors @1398,
                                     #   dfs_compare @5256, trigger_auto_setup @4711, recommendLocalStrategy @6067,
                                     #   analyzePageGaps @6191, AUTH gate @427-467
src/app/api/kotoiq/topic-campaign/route.ts  # deploy @1698, redeploy @1999, deploy_hub @608/124 — LINK INJECTION lives here
src/app/api/builder/gaps             # entry point PageSuggestionsTab POSTs to (action='analyze')
src/app/api/seo/grid-scan/route.ts   # Google Places geo-rank grid (geocode + searchNearby)
src/lib/builder/pageGapEngine.ts     # analyzePageGaps() — the WS5 core to extend
src/lib/kotoiq/localStrategistEngine.ts  # recommendLocalStrategy() — strategy + internal_linking_strategy
src/lib/kotoiq/pageDiscovery.ts      # discoverPages(domain) — sitemap/robots → DiscoveredPage[]
src/lib/kotoiq/pageContentExtractor.ts   # fetchAndExtract(url) → ExtractedPage (h1, word_count, content_hash...)
src/lib/wp-shim/shimRpc.ts           # signed Ed25519 RPC client (shimRpc, shimRpcBatch)
src/lib/wp-shim/verbs/index.ts       # webhookSet(siteUrl, {event,url}) @570
src/lib/wp-shim/verbList.ts          # canonical 27-verb whitelist (webhook.set @57)
src/lib/wp-shim/hubBuilder.ts        # buildHubPage() — pillar/hub + BreadcrumbList (pure fn)
src/lib/wp-shim/tokenResolver.ts     # siblingLinks @45/589, ctx.hub @1120 — how links enter post HTML
src/lib/wp-shim/pairSite.ts          # pairSite(supabase, agencyId, siteId, siteUrl) @136
src/lib/geoLookup.ts                 # Census wrappers (getPlacesForState etc.) — VerifiedDataSource
src/views/kotoiq/KotoIQShellPage.jsx # the shell to extend (tab state via useSearchParams)
src/components/kotoiq-wp/{ClientView,FleetView,SitesTable}.jsx  # Phase 9 consolidation views
src/components/kotoiq/PageSuggestionsTab.jsx # current manual services/state/counties form to replace
src/components/kotoiq/TopicCampaignPanel.jsx # REUSABLE Census city multi-select @2480-2536
src/components/ui/koto/*             # DESIGN.md primitives (SectionHeader, WorkflowStepper, etc.)
```

### Pattern: monolith route dispatch
`/api/kotoiq/route.ts` dispatches on `body.action` with a long `if (action === '...')` chain. New actions append in the same style. **AUTH gate** (lines 427-467): internal callers pass `Authorization: Bearer ${CRON_SECRET}`; browser fetches are soft-gated (trust `body.agency_id` when `verifySession` returns unverified — legacy migration in progress). `run_all_audits`'s background runner re-calls `/api/kotoiq` over HTTP with the CRON_SECRET header (line 5655-5657) — copy this fire-and-forget pattern for the WS1 chain.

### Pattern: agency-scoped DB
`getKotoIQDb(agencyId)` auto-injects `.eq('agency_id', ...)` for tables in `DIRECT_AGENCY_TABLES`. `kotoiq_page_suggestions` is NOT in that list — `pageGapEngine` uses `db.from('kotoiq_page_suggestions')` and passes `agency_id` in the row. New WS2/WS5 tables: decide whether to add to `DIRECT_AGENCY_TABLES` or pass agency_id explicitly (mirror `pageGapEngine.saveSuggestions`).

### Pattern: shell tab state (WS7)
`KotoIQShellPage.jsx` keeps top-level tab in `?shell=` and sub-tab in `?sub=` via `useSearchParams` (react-router-dom). `intel` short-circuits to `<KotoIQPage/>` (line 144). The 6-step spine should be a NEW shell value (e.g. `?shell=guided` or a first-run default) that renders a stepper without disturbing `FleetView`/the existing tabs. DESIGN.md **Pattern 7 (WorkflowStepper)** is the exact primitive for the 6-step rail; **Pattern 3 (EducationalNote)** for the "what this does" subtitles; **Pattern 10 (LiveTicker)** for "scan running" status.

### Anti-patterns to avoid
- **Do NOT add a plugin webhook for "paired"** — none exists in the shim allowlist and CONTEXT forbids plugin changes. Pairing is dashboard-initiated; the dashboard already knows the moment it completes.
- **Do NOT modify the shim / `wp-plugin-kotoiq-shim/`** — locked v4.2.5.
- **Do NOT hardcode cities/ranks/difficulty** — data-integrity standard. Cities via Census (`geoLookup`), ranks via DataForSEO/Places, difficulty via `kotoiq_keywords`/DataForSEO KD.
- **Do NOT `supabase db push`** — prod has tracking drift; apply migration SQL manually.
- **Do NOT inject BreadcrumbList HTML into post body** — schema-only (KSES); CONTEXT + existing `tokenResolver` already keep breadcrumbs in JSON-LD.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| City multi-select (WS4) | New picker | `TopicCampaignPanel.jsx` city-picker @2480-2536 (state select + filter + select-all-filtered + cap + Census load via `loadCities()` @1151) | Already Census-backed, already handles 500-city render cap, already in brand |
| Page discovery (WS2) | Sitemap crawler | `discoverPages(domain)` in `pageDiscovery.ts` | robots→sitemap→scored candidates done |
| Page content + hash (WS2) | HTML parser | `fetchAndExtract(url)` → `ExtractedPage{h1,word_count,content_hash,...}` | cheerio extraction + SHA-256 content hash done |
| Service×city gap scoring (WS5) | New scorer | extend `analyzePageGaps()` | volume, competitor count, KD, existing-page detection, fingerprints, DataForSEO local volume all already computed |
| Internal linking on deploy (WS6) | Link injector | `deployCampaign` `siblingLinks`/`crossByCity` + `tokenResolver` `ctx.siblingLinks`/`ctx.hub` | already weaves sibling + cross-campaign + hub links into deployed HTML |
| Pillar/hub page (WS6) | Hub builder | `buildHubPage()` (pure fn) + `deploy_hub` action | CollectionPage + BreadcrumbList + ItemList done |
| Census geo (WS4) | Census fetcher | `geoLookup.getPlacesForState()` (returns `VerifiedDataSource`) | data-integrity compliant |
| Signed WP RPC (WS1) | RPC client | `shimRpc()` / `webhookSet()` | Ed25519 signing, replay protection, discriminated-union returns done |

**Key insight:** The hardest-looking item (WS6 auto-linking) is the *least* new work — it already runs in `deployCampaign`. The newest work is WS3 service inference (greenfield) and WS5's explicit score formula (a re-expression of existing signals).

---

## Workstream-by-Workstream

### WS1 — Orchestration spine

**Where pairing actually completes (CORRECTION):**
- CONTEXT says fire at `src/app/api/seo/wp-register/route.ts`. **That route does NOT run the v4 pair handshake.** Read in full (85 lines): it's the plugin POSTing its settings; it only upserts `koto_wp_sites` (`connected:true`, `plugin_version`) and returns `site_id`/`agency_id`. It never calls `pairSite`, never sets `shim_version='v4'`.
- **The real v4 pair completion is `src/app/api/wp/route.ts` `action==='connect'`** (lines 500-572). It probes `/wp-json/kotoiq-shim/v1/meta`, upserts the site row, calls `pairSite(sb, finalAgency, row.id, cleanUrl)` (line 556-557), and on success refreshes + returns the paired row (line 571-572). At that point in scope: `finalAgency` (agency_id), `row.id` (site_id), `client_id` (from body, line 505/538/547), `cleanUrl` (domain). **Cleanest insertion: a fire-and-forget block right after the `if (!pairResult.ok)` guard (after line 568), before the success response.**
- **Recommendation for the planner:** Wire the chain at `/api/wp connect`. If you want to also honor the CONTEXT literally, `wp-register` can stay as a *secondary* trigger that no-ops when the site is already orchestrated (guard on an existing `kotoiq_sync_log` run for the client). But the authoritative, fires-exactly-once-on-pair point is `/api/wp connect`. Flag this as an [ASSUMED]→confirm with user since it contradicts the locked CONTEXT decision.

**The scan + audits chain:**
- `run_all_audits` action (`/api/kotoiq/route.ts` @5635): input `{client_id, agency_id}`; requires `clients.website`. Inserts a `kotoiq_sync_log` row (`source:'run_all_audits'`, `status:'running'`, `metadata:{wave,total_waves,completed_actions[],failed_actions[]}`), returns `{ok:true, run_id}` immediately, then runs **4 waves** in a fire-and-forget `runBackground()` that re-POSTs `/api/kotoiq` per sub-action with the CRON_SECRET header. Wave actions: W1 quick_scan/sync/deep_enrich/audit_eeat/scan_brand_serp/analyze_backlinks/gmb_health/audit_schema/roi_projections/crawl_sitemaps; W2 generate_topical_map/generate_scorecard/scan_internal_links/build_content_inventory/run_gsc_audit/analyze_semantic_network/sync_page_factory; W3 audit_topical_authority/generate_strategic_plan/analyze_query_paths/build_content_calendar; W4 synthesize (mirror recs → `kotoiq_recommendations`, regen scorecard/strategy/quick_wins).
- **Progress tracking shape:** poll `run_all_status` action (@5831) with `run_id` → `{status, wave, total_waves, completed_actions[], failed_actions[], completed_at}`. The 6-step shell's "scan running" status (WS7) reads this.
- **WS1 chain = call `run_all_audits` for the just-paired client.** The baseline snapshot (WS2) should run in the same chain (before or in parallel). Reuse the exact fire-and-forget + `kotoiq_sync_log` pattern (CONTEXT discretion confirms this).

**Webhook registration (`webhook.set`):**
- Client: `webhookSet(siteUrl, {event, url})` in `src/lib/wp-shim/verbs/index.ts` @570. Allowed events (hardcoded @551): `save_post, publish_post, delete_post, trashed_post, wp_login, wp_logout, shim_health_check_failed`. `url` must be `https://...` or `null`. Returns `{ok, event, url, all_webhooks}`.
- Register two: `save_post` and `publish_post`, each pointing at a **NEW dashboard receiver route** (e.g. `/api/wp/inbound` or `/api/kotoiq/wp-event`). **There is NO existing inbound receiver for these events** — verified: `grep save_post/publish_post src/app/api/` returns zero route handlers. The planner must create one. It should authenticate the inbound call (the shim emitter posts to the registered URL — confirm the emitter's auth shape from `wp-plugin-kotoiq-shim` Plan 10-05 "webhook emitter"; reference-only, don't modify), then re-run the WS2 snapshot/diff for the changed post so inventory stays live (no polling).
- **Gotcha:** `webhookSet` throws (not discriminated-union) on a disallowed event or non-https url — wrap in try/catch.

**Smallest correct change:** new fire-and-forget block in `/api/wp connect` after pair success that (1) calls `run_all_audits` for the client, (2) calls the WS2 snapshot, (3) `webhookSet` for save_post + publish_post → the new receiver URL. Plus the new receiver route.

---

### WS2 — Baseline snapshot

**Reuse:** `discoverPages(client.website)` → `DiscoveredPage[]` (caps at 5 by default — note: this is tuned for *competitor* quick-look; for a full client baseline the planner likely wants the raw sitemap URLs, so call `fetchSitemapUrls`/the discovery internals or raise the cap). Then `fetchAndExtract(url)` per page → `ExtractedPage{url, h1, meta_title, word_count, content_hash, schema_orgs, ...}`.

**Existing tables do NOT cover this:** `kotoiq_page_snapshots` + `kotoiq_tracked_pages` + `kotoiq_page_changes` (migration `20260609_kotoiq_page_diff.sql`, engine `pageDiffEngine.ts`) are **competitor-page** diffing (`competitor_domain`, `tracked_page_id`). `kotoiq_content_inventory` (migration `20260501`) is the *ongoing* crawled inventory (freshness/trajectory/refresh_priority) — that's the "ongoing state tracked separately" the CONTEXT references, NOT an immutable day-1 baseline. **A new table is required.**

**Proposed minimal table** (Claude's discretion on names; consistent with `kotoiq_page_snapshots` column style):
```
kotoiq_site_baseline (
  id            uuid PK default gen_random_uuid(),
  agency_id     uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  site_id       uuid,                       -- koto_wp_sites.id (nullable; pre-pair scans)
  url           text NOT NULL,
  page_type     text,                       -- inferPageType() output
  title         text,                       -- meta_title
  h1            text,
  word_count    int,
  content_hash  text NOT NULL,              -- ExtractedPage.content_hash (SHA-256)
  captured_at   timestamptz DEFAULT now(),
  UNIQUE (client_id, url, captured_at)      -- immutable: insert-only, never update
)
```
Index on `(client_id, captured_at desc)` and `(client_id, url)`. RLS: mirror `kotoiq_page_suggestions`' agency-isolation policy (`agency_id IN (SELECT agency_id FROM agency_members WHERE user_id = auth.uid())`) from `20260608_page_factory.sql` lines 37-45. **Immutability** = the engine only ever INSERTs; later diffs compare current `fetchAndExtract` hashes against the latest baseline row per URL.

**Migration convention:** ship as `supabase/migrations/YYYYMMDD_kotoiq_site_baseline.sql`, apply manually in SQL editor (NEVER db push). The repo also keeps `_pending_bundle.sql`/`_paste_all_pending.sql` aggregates — check whether the planner should append there too.

---

### WS3 — Service auto-extraction → chips

**How services are represented today (multiple, inconsistent sources):**
- `clients.primary_service` (dedicated column, voice agent writes here) + `clients.onboarding_answers` jsonb (`products_services`, web form writes here) — resolve via the `pick(client, ...keys)` helper (onboarding module).
- `kotoiq_client_profile.primary_service` (hot column) + `fields` jsonb (Phase 7 seeder, provenance-wrapped).
- `kotoiq_page_suggestions.service` (per-row, the gap output).
- **Current manual entry:** `PageSuggestionsTab.jsx` line 47-51 — `services` is a comma-separated `<input>` (line 333-338); `uniqueServices` (line 271) is derived from existing suggestions only. There is **no inference** today.
- `voiceOnboardingAutoSetup.ts` (action `trigger_auto_setup` @4711) only extracts *keywords*, not a clean services list (confirmed by ROADMAP note).

**Inference is greenfield.** CONTEXT discretion: heuristic (URL/H1 patterns from `ExtractedPage`) vs cheap Claude pass. Recommendation: a **Haiku** pass over the baseline pages' `h1` + `meta_title` + URL path segments is cheapest-accurate; `inferPageType` already isolates `/services/...`-style paths. Log via `logTokenUsage({feature:'kotoiq_service_inference', model:'claude-haiku-4-5', ...})`.

**Where to store + edit inferred services:** simplest correct option — a `services` (or `inferred_services`) jsonb array on the **new `kotoiq_site_baseline`** companion, OR a dedicated small column on `kotoiq_client_profile.fields` (provenance-wrapped, since Phase 7 already owns "AI-inferred, user-editable with provenance"). Given the data-integrity flag-AI requirement, **storing in `kotoiq_client_profile.fields` with a `source_type:'ai_inferred'` ProvenanceRecord is the most consistent existing pattern** (Phase 7 `kotoiq_client_profile` + `ConversationalBot` choice-chips already model AI-inferred + user-edit). Confirmed services then feed the WS5 grid as `services[]`.

**Chip UI to mirror:** `ConversationalBot.jsx` `ChoiceChips` @918 (clickable add/remove chips); `AEOVisibilityTab.jsx` `chip()` @789 + `chipButton()` @790 (the canonical DESIGN.md reference tab). Use DESIGN.md **Pattern 8 (FlagChip)** styling + an "AI-inferred" badge (Pattern 8 `info`/violet variant — `AEOVisibilityTab` already renders an `AI` chip @618 for `created_by==='ai_seed'`). Add/remove is local state + a save action.

**Optional target phrases:** auto-derive from `kotoiq_keywords` (GSC + DataForSEO already populate it) filtered to the service; let the user pin/add manually. Both seed the grid as the per-cell "demand" phrases.

---

### WS4 — City multi-select picker

**Fully reusable picker exists:** `TopicCampaignPanel.jsx` lines 2480-2536 — state `<select>` (from `states`), city filter `<input>`, `selectedCities` Set, `toggleCity`, `selectAllFiltered`, `clearAll`, 500-render cap, "Cap: 100 per deploy". Cities load via `loadCities()` @1151 → sets `cities` from a geo API (`/api/geo`-style) → each city `{name, fips, kind}` (Census). The `cityChip()` style is @3693. **Extract this into a shared component** (`src/components/kotoiq/CityPicker.jsx` or `components/ui/koto/`) and reuse in both the guided shell and `PageSuggestionsTab`'s replacement.

**What competitor discovery needs from the picker:** the chosen city names + state. Downstream consumers already accept location:
- `analyzePageGaps({services, state, counties?, cityLimit})` — currently county/state scoped; **extend its input to accept an explicit `cities: string[]`** (today it loads ALL cities for the state via `loadCities()` @528-562 reading `public/geo/{state}.json` and slices to `cityLimit`). The smallest change: when `cities[]` is provided, filter `citiesToCheck` to those names instead of `slice(0, cityLimit)`.
- `analyze_competitors` (@1398) accepts `market:{service, city, state}` → builds `"{service} {city} {state}"` keyword for SERP/DataForSEO discovery.
- `grid-scan` (`/api/seo/grid-scan`) takes a location string → geocodes → Google Places `searchNearby` grid.

**Census source:** `geoLookup.getPlacesForState(stateAbbr)` returns `PlacesResult extends VerifiedDataSource` (data-integrity compliant). The picker's load path should use this (or the existing `/api/geo` endpoint that wraps it — confirm the exact route `loadCities` hits @1155-1162).

---

### WS5 — Competitor-driven gap scoring (`scoreServiceCityGrid`)

**The engines feeding the grid:**
- `pageGapEngine.analyzePageGaps(input)` — input `{agencyId, clientId, services[], state, counties?, cityLimit, enrichWithLocalVolume, enrichTopN, fingerprintCompetitors, fingerprintTopN}`. Loads (in parallel) sitemap URLs, `kotoiq_keywords` (volume+opportunity_score), topical nodes, `kotoiq_competitor_url_snapshots`, grid scans, census cities, semantic analysis, strategic plan, content inventory. Produces `PageSuggestion[]` with `{service, city, state, priority(0-100), reason, search_volume, keyword_difficulty, competitor_count, competitor_urls[], competitor_fingerprints?}`. **Current priority** (lines 197-255) is additive heuristic: base 30 + volume bands + competitor presence + topical gap + KD bands + strategic attack/abandon + perf-feedback boost, capped 0-100. DataForSEO local-volume enrichment re-scores the top-N (lines 294-355).
- `localStrategistEngine.recommendLocalStrategy(s, body)` — input `{client_id, agency_id, business_name, business_model, services[], areas[]}`; Claude Sonnet returns `LocalStrategy` including `topic_clusters[]` (with `kind:'service_x_city'`, line 44) and `internal_linking_strategy{hub_and_spoke, cross_links[]}`. Persists clusters → `kotoiq_page_suggestions`. This is the strategy/link-plan source, NOT the rank-driven scorer.

**The desired formula vs current priority — the gap:** CONTEXT wants `score = (demand + competition_strength) × (1 − our_coverage) ÷ difficulty`. `analyzePageGaps` already computes each input but blends them *additively* and never multiplies by coverage or divides by difficulty:
- **demand** ← `search_volume` (DataForSEO local volume when enriched, else `kotoiq_keywords.kp_monthly_volume`) + client targets-it (in grid) + derived phrase volume.
- **competition_strength** ← `competitor_count` + competitor rank strength. Today `competitor_count` comes from `kotoiq_competitor_url_snapshots` ranking_keywords (coarse). For *authoritative* competitor rank, the better source is **`analyze_competitors` / `dfs_compare` (DataForSEO SERP `rank_group`)** and **`grid-scan` / `kotoiq_grid_scans_pro`** (Google Places local rank). [VERIFIED: analyze_competitors @1430 maps `serpUrls` with `rank: item.rank_group`.] The wrapper should pull a real per-cell rank set (how many competitors rank, how strong) from these, not just the snapshot count.
- **our_coverage** ← existing-page detection. `analyzePageGaps` already builds `existingPageIndex` from sitemap URLs (lines 117-118, 566-580) and skips combos that already have a page. For the formula, "our_coverage" must be a *degree* (0 = nothing, 1 = strong page; thin page = partial). Determine from: (a) baseline/sitemap match → page exists, (b) `kotoiq_content_inventory.sc_position` (already ranking) and `kotoiq_semantic_analysis.thin_content_pages` (thin) → `analyzePageGaps` already loads both (`rankingPages` @145-151, `thinPages` @154-163). A thin existing page = partial coverage (the "quick win" case).
- **difficulty** ← `keyword_difficulty`. Today derived as `100 - opportunity_score` from `kotoiq_keywords` (line 589) or DataForSEO KD. Available; use directly.

**Is it an extension or a new wrapper?** **A new wrapper** (`scoreServiceCityGrid()`) that calls `analyzePageGaps` (or its loaders) to gather the signals, then computes the explicit formula per cell and buckets:
- **quick wins** — existing page already ranks ~8-25 (`kotoiq_content_inventory.sc_position` in [8,25]) → partial coverage, low effort.
- **net-new** — competitors cover (competition_strength>0) AND our_coverage≈0.
- **big bets** — high (demand × difficulty), our_coverage≈0.
Plus the CONTEXT specific: a client-listed city with NO competitor target → surface as quick win OR low-demand deprioritize, with the reason shown. Keep the additive `priority` for backward-compat with `PageSuggestionsTab`, but add the formula `score`, `bucket`, and `our_coverage`/`competition_strength` breakdown to each row (via the `metadata` jsonb or new columns).

**Where it lives:** new `src/lib/builder/scoreServiceCityGrid.ts` (next to `pageGapEngine.ts`), exposed via a new action in `/api/kotoiq/route.ts` or `/api/builder/gaps`. Expose scoring weights as exported constants (CONTEXT discretion). Persist to a **new gap-score table** OR extend `kotoiq_page_suggestions` with `score numeric`, `bucket text`, `our_coverage numeric`, `competition_strength numeric` columns (cleaner: extend, since the suggestion row already carries service/city/state/competitor data and the Page Factory UI reads it). Claude's discretion on table vs columns.

**Data-integrity for ranks:** competitor ranks (DataForSEO SERP `rank_group`, Google Places) and difficulty (DataForSEO KD) are real-world facts → must be wrapped/timestamped per the standard. The grid output should carry `fetched_at` + source on the competitor-rank inputs.

---

### WS6 — Auto internal-linking

**The machinery already exists and runs at deploy:** `deployCampaign` (`topic-campaign/route.ts` @1698) pre-computes `siblingLinks` (new batch + prior published deploys, deduped by city, @1745-1770) and `crossByCity` (cross-campaign "Related Services in {City}", @1772-1779), then passes them into `resolveMaster`/`tokenResolver`. `tokenResolver.ts` consumes `ctx.siblingLinks` (@45, filters out self @589) and `ctx.hub` (@1120, BreadcrumbList JSON-LD only). `buildHubPage()` builds the pillar/hub (CollectionPage + BreadcrumbList + ItemList) and `deploy_hub` (@608/124) publishes it; city pages get a `Home > Hub > City` breadcrumb once a hub exists and the campaign re-deploys (session-log #6).

**`localStrategistEngine.internal_linking_strategy` output:** `{hub_and_spoke: string (narrative), cross_links: [{from_pattern, to_pattern, anchor_strategy}]}` (lines 66-69). It's a **plan/narrative**, not concrete URLs — it describes the pattern. The concrete URL weaving is what `deployCampaign` already does with real deployed URLs.

**What's missing to apply it on Page Factory publish:** Page Factory builds (`/api/builder/generate`, `PageSuggestionsTab` "Build N Pages") go through a different publish path than topic-campaign `deployCampaign`. The gap: **Page Factory's publish needs the same `siblingLinks`/`crossByCity`/`ctx.hub` injection that `deployCampaign` performs.** Two options for the planner:
1. **Reuse (preferred):** route Page Factory service×city builds through the topic-campaign deploy path (they're the same shape — service×city pages with sibling cities), or extract the sibling/cross/hub computation from `deployCampaign` into a shared helper and call it from the Page Factory publish.
2. **New thin glue:** at Page Factory publish, query other published Page Factory pages for the same client/site/service, build the sibling URL set, and pass through the existing `tokenResolver` ctx.

**Smallest correct change:** extract the sibling/cross/hub link computation (currently inline in `deployCampaign` @1745-1785) into an exported helper (e.g. `computeInternalLinks(supabase, siteId, campaignId/serviceKey, locations)`), then call it from the Page Factory publish before writing. Reuse `buildHubPage`/`deploy_hub` for the pillar. **Keep the approval gate** (CONTEXT deferred: no auto-publish).

---

### WS7 — Guided 6-step UI shell

**Current shell state:** `KotoIQShellPage.jsx` — `?shell=` (intel/publish/tune/pipeline/settings) + `?sub=` via `useSearchParams`; `intel` returns `<KotoIQPage/>` directly (@144). No localStorage for tabs (only DESIGN.md sidebar collapse uses localStorage elsewhere). `useClient()` provides `clientId`; `useAuth()` provides `agencyId`.

**Cleanest way to add the spine without breaking FleetView:** Add a new shell mode (e.g. `?shell=guided`, made the **default for first-run/client view**) that renders a 6-step stepper component. `FleetView`/`ClientView` (`src/components/kotoiq-wp/`) and the existing tabs stay reachable as power-user paths. The 6 steps map to existing data/actions:
1. **Connected** — pair status from `koto_wp_sites.shim_version==='v4'` + `connected`.
2. **Your site today** — WS2 baseline (page count, types) from `kotoiq_site_baseline`.
3. **Who you're up against** — competitor discovery (`analyze_competitors`/`grid-scan`) scoped by WS4 cities.
4. **Your gaps** — WS5 `scoreServiceCityGrid` bucketed report ("38 opportunities — 9 quick wins, 21 net-new, 8 big bets").
5. **Your plan** — ranked build order → Page Factory generate (existing `PageSuggestionsTab` build flow, restyled).
6. **Live + cited** — published pages + AEO citation status (`aeoVisibilityEngine`); surface only (no auto-remediate — deferred).

**DESIGN.md primitives (MANDATORY, `src/components/ui/koto/`):** WorkflowStepper (Pattern 7) for the 6-step rail; SectionHeader (1) + EducationalNote (3) for "what this does" subtitles glossing acronyms (AEO/GEO); ActionCallout (4) one primary action per step; LiveTicker (10) for "scan running" status driven by `run_all_status` polling; EmptyState (5), FlagChip (8), Skeleton (12). Palette/tokens from DESIGN.md `:root` (navy `#201b51`, pink `#cb1c6b`, cream `#faf9f6`). `AEOVisibilityTab.jsx` is the canonical reference implementation.

**Note:** existing shell + `PageSuggestionsTab` still use the OLD theme (`src/lib/theme` — `#111`, `#fff`, `FH/FB`), not the new DESIGN.md tokens/primitives (migration in progress per DESIGN.md §Migration Notes). New WS7 code MUST use the new tokens/primitives; restyling the reused `PageSuggestionsTab` is in-scope for "how much old tab UI to retain" (CONTEXT discretion).

---

## Cross-Cutting

### Data integrity (`src/lib/dataIntegrity.ts` / `dataSources.ts`)
- Authoritative sources: **cities → Census** (`geoLookup`), **competitor ranks → DataForSEO SERP `rank_group` + Google Places** (`analyze_competitors`/`grid-scan`), **difficulty → `kotoiq_keywords` opportunity_score or DataForSEO KD**, **reviews → platform APIs** (`eeatContext` already pulls live Google reviews in `deployCampaign` @1783).
- Wrapping: `createVerifiedData(data, {source_url, source_name, source_type, fetched_at, expires_at, ...})` (signature @100); `buildExpiresAt(category)` for staleness; `VerifiedDataSource` interface @36. Stale thresholds: rankings/live GBP 24h, reviews 7d, geo 6-12mo. UI: `DataSourceBadge.jsx` grades freshness; **AI-inferred services (WS3) must carry an AI-generated flag** in the chip UI.

### Supabase / migration convention
- Migrations are FILES applied MANUALLY via SQL editor — never `supabase db push` (prod tracking drift; MEMORY + CONTEXT). New tables this phase: `kotoiq_site_baseline` (WS2), optionally a gap-score table (WS5; or extend `kotoiq_page_suggestions`).
- Relevant existing `kotoiq_*` tables: `kotoiq_sync_log` (orchestration tracking), `kotoiq_page_suggestions` + `kotoiq_style_profiles` + `kotoiq_publish_watches` (`20260608_page_factory.sql`), `kotoiq_keywords`/`kotoiq_snapshots` (keyword facts), `kotoiq_competitor_url_snapshots`/`kotoiq_competitors` (competitor data), `kotoiq_grid_scans_pro` (local rank), `kotoiq_content_inventory` (ongoing inventory), `kotoiq_semantic_analysis` (thin pages), `kotoiq_strategic_plans`, `kotoiq_recommendations`, `kotoiq_client_profile` (Phase 7 services/provenance), `koto_wp_sites` (pairing/shim_version/client_id), `koto_topic_campaigns`/`koto_topic_campaign_deploys` (deploy + sibling links).
- RLS: `kotoiq_page_suggestions` uses `agency_members`-based policy; new tables should mirror it. `getKotoIQDb` agency auto-scoping covers a fixed `DIRECT_AGENCY_TABLES` list — new tables either join it or pass agency_id explicitly.

### Sequencing / dependencies between the 7 workstreams
```
WS1 (orchestration) ─┬─► WS2 (baseline) ─► WS3 (service inference, needs baseline pages)
                     │
WS4 (city picker, independent) ─────────────┐
                                            ▼
WS3 services + WS4 cities ─► WS5 (gap scoring) ─► WS6 (auto-link on build/publish)
                                            │
All of the above ──────────────────────────┴─► WS7 (guided shell assembles steps 1-6)
```
- **WS4 is fully independent** (reuse existing picker) — can land first/parallel.
- **WS2 depends on WS1** only for the auto-trigger (the snapshot engine itself is standalone and testable without pairing).
- **WS5 depends on WS3 (services) + WS4 (cities).**
- **WS6 depends on WS5** (it links what the build order produces) but the linking machinery is reuse, not new.
- **WS7 is last** (assembles 1-6) but its shell scaffold can start early.
- **Phase 10 dependency:** Phase 10 is **code-complete (2026-05-27)**; orchestration on the v4 shim is available. Pairing requires `shim_version==='v4'` (`deployCampaign` @1727 hard-gates this; `webhook.set` + `elementor.save` are v4 verbs). The pilot pair (Plan 11 Task 3) is calendar-gated/operator-pending but does not block building Phase 11 against the existing pair path.

### Background-job mechanism
Reuse the `run_all_audits` fire-and-forget pattern: insert `kotoiq_sync_log` row, return `run_id` immediately, run waves in a detached async fn that re-POSTs `/api/kotoiq` with `Authorization: Bearer ${CRON_SECRET}`, update `kotoiq_sync_log.metadata` per wave, poll via `run_all_status`. **Caveat (Vercel):** fire-and-forget after returning a response can be killed when the function freezes — `run_all_audits` already accepts this risk (the existing code does exactly this). If reliability matters, the planner could wrap in `after()` (Next 16) or a Vercel Workflow (already used in Phase 4) — but matching the existing pattern is what CONTEXT asks for. Read `node_modules/next/dist/docs/` before using `after()` (AGENTS.md).

---

## Runtime State Inventory

Phase 11 is additive (new tables/routes/UI), not a rename/refactor. The closest "live state" concerns:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New `kotoiq_site_baseline` rows; possibly new columns on `kotoiq_page_suggestions` | migration applied manually |
| Live service config | `webhook.set` registers save_post/publish_post on the WP site (lives in WP options, set via RPC at pair time) — NOT in git. Re-runs idempotently on re-pair. | register in WS1 chain; document that unpair/re-pair must re-register |
| OS-registered state | None | None — no cron/task changes (existing crons untouched) |
| Secrets/env vars | Uses existing `KOTOIQ_SHIM_DASHBOARD_PRIVKEY`, `CRON_SECRET`, `CENSUS_API_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_GOOGLE_PLACES_KEY`. No new secrets. | verify all present in Vercel before pilot |
| Build artifacts | None | None |

**Webhook re-registration:** the one piece of live, non-git state — `save_post`/`publish_post` webhooks set on the WP site via `webhook.set`. Must be (re)registered on every successful pair; if a site is unpaired/re-paired the dashboard must re-register or inbound events silently stop.

---

## Common Pitfalls

### Pitfall 1: Wiring orchestration to the wrong route
**What goes wrong:** Adding the chain to `seo/wp-register` (per CONTEXT literal) fires on every plugin settings-save (not just pairing), or never fires with `client_id`/v4 context because that route doesn't run `pairSite`. **Avoid:** wire at `/api/wp connect` after pair success (line 568); if also touching `wp-register`, guard against duplicate runs via an existing `kotoiq_sync_log` check.

### Pitfall 2: Treating `kotoiq_page_snapshots` as the client baseline
**What goes wrong:** Those tables are competitor-page diffing — reusing them mixes the client's own pages with tracked competitor pages. **Avoid:** new `kotoiq_site_baseline` table, insert-only.

### Pitfall 3: Re-blending instead of re-expressing in WS5
**What goes wrong:** Bolting the formula on top of the additive `priority` double-counts signals. **Avoid:** compute the formula from the *raw* signals (volume, competitor rank set, coverage degree, KD) in the new wrapper; keep `priority` only for back-compat.

### Pitfall 4: `webhookSet` throws on bad input
**What goes wrong:** Passing a non-https url or a disallowed event throws (not a discriminated-union return). **Avoid:** wrap `webhookSet` in try/catch; ensure the receiver URL is `https://` and the event is in the allowlist.

### Pitfall 5: Fire-and-forget killed by Vercel freeze
**What goes wrong:** The detached chain may not complete after the response returns. **Avoid:** match the existing `run_all_audits` pattern (accepted risk), or use `after()`/Workflow for the critical legs. Surface real status via `kotoiq_sync_log` so a half-run is visible, not silently "broken" (CONTEXT WS7 status requirement).

### Pitfall 6: New UI in the old theme
**What goes wrong:** Copying `PageSuggestionsTab`'s `#111`/`FH/FB` tokens into the new spine violates DESIGN.md. **Avoid:** use `src/components/ui/koto/*` primitives + DESIGN.md `:root` tokens; reference `AEOVisibilityTab.jsx`.

### Pitfall 7: Data-integrity on ranks/cities
**What goes wrong:** Caching competitor ranks or city lists without `fetched_at`/source. **Avoid:** `createVerifiedData` wrap; Census for cities; live DataForSEO/Places for ranks; flag AI-inferred services.

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Phase 10 v4 shim (paired site) | WS1 webhook.set, WS6 elementor.save | ✓ (code-complete) | pilot pair operator-gated but path exists |
| `CENSUS_API_KEY` (Vercel env) | WS4 cities, WS5 geo | ✓ (geoLookup requires it; Census 302s without) | confirm set in Vercel |
| `CRON_SECRET` | WS1 internal fire-and-forget auth | ✓ (run_all_audits uses it) | confirm set |
| `KOTOIQ_SHIM_DASHBOARD_PRIVKEY` | WS1 shimRpc/webhookSet/pairSite | ✓ (Phase 10) | confirm set |
| `NEXT_PUBLIC_GOOGLE_PLACES_KEY` | WS5 grid-scan competitor local rank | ✓ (grid-scan uses it) | confirm set |
| DataForSEO creds | WS5 local volume + KD + SERP rank | ✓ (pageGapEngine `getKeywordCPCs`, dfs_compare) | confirm creds live |
| `ANTHROPIC_API_KEY` | WS3 service inference, WS5 strategist | ✓ | logTokenUsage mandatory |

**No missing dependencies with no fallback.** All external deps are already wired by prior phases.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`"test": "vitest run"` in package.json) |
| Config | `vitest.config.*` present (per inventory; `resolve.conditions` includes `react-server` per STATE.md Phase 7) |
| Quick run | `npx vitest run <file>` |
| Full suite | `npm run test` (`vitest run`) |

Existing kotoiq tests live under `tests/kotoiq/` and `src/lib/wp-shim/*.test.ts` (e.g. `shimRpc.test.ts`, `verbList.test.ts`, `pairSite.test.ts`).

### Phase Requirements → Test Map (illustrative; refine in plan)
| WS | Behavior | Test Type | Command | Exists? |
|----|----------|-----------|---------|---------|
| WS2 | baseline insert is immutable + correct shape | unit | `npx vitest run src/lib/kotoiq/baselineSnapshot.test.ts` | ❌ Wave 0 |
| WS3 | service inference returns clean list from sample pages | unit | `npx vitest run src/lib/kotoiq/serviceInference.test.ts` | ❌ Wave 0 |
| WS5 | `scoreServiceCityGrid` formula + bucketing on fixture signals | unit | `npx vitest run src/lib/builder/scoreServiceCityGrid.test.ts` | ❌ Wave 0 |
| WS5 | quick-win/net-new/big-bet classification edges | unit | (same file) | ❌ Wave 0 |
| WS6 | sibling/cross link computation pure helper | unit | `npx vitest run src/lib/wp-shim/computeInternalLinks.test.ts` | ❌ Wave 0 |
| WS1 | webhook.set called with allowed events only | unit | mock `webhookSet`; assert events `save_post`/`publish_post` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`.
- **Per wave merge:** `npm run test` (full suite) + `npx tsc --noEmit` (typecheck — repo ships clean per session-log).
- **Phase gate:** full suite green + manual browser verify (dashboard behind Supabase auth; run `next dev --no-turbo` per STATE.md Turbopack/React19 Sidebar bug).

### Wave 0 Gaps
- [ ] `src/lib/builder/scoreServiceCityGrid.test.ts` — formula + buckets (WS5)
- [ ] `src/lib/kotoiq/baselineSnapshot.test.ts` — immutable insert shape (WS2)
- [ ] `src/lib/kotoiq/serviceInference.test.ts` — inference from fixture pages (WS3)
- [ ] `src/lib/wp-shim/computeInternalLinks.test.ts` — extracted link helper (WS6)
- [ ] Pure-function-first design: keep scoring/inference/link-computation as pure fns (no IO) so they're unit-testable without DB/network (mirrors `hubBuilder` and `pageContentExtractor.extractFromHtml`).

---

## Security Domain

`security_enforcement` not explicitly set in config — treat as enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `/api/kotoiq` AUTH gate (verifySession + CRON_SECRET internal path); new inbound webhook receiver MUST authenticate the shim's POST (don't trust an open endpoint) |
| V4 Access Control | yes | Agency isolation — every new table RLS via `agency_members`; never operate cross-agency (AUTH gate @455-463 enforces client ownership) |
| V5 Input Validation | yes | Validate webhook payloads, city/service inputs; `webhookSet` already validates event allowlist + https url |
| V6 Cryptography | yes (reuse) | Ed25519 signing in `shimRpc`/`pairSite` — do NOT hand-roll; reuse |
| V9 Communications | yes | Shim RPC over https; webhook url must be https (enforced) |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Open inbound webhook receiver spoofed | Spoofing | Authenticate the shim emitter's POST (shared secret / signature from Plan 10-05 emitter — confirm shape, don't modify plugin) |
| Cross-agency data leak via new tables | Info disclosure | RLS + `getKotoIQDb` agency scoping + AUTH gate ownership check |
| SSRF via service inference fetching arbitrary client URLs | Tampering | `fetchAndExtract` targets the client's own paired domain; constrain to `clients.website`/sitemap origin (Phase 8 SSRF guard precedent exists) |
| Replay of pair/RPC | Tampering | already mitigated (nonce + iat/exp in shimRpc) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The orchestration chain should fire at `/api/wp connect` (not `seo/wp-register` as CONTEXT locks) because that's where `pairSite` actually completes | WS1 / Summary | If wrong, chain fires on plugin settings-saves or never gets v4/client context. **Needs user confirmation** — contradicts a locked CONTEXT decision. |
| A2 | A new `kotoiq_site_baseline` table is required (existing snapshot tables are competitor-only) | WS2 | Low — verified existing tables are competitor-scoped |
| A3 | Storing inferred services in `kotoiq_client_profile.fields` with provenance is the most consistent existing pattern | WS3 | Medium — alternative is a column on the baseline table; either works (CONTEXT discretion) |
| A4 | `scoreServiceCityGrid` is a NEW wrapper over `analyzePageGaps`, not an in-place rewrite | WS5 | Low — confirmed signals already computed; keeps `PageSuggestionsTab` back-compat |
| A5 | Authoritative competitor rank source is DataForSEO SERP `rank_group` + Google Places grid (not the coarse snapshot count) | WS5 | Medium — affects competition_strength accuracy; both sources verified present |
| A6 | The inbound webhook receiver route does not exist and must be created | WS1 | Low — verified zero handlers for save_post/publish_post |
| A7 | The shim webhook emitter's auth shape must be read from Plan 10-05 (reference-only) to authenticate the receiver | WS1 / Security | Medium — must confirm emitter posts a verifiable signature/secret before building the receiver |

---

## Open Questions

1. **Honor CONTEXT's `wp-register` trigger or correct to `/api/wp connect`?**
   - Known: `wp-register` doesn't run `pairSite`; `/api/wp connect` does (line 556).
   - Recommendation: wire at `/api/wp connect`; raise A1 with the user before locking the plan.
2. **Webhook receiver authentication shape.**
   - Known: shim has a webhook emitter (Plan 10-05) but its POST auth shape (signature vs shared secret) wasn't read this session.
   - Recommendation: read `wp-plugin-kotoiq-shim` webhook emitter (reference-only) during planning to define the receiver's verification.
3. **Gap-score persistence: new table vs extend `kotoiq_page_suggestions`?**
   - Recommendation: extend `kotoiq_page_suggestions` with `score/bucket/our_coverage/competition_strength` (the UI already reads this table); CONTEXT leaves it to discretion.
4. **Page Factory publish path vs topic-campaign deploy path for WS6.**
   - Known: linking lives in `deployCampaign`; Page Factory uses `/api/builder/generate`.
   - Recommendation: extract a shared `computeInternalLinks` helper; confirm whether Page Factory should route through `deployCampaign` entirely.

---

## Sources

### Primary (HIGH confidence — read this session)
- `src/app/api/wp/route.ts` (connect/pairSite @500-573) — WS1 pairing point
- `src/app/api/seo/wp-register/route.ts` (full) — confirmed NOT the pair handshake
- `src/app/api/kotoiq/route.ts` (AUTH @427-467, run_all_audits @5635-5846, analyze_competitors @1398, dfs_compare @5256) — orchestration + competitor sources
- `src/lib/builder/pageGapEngine.ts` (full) — WS5 core
- `src/lib/kotoiq/localStrategistEngine.ts` (full) — strategy + link plan
- `src/lib/kotoiq/pageDiscovery.ts` + `pageContentExtractor.ts` (full) — WS2 reuse
- `src/lib/wp-shim/{shimRpc,verbList,hubBuilder,pairSite}.ts` + `verbs/index.ts` (webhookSet @570) — WS1/WS6
- `src/app/api/kotoiq/topic-campaign/route.ts` (deployCampaign @1698-1787, deploy_hub) — WS6 link injection
- `src/components/kotoiq/{PageSuggestionsTab,TopicCampaignPanel}.jsx` — WS3/WS4 current + reusable picker
- `src/views/kotoiq/KotoIQShellPage.jsx` — WS7 shell state
- `supabase/migrations/{20260608_page_factory,20260609_kotoiq_page_diff}.sql` — table shapes + RLS pattern
- `src/lib/geoLookup.ts` + `_knowledge/data-integrity-standard.md` + `DESIGN.md` — cross-cutting
- `KOTOIQ_INVENTORY.md`, `.planning/{ROADMAP,STATE}.md`, `11-CONTEXT.md`, `.planning/config.json`

### Secondary
- None required — all claims verified in-repo.

---

## Recommended Plan Split

**6 plans** (WS6 folds into the gap/deploy plan since linking already exists):

1. **11-01 — Orchestration spine + webhook receiver** (WS1)
   - New fire-and-forget block at `/api/wp connect` after pair success → `run_all_audits` + WS2 snapshot + `webhookSet(save_post/publish_post)`.
   - New inbound receiver route (`/api/wp/inbound` or `/api/kotoiq/wp-event`), authenticated.
   - Resolve A1 (trigger location) first.

2. **11-02 — Baseline snapshot** (WS2)
   - Migration `kotoiq_site_baseline` (manual-apply). Pure snapshot engine over `discoverPages` + `fetchAndExtract`. Insert-only. Unit tests.

3. **11-03 — Service inference + editable chips** (WS3)
   - Haiku (or heuristic) inference over baseline pages → `kotoiq_client_profile.fields` (provenance, AI-flagged). Chip UI (FlagChip + AI badge) replacing the manual box. Optional target phrases from `kotoiq_keywords`.

4. **11-04 — City picker (shared component)** (WS4)
   - Extract `TopicCampaignPanel` picker → `CityPicker`. Extend `analyzePageGaps` to accept explicit `cities[]`. Wire into the gap flow. (Independent — can land early/parallel.)

5. **11-05 — Gap scoring + bucketed report + auto-linking** (WS5 + WS6)
   - New `scoreServiceCityGrid()` wrapper (formula + quick-win/net-new/big-bet buckets, DataForSEO/Places ranks, coverage degree). Extend `kotoiq_page_suggestions` (score/bucket/coverage/strength). Extract `computeInternalLinks` helper from `deployCampaign`; apply on Page Factory build. Approval gate retained. Unit tests.

6. **11-06 — Guided 6-step UI shell** (WS7)
   - New `?shell=guided` mode + WorkflowStepper rail assembling steps 1-6 from the above. DESIGN.md primitives + tokens. Status from `run_all_status` polling. FleetView/power tabs untouched.

**Dependency order:** 11-01 → 11-02 → 11-03 ; 11-04 (parallel) ; (11-03 + 11-04) → 11-05 → 11-06.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all files read.
- Architecture / insertion points: HIGH — verified at file:line; one CONTEXT correction (A1) flagged for confirmation.
- WS5 scoring: HIGH on inputs (all signals exist), MEDIUM on exact formula normalization (discretion).
- WS6 linking: HIGH — machinery confirmed in `deployCampaign`.
- Pitfalls: HIGH — derived from read code, not assumption.

**Research date:** 2026-06-08
**Valid until:** ~2026-07-08 (stable repo; re-verify `/api/wp connect` and `deployCampaign` line numbers if the monoliths change).
