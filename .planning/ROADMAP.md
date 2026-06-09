# Roadmap: Koto — KotoIQ M1

## Overview

KotoIQ M1 is the adapter + closed-loop layer that bridges ~7,700 lines of already-shipped semantic/content engines into native Elementor v4 publishing with per-page revenue attribution. Eight phases total — the first six (code complete) take the project from foundation work through closed-loop attribution to a unified KotoIQ shell; Phases 7 and 8 (appended after code completion) add a Stage 0 Client Profile Seeder that turns Koto's existing onboarding, discovery, and voice interview data into a structured entity graph seed before any keyword sync runs. Final gate is `PILOT-01`: 20 live hyperlocal pages on momentamktg.com with per-page KPI rollup, attribution, CWV readings, and IndexNow confirmations.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundations + Elementor Read Path** — Agency-isolated schema, live v4 JSON capture, read-only adapter
- [x] **Phase 2: Elementor Write Path + Template Ingest + Slot Editor** — Document::save() round-trip, master template ingest, slot editor
- [x] **Phase 3: Engine to Publish Adapter + Pre-Flight Gate** — Brief-to-Elementor serializer, Claude slot filler, construction-time anti-scaled-content gate
- [x] **Phase 4: Durable Publish Orchestration** — Vercel Workflow campaign runs, cadence, idempotency, publish queue
- [x] **Phase 5: Closed-Loop Attribution (CWV + IndexNow + Telnyx)** — CrUX + RUM, per-page numbers, IndexNow, GSC ping, per-page KPI rollup
- [x] **Phase 6: Feedback Loop + Unified Shell + Pilot** — Weekly rescan, decay-refresh, KotoIQ shell, 20-page live pilot
- [x] **Phase 7: Client Profile Seeder v1 — Internal Ingest + Gap Finder** — Paste Koto link or raw text → populate profile → surgical follow-up questions → seed entity graph as Stage 0 (prerequisite for quality pilot) — code-complete, 401 blocker fixed 2026-04-21, awaiting human UAT
- [x] **Phase 8: Client Profile Seeder v2 — External Source Parsers** — API-complete (Typeform/Jotform/Google Forms + website crawl + GBP OAuth/Places + PDF/DOCX/image uploads + encrypted per-agency vault). UI v1 scope-cut to next milestone — see `.planning/phases/08-client-profile-seeder-v2-external-source-parsers/08-VERIFICATION.md`. Migration applied, env vars live, Playwright-on-Fluid-Compute verified 2026-04-21.

**M1 remaining:** PILOT-01 (20 live hyperlocal pages on momentamktg.com) + human UAT gauntlet on Phase 7 ingest. Dev server blocker: use `next dev --no-turbo` until the React 19 / Turbopack fiber reconciliation bug on Sidebar conditional JSX is patched upstream or the Sidebar is refactored.

## Phase Details

### Phase 1: Foundations + Elementor Read Path
**Goal**: Agency-isolated data model, Elementor v4 schema captured from live JSON, read-only plugin endpoints proving the adapter can round-trip JSON from momentamktg.com before any write risk is introduced.
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, ELEM-01, ELEM-02, ELEM-03, ELEM-05, ELEM-06
**Success Criteria** (what must be TRUE):
  1. Every new `kotoiq_*` table rejects any query that does not carry `.eq('agency_id', ...)` — verified by ESLint rule and cross-tenant integration test
  2. Operator can call `builder/detect` on momentamktg.com and see `{ elementor_version: '4.0.2', pro_version, atomic_enabled: true, theme_name, php_version }`
  3. Operator can list every Elementor-edited page on momentamktg.com via `builder/pages` and fetch the raw `_elementor_data` for any one of them
  4. System captures live atomic-widget JSON from momentamktg.com and persists a pinned Zod schema in `kotoiq_elementor_schema_versions` — re-ingesting the same page detects zero drift
  5. A second ingest of a manually-edited page flags additive vs breaking schema changes before any downstream publish is attempted
