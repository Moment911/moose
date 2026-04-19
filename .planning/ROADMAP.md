# Roadmap: Koto — KotoIQ M1

## Overview

KotoIQ M1 is the adapter + closed-loop layer that bridges ~7,700 lines of already-shipped semantic/content engines into native Elementor v4 publishing with per-page revenue attribution. Eight phases total — the first six (code complete) take the project from foundation work through closed-loop attribution to a unified KotoIQ shell; Phases 7 and 8 (appended after code completion) add a Stage 0 Client Profile Seeder that turns Koto's existing onboarding, discovery, and voice interview data into a structured entity graph seed before any keyword sync runs. Final gate is `PILOT-01`: 20 live hyperlocal pages on momentamktg.com with per-page KPI rollup, attribution, CWV readings, and IndexNow confirmations.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundations + Elementor Read Path** — Agency-isolated schema, live v4 JSON capture, read-only adapter
- [ ] **Phase 2: Elementor Write Path + Template Ingest + Slot Editor** — Document::save() round-trip, master template ingest, slot editor
- [ ] **Phase 3: Engine to Publish Adapter + Pre-Flight Gate** — Brief-to-Elementor serializer, Claude slot filler, construction-time anti-scaled-content gate
- [ ] **Phase 4: Durable Publish Orchestration** — Vercel Workflow campaign runs, cadence, idempotency, publish queue
- [ ] **Phase 5: Closed-Loop Attribution (CWV + IndexNow + Telnyx)** — CrUX + RUM, per-page numbers, IndexNow, GSC ping, per-page KPI rollup
- [ ] **Phase 6: Feedback Loop + Unified Shell + Pilot** — Weekly rescan, decay-refresh, KotoIQ shell, 20-page live pilot
- [ ] **Phase 7: Client Profile Seeder v1 — Internal Ingest + Gap Finder** — Paste Koto link or raw text → populate profile → surgical follow-up questions → seed entity graph as Stage 0 (prerequisite for quality pilot)
- [ ] **Phase 8: Client Profile Seeder v2 — External Source Parsers** — External forms, existing websites, GBP API, PDF/DOCX/image uploads → all feed the same profile with provenance

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
  - [ ] 07-06-PLAN.md — /api/kotoiq/profile 14-action JSON dispatcher (PROF-01..PROF-06)
  - [ ] 07-07-PLAN.md — Launch Page UI: ingest, briefing, halos, gate, ribbon, drop zone, auto-save, reject modal (PROF-01, PROF-02, PROF-05)
  - [ ] 07-08-PLAN.md — Clarifications UI: hotspots + chat widget extension + Needs Clarity dashboard sub-tab + operator-authored questions (PROF-04, PROF-05)
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