**Plans**: 5 total
  - Plan 1: Migration + Agency Helper (FND-01, FND-02, FND-03) ✅ COMPLETE
  - Plan 2: ESLint Rule + Isolation Audit (FND-04, FND-05) ✅ COMPLETE
  - Plan 3: WP Plugin Builder Read Endpoints (ELEM-01, ELEM-02, ELEM-03) ✅ COMPLETE
  - Plan 4: Schema Capture + Registry (ELEM-05) ✅ COMPLETE
  - Plan 5: Schema Drift Detection + Phase Gate (ELEM-06) ✅ COMPLETE
**UI hint**: yes

### Phase 2: Elementor Write Path + Template Ingest + Slot Editor
**Goal**: Prove one Elementor page can be cloned, written back via the canonical `Document::save()` PHP adapter, and rendered pixel-identical to the master — then land the slot detector and operator-facing slot editor so templates are publish-ready. Hard gate: single-page round-trip must render pixel-identical before any serializer or generator work proceeds.
**Depends on**: Phase 1
**Requirements**: ELEM-04, ELEM-07, ELEM-08, ELEM-09, ELEM-10, UI-04
**Success Criteria** (what must be TRUE):
  1. Operator can ingest one Elementor v4 page from momentamktg.com as a master template via the Template Ingest UI — `kotoiq_templates.elementor_data` stored, original WP page unmodified
  2. System auto-detects fillable slots (headings, paragraphs, button text + URL, image URL + alt, link URL, repeater rows) using stable `element-id:settings.property` paths, visible in the Slot Editor
  3. Operator can rename, add, remove, and constrain slots in the Slot Editor UI before any campaign runs
  4. Operator can publish a cloned draft back to WordPress via `Document::save()` and the rendered page is visually pixel-identical to the master in both Elementor editor and front-end view
  5. Elementor CSS regenerates automatically after every successful write, wrapped in `class_exists` / `method_exists` guards — no stale CSS on any round-trip
**Plans**: 4 total
  - Plan 1: WP Plugin Write Endpoint — Document::save() (ELEM-04, ELEM-10) ✅ COMPLETE
  - Plan 2: Template Ingest API + Slot Detection (ELEM-07, ELEM-08) ✅ COMPLETE
  - Plan 3: Write Proxy + Clone Action ✅ COMPLETE
  - Plan 4: Template Ingest + Slot Editor UI (ELEM-09, UI-04) ✅ COMPLETE
**UI hint**: yes

### Phase 3: Engine to Publish Adapter + Pre-Flight Gate
**Goal**: Bridge shipped semantic/hyperlocal engine output into valid Elementor v4 atomic-widget JSON, fill slots via Claude structured outputs, materialize N variants per master template, and block any publish that fails the construction-time anti-scaled-content gate. Hard gate: pre-flight refuses rather than warns — no campaign reaches live publish with unpopulated, duplicate, or non-unique variants.
**Depends on**: Phase 2
**Requirements**: ADAPT-01, ADAPT-02, ADAPT-03, ADAPT-04, ADAPT-05, ADAPT-06
**Success Criteria** (what must be TRUE):
  1. System takes a `hyperlocalContentEngine` brief and emits Elementor v4 atomic-widget JSON that validates against the pinned schema for the target site
  2. Claude fills slots via `output_config.format: json_schema` (strict: true) — one structured call per `slot_kind` — and every call logs to `koto_token_usage` with `feature='builder_slot_fill'`
  3. Operator can generate N variant pages from one master template + seed dataset — each variant persisted in `kotoiq_variants.rendered_elementor_data`
  4. Pre-flight gate blocks publish unless (a) every required slot populated with non-empty unique-per-variant value, (b) at least one unique local data field present, (c) rendered JSON validates against pinned schema, (d) no two variants share identical body hash — the function refuses rather than warns
  5. Operator can preview one rendered variant as a WP draft with screenshot + JSON diff against the master before any bulk publish
**Plans**: TBD
**UI hint**: yes

### Phase 4: Durable Publish Orchestration
**Goal**: Wrap the per-variant round-trip in a Vercel Workflow DevKit `publishCampaign` with durable sleep, deterministic replay, idempotency keys, cadence controls, and live operator visibility — so a deploy mid-campaign does not lose variants and retries never create duplicate WP posts.
**Depends on**: Phase 3
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05
**Success Criteria** (what must be TRUE):
  1. A campaign run executes per-variant `generate` → `publish` → `indexnow` → `step.sleep(24h)` → `cwvFirstRead` as durable Workflow steps — a deploy mid-run loses zero variants
  2. Operator can configure cadence (`per_day_cap`, `start_at`, `timezone`) per campaign; default drip is ~10/day for established domains
  3. Retry storms keyed on `(campaign_id, variant_id, step_name)` never create duplicate WP posts — verified by an integration test that deliberately crashes mid-step
  4. Operator can view per-variant status (pending / publishing / live / failed) in the Publish Queue dashboard and retry any failed variant in one click
  5. Operator can kick, stop, and inspect Workflow runs via `/api/wp/builder/publish` using the existing `{ action, agency_id, client_id, site_id, ... }` dispatch pattern
**Plans**: TBD
**UI hint**: yes

### Phase 5: Closed-Loop Attribution (CWV + IndexNow + Telnyx)
**Goal**: Stand up per-page measurement — CrUX API + `web-vitals` RUM beacon for CWV, IndexNow + GSC sitemap ping for indexing, per-page Telnyx numbers for call attribution — and roll every signal into a single per-page KPI view so the question "which published page made us money?" answers in one query.
**Depends on**: Phase 4 (parallel sub-tracks inside this phase: CWV, IndexNow/GSC, Telnyx attribution, KPI rollup)
**Requirements**: ATTR-01, ATTR-02, ATTR-03, ATTR-04, ATTR-05, ATTR-06, ATTR-07, ATTR-08
**Success Criteria** (what must be TRUE):
  1. Every published URL has CrUX field-data readings (28-day window, origin-level fallback for low-traffic URLs) and a `web-vitals` RUM beacon on the page posting LCP/INP/CLS/FCP/TTFB to `/api/kotoiq/vitals`
  2. Every published variant has a unique Telnyx number injected into its `{{phone}}` slot at publish; inbound calls to that number insert `kotoiq_call_attribution { match_method='dynamic_number', confidence=1.0 }` automatically
  3. Every published URL is submitted to IndexNow (Bing/Yandex/Naver/Seznam) and pinged via GSC sitemap on publish; Google Indexing API is never called for Service/LocalBusiness pages
  4. Operator can run a single per-page KPI rollup query and get one row per page joining rank, clicks, CWV, call count, and estimated revenue
  5. Operator can open a per-page detail view showing KPIs, attribution trail, refresh history, and working "stop" + "unpublish" controls
**Plans**: TBD
**UI hint**: yes

### Phase 6: Feedback Loop + Unified Shell + Pilot
**Goal**: Close the loop — weekly cron walks published pages through the already-shipped `contentRefreshEngine.ts`, decay-flagged pages queue a variant regeneration the operator approves before re-publish, and the unified KotoIQ shell consolidates `/wordpress` + `/seo` + existing 35 KotoIQ tabs into one command center. Pilot gate: 20 real hyperlocal landing pages live on momentamktg.com, each natively Elementor, IndexNow-submitted, GSC-pinged, per-page Telnyx-attributed, returning CWV field data.
**Depends on**: Phase 5
**Requirements**: LOOP-01, LOOP-02, LOOP-03, UI-01, UI-02, UI-03, PILOT-01
**Success Criteria** (what must be TRUE):
  1. Weekly Vercel Cron walks `kotoiq_publishes` for each site, pulls current rank + CWV + clicks, and feeds each URL into `contentRefreshEngine.ts` — decay recommendations appear per-page in the KotoIQ dashboard
  2. When decay is recommended, the operator approves a refresh from the per-page detail view and the same adapter re-publishes the regenerated variant; refresh history timeline shows every version with slot-fill diffs
  3. Operator accesses a unified KotoIQ shell at one route with **Intel · Publish · Tune · Settings** tabs — existing 35 KotoIQ tabs mount unchanged under Intel; legacy `/wordpress` and `/seo` bookmarks redirect into the new shell without breaking
  4. Operator can compose a campaign end-to-end in the Campaign Composer (template + seed dataset + preview + cadence) and launch it against momentamktg.com
  5. 20 real hyperlocal landing pages are live on momentamktg.com — each generated from `hyperlocalContentEngine` output, published as native Elementor v4, IndexNow-confirmed, GSC-pinged, per-page Telnyx-attributed, with CWV field data returning
**Plans**: TBD
**UI hint**: yes

### Phase 7: Client Profile Seeder v1 — Internal Ingest + Gap Finder
**Goal**: Add a Stage 0 to the pipeline that turns Koto's existing onboarding, discovery, and voice interview data into a structured `kotoiq_client_profile` entity graph seed — before any keyword sync runs. Operator pastes an internal link or raw text; the system auto-populates fields with provenance, then emits 3-8 surgical follow-up questions for whatever's missing or low-confidence. Prerequisite for `PILOT-01` delivering real quality.
**Depends on**: Phase 6
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06
**Success Criteria** (what must be TRUE):
  1. Operator pastes a `/onboard/:clientId` or `/onboarding-dashboard/:clientId` URL → profile populates in under 10 seconds with 20+ fields resolved from the existing Koto data
  2. Operator pastes raw text (voice transcript, email, notes, pasted website copy) → Claude extracts structured fields against the canonical schema with per-field char-offset citation
  3. Gap-finder returns ≤ 8 surgical follow-up questions for a mostly-complete onboarding, ≤ 15 for a partial one — not the canonical 26 blind
  4. Every field in `kotoiq_client_profile` carries `source_type` + `source_url` + `captured_at` + confidence score (VerifiedDataSource compliant)
  5. `pipelineOrchestrator.ts` Stage 0 runs the profile seeder before Stage 1 keyword sync; entity graph is pre-seeded with client identity, services, USPs, target customers, mentioned competitors
**Plans**: 8 total
  - [x] 07-01-PLAN.md — Data layer: migration + kotoiqDb helpers + types + Vitest bootstrap + DST token (PROF-03, PROF-04)
  - [x] 07-02-PLAN.md — Internal source pullers + profileConfig single source of truth (PROF-01, PROF-04)
  - [x] 07-03-PLAN.md — Claude extractors (Sonnet tool-use, Haiku voice/discovery) + discrepancy detector + narration helper (PROF-02, PROF-04)
  - [x] 07-04-PLAN.md — Seeder composition + launch gate + graph serializer + Stage 0 wire-in + durable pipeline_runs writes + stream_seed SSE endpoint (PROF-01, PROF-02, PROF-04, PROF-06)
  - [x] 07-05-PLAN.md — Clarification generator + severity/channel classifiers + SMS/email/portal forwarders (PROF-04, PROF-05)
  - [x] 07-06-PLAN.md — /api/kotoiq/profile 14-action JSON dispatcher (PROF-01..PROF-06)
  - [x] 07-07-PLAN.md — Launch Page UI: ingest, briefing, halos, gate, ribbon, drop zone, auto-save, reject modal (PROF-01, PROF-02, PROF-05)
  - [x] 07-08-PLAN.md — Clarifications UI: hotspots + chat widget extension + Needs Clarity dashboard sub-tab + operator-authored questions (PROF-04, PROF-05)
**UI hint**: yes

### Phase 8: Client Profile Seeder v2 — External Source Parsers
**Goal**: Extend the Stage 0 profile seeder to ingest anything the client has already produced — external onboarding forms, their existing website, their Google Business Profile, uploaded proposals / brochures / sales decks / business cards. Turns onboarding from "fill out 26 fields" into "drop whatever you have, we'll figure it out."
**Depends on**: Phase 7
**Requirements**: PROF-07, PROF-08, PROF-09, PROF-10, PROF-11
**Success Criteria** (what must be TRUE):
  1. Operator pastes a Typeform / Jotform / Google Forms public share link → profile populates with Q&A pairs mapped to canonical fields, low-confidence extractions flagged for review
  2. Operator pastes a client's existing website URL → Playwright crawls About/Services/Contact/Locations/Team → profile + Stage 2 entity graph seeded with extracted entities + per-page citations
  3. Operator connects a client's Google Business Profile via GMB API → LocalBusiness fields, service categories, hours, service area, review themes merged into profile
  4. Operator uploads a PDF, DOCX, or image (proposal, brochure, sales deck, business card) → OCR where needed → Claude extracts structured fields with per-chunk citation
  5. All external-source ingests are visible in `kotoiq_client_profile.sources` with `source_type`, `source_url` (or upload hash), confidence per field, and `captured_at` — fully auditable from the per-client profile view
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

Phases 7 and 8 were appended after Phases 1-6 code-completed — they are prerequisites for `PILOT-01` delivering real quality, not retroactive inserts. Phase 7 must land before the pilot fires.

**Separate initiatives (non-KotoIQ):** Koto Trainer — `/trainer` personal-trainer module, parked behind KotoIQ M1 close. Tracked under `.planning/phases/trainer-NN-*/` namespace (NOT numeric continuation of 1-8). Phase 1 sketch in `.planning/phases/trainer-01-intake-and-dispatcher/`.

**Parallelization:** Phase-level execution is strictly sequential (each phase gates the next). Within Phase 5, four sub-tracks (CWV, IndexNow/GSC, Telnyx attribution, KPI rollup) can parallelize safely because they touch independent surfaces. Within Phase 1, ELEM-05 schema capture and FND-01..05 isolation work can parallelize once the migration lands. Within Phase 6, LOOP and UI tracks can parallelize until the pilot gate where both must be ready.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations + Elementor Read Path | 5/5 | Code complete (gate pending) | - |
| 2. Elementor Write Path + Template Ingest + Slot Editor | 4/4 | Code complete (gate pending) | - |
| 3. Engine to Publish Adapter + Pre-Flight Gate | 3/3 | Code complete | - |
| 4. Durable Publish Orchestration | 4/4 | Code complete | - |
| 5. Closed-Loop Attribution (CWV + IndexNow + Telnyx) | 6/6 | Code complete | - |
| 6. Feedback Loop + Unified Shell + Pilot | 7/7 | Code complete (pilot pending) | - |
| 7. Client Profile Seeder v1 — Internal Ingest + Gap Finder | 0/6 | Not started | - |
| 8. Client Profile Seeder v2 — External Source Parsers | 0/5 | Not started | - |
| 10. KotoIQ WP plugin thin-shim pivot | 12/12 | Complete   | 2026-05-27 |

### Phase 9: Consolidate WordPress site management — unified /kotoiq-wp view replacing wpsimplecode + kotoiq-sites + control-center

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 9 to break down)

### Phase 10: KotoIQ WP plugin thin-shim pivot ✅ COMPLETE

**Goal:** Move all business logic out of the WordPress plugin into the Koto dashboard. The plugin becomes a generic authenticated RPC shim (~870 LOC, ~430 of business logic) exposing 27 noun.verb primitives (post/meta/option/query/file/cron/plugin/elementor). All SEO scoring, sitemap composition, redirect rules, content generation, page-factory orchestration, snippets runtime, access policy mapping live dashboard-side. A hostile client with WP filesystem access reads the entire `wp-plugin-kotoiq-shim/` source and cannot reconstruct KotoIQ's value. Side-by-side install with 60-day v3 cutover window per CONTEXT.md USER-LOCKED decisions.

**Status:** Code-complete 2026-05-27. Calendar-gated sunset (Plan 12 Task 3) fires on day 60 post-pilot-promotion per `SUNSET-PLAYBOOK.md`.

**Requirements**: SHIM-FOUNDATION, SHIM-PLUGIN-SKELETON, SHIM-DASHBOARD-CLIENT, SHIM-CORE-VERBS, SHIM-HARDENED-VERBS, SHIM-ELEMENTOR-AND-ROTATION, SHIM-DASHBOARD-PORTS-A, SHIM-SITEMAP-COMPOSER, SHIM-TEMPLATE-CAPTURE-AND-PUSH, SHIM-DUAL-RUN-SHADOW, SHIM-CUTOVER, SHIM-V3-SUNSET
**Depends on:** Phase 9
**Plans:** 12/12 plans complete

- [x] **Phase 10: KotoIQ WP plugin thin-shim pivot** — 12/12 plans complete (2026-05-27). Dashboard now owns all WP business logic. v4 thin-shim exposes 27 generic RPC verbs; SUNSET-PLAYBOOK.md captures the day-60 v3 deactivation runbook.

Plans:
- [x] 10-01-PLAN.md — Foundation: Vercel envs + Supabase migration (templates, push_history, dual_run_log, shim_pairings) + Wave-0 test scaffolds + verb whitelist
- [x] 10-02-PLAN.md — Plugin skeleton: `wp-plugin-kotoiq-shim/` (separate from v3) with Ed25519 auth + pairing + self-update + RPC dispatcher
- [x] 10-03-PLAN.md — Dashboard signing client: shimRpc + wpFetch + pairSite + credentialsVault (App Password encryption)
- [x] 10-04-PLAN.md — Core generic verbs (20): health, post, meta, option (deny-list), file (path-confined), cron, plugin, taxonomy, events
- [x] 10-05-PLAN.md — Hardened verbs (5) + snippets runtime + webhook emitter: query.select (whitelist), capability.apply, transient.delete_prefix, database.update_bulk, webhook.set
- [x] 10-06-PLAN.md — Elementor verbs (2) + koto_rotate shortcode: elementor.save + elementor.clone (with dashboard-supplied meta_prefix_allowlist — no hardcoded SEO-plugin names); generic variant-rotation shortcode
- [x] 10-07-PLAN.md — Dashboard ports A: seoPort + redirectsPort + snippetsPort + accessPort (FEATURE_CAP_MAP) + searchReplacePort (TS serialized-PHP-safe walk)
- [x] 10-08-PLAN.md — Dashboard sitemap composer + push via file.write + Vercel Cron daily refresh + generic PHP sitemap-server (with WP-core fallback)
- [x] 10-09-PLAN.md — Template capture + push (CONTEXT.md Option B locked): variableExtractor + captureTemplate + pushTemplate + content-rotation wrapping + Templates UI tab in KotoIQ WP view
- [x] 10-10-PLAN.md — Dual-run shadow mode (CONTEXT.md D-TypeScript-port-equivalence locked): dualRunRouter (mode inactive/active/promoted/rolled_back) + diffEngine + operator UI panel
- [x] 10-11-PLAN.md — Cutover ops: build-shim-zip + pair-site + promote-site + kill-switch + parity-gauntlet CLI scripts + WP admin pairing page + CUTOVER-PLAYBOOK.md + pilot pair (human checkpoint)
- [x] 10-12-PLAN.md — v3 sunset: sunset-v3.cjs (calendar-gated, 3 guardrails) + cleanup-legacy-options.cjs + /api/wp pruned to 6-name allowlist (410 Gone for others) + /api/kotoiq-manifest + /api/wpsc-manifest deprecated with successor pointer + SUNSET-PLAYBOOK.md runbook

#### Deferred to M2 (Phase 10 carry-forward)

The following items were intentionally NOT delivered in Phase 10. Final reference list for the next milestone planner:

- **Per-site Ed25519 keypair rotation** — per CONTEXT.md D-Keypair-scope (USER-LOCKED): single global keypair for v1, per-site keys introduced when fleet > ~100 sites or a key-rotation incident demands it
- **searchReplace TypeScript-port performance benchmarking** — Plan 10-07 confirmed PHP↔TS equivalence; no fleet-wide performance baseline established yet
- **WP-multisite support** — per CONTEXT.md §deferred: single-site WP installs only in v1; multisite has different REST routing
- **Visual page builder UI in Koto** (Option A from 10-CONTEXT.md) — canvas + drag-drop + widget library; deferred to a later phase
- **Section library in Koto** (Option C from 10-CONTEXT.md) — assemble pages by picking pre-captured sections
- **WP-core full headless replacement** — Phase 10 keeps Elementor as the renderer on the WP side; a future phase could evaluate pure HTML/Tailwind via Gutenberg block + bypass Elementor entirely
- **Real-time collaborative template editing** — single-user edits only in v1
- **WP.org plugin distribution** — per CONTEXT.md D-Plugin-distribution (USER-LOCKED): NEVER. Do NOT undo this in M2 — keeping the shim off the public directory is a competitive-protection win

### Phase 11: KotoIQ WP guided onboarding and competitor-driven gap engine

**Goal:** Turn `/kotoiq-wp` into a guided, self-explanatory flow that, on first install, scans the site, lets the user confirm services + pick target cities, finds content gaps proven by competitor rank data, ranks the build order, and auto-links what gets built. Wiring + one scoring function + UX assembly over existing engines — not a rebuild.
**Requirements**: ONBOARD-01, ONBOARD-02, ONBOARD-03, ONBOARD-04, ONBOARD-05, ONBOARD-06, ONBOARD-07, ONBOARD-08
**Depends on:** Phase 10 (thin-shim cutover — orchestration lives dashboard-side on the v4 shim)
**Plans:** 6 plans

**Requirement map:**
- ONBOARD-01 — Orchestration spine fires run_all_audits + baseline + webhook registration on pair success (fire-and-forget, non-blocking)
- ONBOARD-02 — Authenticated inbound receiver for save_post/publish_post keeps inventory live
- ONBOARD-03 — Day-1 immutable baseline snapshot of the client's own pages
- ONBOARD-04 — Service auto-extraction from scanned pages → editable AI-flagged chips + optional target phrases
- ONBOARD-05 — Shared Census city multi-select scoping competitor discovery (analyzePageGaps cities[])
- ONBOARD-06 — Competitor-driven gap scoring (scoreServiceCityGrid) with quick-win/net-new/big-bet buckets
- ONBOARD-07 — Auto internal-linking of built pages via extracted computeInternalLinks helper (approval gate retained)
- ONBOARD-08 — Guided 6-step UI shell on DESIGN.md primitives

Scope (7 workstreams):
1. **Orchestration spine** — trigger is dashboard-side at the real pair-completion point: `/api/wp` `shim_pair_new_site` after `pairSite()` succeeds (NOT `wp-register`, per 11-RESEARCH A1). Auto-kicks scan + `run_all_audits`; registers `save_post`/`publish_post` webhooks (`webhook.set`) → new authenticated receiver. No plugin change.
2. **Baseline snapshot** — new immutable `kotoiq_site_baseline` table; day-1 inventory of the client's own pages via reused `pageDiscovery` + `pageContentExtractor`.
3. **Service auto-extraction** — infer services from scanned pages (Haiku/heuristic), editable AI-flagged chips, provenance in `kotoiq_client_profile.fields`.
4. **City multi-select picker** — extract the existing `TopicCampaignPanel` Census picker into shared `CityPicker`; extend `analyzePageGaps` with explicit `cities[]`.
5. **Competitor-driven gap scoring** — new `scoreServiceCityGrid()` wrapper over `analyzePageGaps` signals; formula + quick-win/net-new/big-bet buckets; ranks/difficulty wrapped with provenance.
6. **Auto internal-linking** — extract `computeInternalLinks` from `deployCampaign`; apply on Page Factory builds; breadcrumbs schema-only; approval gate retained.
7. **Guided UI shell** — `?shell=guided` 6-step spine (Connected → Your site today → Who you're up against → Your gaps → Your plan → Live + cited); each panel plain-English subtitle, one primary action, visible status. DESIGN.md primitives. FleetView/power tabs untouched.

Reuse: `pageDiscovery`, `pageContentExtractor`, `run_all_audits`, `pageGapEngine`, `localStrategistEngine`, `bulkPageBuilder`, `aeoVisibilityEngine`, `hubBuilder`, `TopicCampaignPanel` city picker, `deployCampaign` link injection, `geoLookup`. Data-integrity standard applies (cities via Census, ranks via live APIs, all timestamped). Migrations shipped as files, applied MANUALLY via SQL editor.

**Dependency order:** 11-01 → 11-02 → 11-03 ; 11-04 (parallel) ; (11-03 + 11-04) → 11-05 → 11-06.

Plans:
- [ ] 11-01-PLAN.md — Orchestration spine + authenticated webhook receiver (ONBOARD-01, ONBOARD-02)
- [ ] 11-02-PLAN.md — Day-1 baseline snapshot table + engine (ONBOARD-03)
- [ ] 11-03-PLAN.md — Service inference + editable AI-flagged chips + target phrases (ONBOARD-04)
- [ ] 11-04-PLAN.md — Shared CityPicker + analyzePageGaps cities[] scoping (ONBOARD-05)
- [ ] 11-05-PLAN.md — scoreServiceCityGrid + bucketed report + computeInternalLinks auto-linking (ONBOARD-06, ONBOARD-07)
- [ ] 11-06-PLAN.md — Guided 6-step UI shell (ONBOARD-08)
