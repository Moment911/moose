# Requirements — KotoIQ M1: Elementor Template-Clone Publisher + Closed-Loop Attribution

**Milestone:** v1.0 — KotoIQ M1
**Source documents:** `.planning/PROJECT.md`, `.planning/research/FEATURES.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md`
**Scope rule:** M1 is the **adapter + closed-loop layer** bridging ~7,700 lines of already-shipped semantic/content engines (see PROJECT.md Validated section) into native Elementor v4 publishing with per-page revenue attribution. **No requirement below duplicates a shipped engine.**

---

## v1.0 Requirements

### Foundations (must land first — Phase 1 gate)

- [ ] **FND-01**: System creates Supabase migration `20260XXX_kotoiq_builder.sql` with 10 new tables (`kotoiq_templates`, `kotoiq_template_slots`, `kotoiq_campaigns`, `kotoiq_variants`, `kotoiq_publishes`, `kotoiq_cwv_readings`, `kotoiq_indexnow_submissions`, `kotoiq_call_attribution`, `kotoiq_elementor_schema_versions`, `kotoiq_builder_sites`); every table carries `agency_id` non-null with RLS mirroring existing `koto_wp_sites`
- [ ] **FND-02**: System extends `koto_wp_pages` with `template_id`, `variant_id`, `publish_id` additive columns (no existing columns modified)
- [ ] **FND-03**: Developer gets a `getAgencyScopedSupabaseClient()` helper in `src/lib/supabase.js` that refuses `from()` calls without a downstream `.eq('agency_id', ...)`
- [ ] **FND-04**: ESLint custom rule flags direct `supabase.from('kotoiq_*')` usage without the scoped helper or explicit `.eq('agency_id', ...)`
- [ ] **FND-05**: Agency-isolation audit sweeps every new + touched route, confirms `.eq('agency_id', ...)` on every Supabase query, documents remaining gaps

### Native Elementor v4 Adapter

- [ ] **ELEM-01**: Operator can call `builder/detect` endpoint and receive `{ elementor_version, pro_version, atomic_enabled, theme_name, php_version }` for a connected site
- [ ] **ELEM-02**: Operator can call `builder/pages` endpoint and receive the list of posts on a site that have `_elementor_edit_mode` set
- [ ] **ELEM-03**: Operator can call `builder/elementor/{id}` GET and receive the raw `_elementor_data` JSON + `_elementor_version` + `_elementor_page_settings`
- [ ] **ELEM-04**: System writes Elementor page updates via a WP plugin PHP adapter that invokes Elementor's own `Document::save()` API (NOT direct `update_post_meta('_elementor_data', ...)`) to avoid the v4 atomic-widget CSS/revision bugs in GitHub #32632 / #33000 / #35397
- [ ] **ELEM-05**: System captures live Elementor v4 atomic-widget JSON from momentamktg.com and persists a versioned Zod schema per `{elementor_version, widget_type}` tuple in `kotoiq_elementor_schema_versions` (schema registry, per-site pinned)
- [ ] **ELEM-06**: System detects Elementor schema drift on every subsequent ingest and flags additive vs. breaking changes before running any campaign against the affected site
- [ ] **ELEM-07**: Operator can ingest a single Elementor v4 page as a master template — stored in `kotoiq_templates.elementor_data`; `kotoiq_template_slots` auto-populated; the original WP page is never mutated
- [ ] **ELEM-08**: System auto-detects fillable slots in an ingested template (headings, paragraphs, button text+URL, image URL+alt, link URL, repeater rows) via stable `element-id:settings.property` paths (not array indices)
- [ ] **ELEM-09**: Operator can review, rename, add, remove, and constrain auto-detected slots in a Slot Editor UI before any campaign runs against the template
- [ ] **ELEM-10**: System triggers Elementor CSS regeneration after every successful write, wrapped in `class_exists` / `method_exists` guards for plugin-version-mismatch safety

### Engine → Publish Adapter

- [ ] **ADAPT-01**: System serializes a brief from `hyperlocalContentEngine.ts` (or any other shipped engine producing briefs) into valid Elementor v4 atomic-widget JSON that validates against the pinned schema for the target site
- [ ] **ADAPT-02**: System fills slots using Claude Sonnet with `output_config.format: json_schema` (strict: true) — one structured tool call per `slot_kind`; token usage logged to `koto_token_usage` with `feature='builder_slot_fill'`
- [ ] **ADAPT-03**: System splices slot-fill values into the template JSON by path and preserves unknown settings keys untouched (forward-compat)
- [ ] **ADAPT-04**: Operator can generate N variant pages from a master template + seed dataset (city × service × phone, or equivalent) — persisted in `kotoiq_variants.rendered_elementor_data`
- [ ] **ADAPT-05**: **Pre-flight gate** blocks publish unless: (a) every required slot is populated with a non-empty value that is unique within the campaign, (b) at least one unique-local-data field is present (phone OR address OR neighborhood-specific text), (c) the rendered JSON validates against the pinned schema, (d) no two variants in the campaign share an identical body hash. The gate refuses rather than warns
- [ ] **ADAPT-06**: Operator can preview one rendered variant as a WP draft post (unpublished) with a screenshot + JSON diff against the master before bulk publish

### Durable Publish Orchestration

- [ ] **ORCH-01**: System defines a Vercel Workflow DevKit `publishCampaign` that runs per-variant `generate` → `publish` → `indexnow` → `step.sleep(24h)` → `cwvFirstRead` with durable sleep and deterministic replay
- [ ] **ORCH-02**: Operator can configure per-campaign cadence (`per_day_cap`, `start_at`, `timezone`) via `kotoiq_campaigns.cadence_config`; default is **~10/day drip** for established domains
- [ ] **ORCH-03**: System enforces idempotency keys on every Workflow step and every plugin command, keyed on `(campaign_id, variant_id, step_name)` — retries never create duplicate WP posts
- [ ] **ORCH-04**: Operator can view live campaign status (pending / publishing / live / failed) per variant in a Publish Queue dashboard and retry failed variants
- [ ] **ORCH-05**: Operator can kick, stop, and inspect Workflow runs via `/api/wp/builder/publish/route.ts` following the existing `{ action, agency_id, client_id, site_id, ... }` dispatch pattern

### Closed-Loop Attribution

- [ ] **ATTR-01**: System fetches Core Web Vitals field data per published URL from the CrUX API (28-day window, origin-level fallback when URL has <500 visits) and stores readings in `kotoiq_cwv_readings`
- [ ] **ATTR-02**: System injects a `web-vitals` RUM beacon (~2KB) into every published page via the plugin write path; the script beacons LCP/INP/CLS/FCP/TTFB to `/api/kotoiq/vitals` via `navigator.sendBeacon`
- [ ] **ATTR-03**: System provisions a unique Telnyx phone number per variant on first publish (`telnyx.numberOrders.create`), stores it on `kotoiq_publishes.tracking_number`, and injects it into the variant's `{{phone}}` slot before publish
- [ ] **ATTR-04**: System links inbound Telnyx calls to the publish that generated them by joining `koto_inbound_calls` to `kotoiq_publishes` on tracking number; inserts `kotoiq_call_attribution { inbound_call_id, publish_id, match_method='dynamic_number', confidence=1.0 }`
- [ ] **ATTR-05**: System submits every published URL to IndexNow (Bing/Yandex/Naver/Seznam) via protocol v1; the WP plugin serves the key file at `{site}/{key}.txt`
- [ ] **ATTR-06**: System pings Google via GSC sitemap on every publish and records the ping in `kotoiq_indexnow_submissions` with `engine='google_sitemap_ping'` (Google Indexing API explicitly excluded — restricted to JobPosting/BroadcastEvent)
- [ ] **ATTR-07**: Operator can query a per-page KPI rollup (one row per page) joining rank, clicks, CWV, call count, and estimated revenue from `kotoiq_publishes` + `koto_wp_rankings` + `kotoiq_cwv_readings` + `kotoiq_call_attribution` + inbound-call revenue
- [ ] **ATTR-08**: Operator can view a per-page detail view showing KPIs, attribution trail, refresh history, and "stop" + "unpublish" controls

### Feedback Loop (Rescan → Decay → Auto-Refresh)

- [ ] **LOOP-01**: System runs a weekly Vercel Cron that walks `kotoiq_publishes` for each site, pulls current rank/CWV/clicks, and feeds each URL into the existing `contentRefreshEngine.ts` for decay analysis
- [ ] **LOOP-02**: When `contentRefreshEngine` recommends a refresh, system queues a variant regeneration against the same slot map using updated engine output; operator approves the refresh before re-publish via the same adapter
- [ ] **LOOP-03**: Operator can view a refresh history timeline on the per-page detail view showing (published → refresh #1 → refresh #2 …) with per-step slot-fill diffs

### UI Consolidation

- [ ] **UI-01**: Operator can access a unified KotoIQ shell (`src/views/kotoiq/KotoIQDashboardPage.jsx`) at one route, with tabs **Intel · Publish · Tune · Settings**; M1 lights up Publish (new) and mounts the existing 35 KotoIQ tabs unchanged under Intel (read-only for M1)
- [ ] **UI-02**: Legacy `/wordpress`, `/seo`, and related paths redirect into the appropriate unified-shell tabs without breaking existing bookmarks
- [ ] **UI-03**: Operator can compose a campaign in a Campaign Composer UI (pair a template with a seed dataset, preview N rows, set cadence)
- [ ] **UI-04**: Operator can ingest a template via a Template Ingest UI (pick site → list pages → pull one → preview + auto-detected slots)

### Pilot

- [ ] **PILOT-01**: 20 real hyperlocal landing pages are live on momentamktg.com — each generated from `hyperlocalContentEngine` brief output, published as native Elementor v4, IndexNow-submitted, GSC-pinged, per-page Telnyx-attributed, and returning CWV field data

### Client Profile Seeder v1 — Internal Ingest + Gap Finder

- [ ] **PROF-01**: Operator can paste a Koto internal URL (`/onboard/:clientId`, `/onboarding-dashboard/:clientId`, or `/clients/:clientId`) and the system resolves it, extracts `clientId`, and pulls `clients` + `onboarding_answers` + `koto_discovery_engagements` + voice call transcripts + post-call analyses into the profile pipeline
- [ ] **PROF-02**: Operator can paste raw text (voice transcript, email, meeting notes, pasted website copy, call notes) and Claude extracts structured fields against the canonical client-profile schema with per-field source citation (char offset + snippet)
- [x] **PROF-03**: System stores the resolved profile in a new `kotoiq_client_profile` table keyed on `client_id` + `agency_id`, with per-field `source_type`, `source_url`, `captured_at`, and confidence score per platform `VerifiedDataSource` standard
- [x] **PROF-04**: Gap-finder compares the populated profile against the canonical field schema + pipeline-required fields and emits 3-8 surgical follow-up questions (not 26 blind ones); low-confidence auto-fills are also surfaced for operator confirmation
- [ ] **PROF-05**: Operator can review every auto-populated field in a review UI with confidence-weighted hints (green/amber/red), and accept, edit, or reject each field individually; rejections do not delete source provenance
- [ ] **PROF-06**: On profile completion, the seeder feeds `pipelineOrchestrator.ts` as a Stage 0 step — the entity graph is seeded with client identity, services, USPs, target customers, and mentioned competitors before any Stage 1 keyword sync runs

### Client Profile Seeder v2 — External Source Parsers

- [ ] **PROF-07**: Operator can paste an external form URL (Typeform, Jotform, Google Forms public share link, or generic multi-page HTML form) → system fetches via Playwright-on-Vercel or provider API → extracts Q&A pairs → maps to canonical schema with confidence scoring
- [ ] **PROF-08**: Operator can paste a client's existing website URL → Playwright crawls About / Services / Locations / Contact / Team pages → Claude extracts entity data (services, service-area cities, staff, USPs, founding year, certifications) → seeds both `kotoiq_client_profile` and the Stage 2 entity graph with per-page citation
- [ ] **PROF-09**: Operator can connect a client's Google Business Profile → Google My Business API pulls LocalBusiness fields, service categories, operating hours, service area, review themes → merged into the profile with GBP as `source_url`
- [ ] **PROF-10**: Operator can upload a PDF, DOCX, or image (proposal, brochure, sales deck, business card) → system extracts text (OCR for images), chunks it, and Claude extracts structured fields with per-chunk citation
- [ ] **PROF-11**: All external-source ingests write to `kotoiq_client_profile.sources` with `source_type` (`typeform` / `website_scrape` / `gbp_api` / `pdf_upload` / `image_ocr`), `source_url` or upload hash, confidence per extracted field, and `captured_at` — all sources auditable from the per-client profile view

---

## Future Requirements (deferred to later milestones)

### M2 — Feedback loop deepened

- [ ] Full auto-refresh without operator approval (once M1 confirms refresh quality is high)
- [ ] Rank-drop real-time alerting (not weekly batch)
- [ ] Cross-site template learning (what worked for client A → recommend for client B)

### M3 — KotoSEO Engine (Rank Math clone)

- [ ] On-page SEO scoring inside Koto (focus keyword, meta templates, schema composer, breadcrumbs, redirects, 404 monitor, sitemap control, XML sitemap priority/changefreq)
- [ ] WP plugin bridges that write to Rank Math / Yoast / native fields
- [ ] Every generated page passes KotoSEO scoring gate before publish

### M4 — Intel command center expansion

- [ ] AI Overview / LLM citation tracking (Google AI, ChatGPT, Claude, Perplexity, Gemini)
- [ ] SERP feature share-of-pixel model
- [ ] Competitor new-page / new-backlink real-time alerting
- [ ] Log-file analysis for real crawl budget
- [ ] Link reclamation / disavow manager
- [ ] Entity engine reinforcement

### M5 — Moat features

- [ ] Reddit / forum / niche community question mining
- [ ] A/B title testing on published pages
- [ ] Image SEO pipeline (auto alt text, geo-EXIF, auto-sitemap)
- [ ] Multi-location manager
- [ ] Auto-schema injection refinement

### Post-M1 performance improvements

- [ ] Number-pool DNI (scale beyond ~30 pages)
- [ ] Synthetic Lighthouse runs (currently using CrUX + RUM only)
- [ ] Avada / Fusion Builder adapter

---

## Out of Scope (explicit — with reasoning)

- **Content generation rebuild** — shipped at ~7,700 lines (`semanticAgents`, `hyperlocalContentEngine`, `autonomousPipeline`, and 20+ sibling engines). M1 consumes this, never rebuilds it.
- **In-Koto drag-drop WYSIWYG editor** — rebuilding Elementor's editor is ~year of scope for marginal value. Clients design the master template in native Elementor admin where it's already perfect.
- **Avada / Fusion Builder adapter** — deferred. One builder adapter at a time.
- **Full AI Overview / LLM citation tracking engine** — deferred to M4.
- **Rank Math clone (KotoSEO Engine)** — deferred to M3.
- **Watermark Remover** — legal gray area, removed from roadmap.
- **Plagiarism Check in-house builder** — delegate to Copyscape API if needed.
- **Upwork Tool** — unclear SEO value; defer or cut.
- **Brand SERP as standalone tool** — fold into AI Overview tracking in M4.
- **Google Indexing API for Service / LocalBusiness pages** — officially restricted to JobPosting + BroadcastEvent; misuse risks account revocation.
- **Number-pool DNI** — beyond ~30 pages per client; pilot is 20 pages. Defer to post-M1.
- **Synthetic Lighthouse / Playwright CWV runs** — CrUX + web-vitals RUM covers M1 needs at zero cost.
- **New queue infrastructure** — existing `koto_wp_commands` queue stays as plugin-call audit log; Vercel Workflow DevKit sits above it for multi-step orchestration. No third queue.
- **WYSIWYG rendering with client theme CSS inside Koto** — template stays in client's real WP admin.

---

## Traceability

**Coverage:** 53/53 v1.0 requirements mapped to exactly one phase. No orphans. No duplicates.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Pending |
| FND-02 | Phase 1 | Pending |
| FND-03 | Phase 1 | Pending |
| FND-04 | Phase 1 | Pending |
| FND-05 | Phase 1 | Pending |
| ELEM-01 | Phase 1 | Pending |
| ELEM-02 | Phase 1 | Pending |
| ELEM-03 | Phase 1 | Pending |
| ELEM-04 | Phase 2 | Pending |
| ELEM-05 | Phase 1 | Pending |
| ELEM-06 | Phase 1 | Pending |
| ELEM-07 | Phase 2 | Pending |
| ELEM-08 | Phase 2 | Pending |
| ELEM-09 | Phase 2 | Pending |
| ELEM-10 | Phase 2 | Pending |
| ADAPT-01 | Phase 3 | Pending |
| ADAPT-02 | Phase 3 | Pending |
| ADAPT-03 | Phase 3 | Pending |
| ADAPT-04 | Phase 3 | Pending |
| ADAPT-05 | Phase 3 | Pending |
| ADAPT-06 | Phase 3 | Pending |
| ORCH-01 | Phase 4 | Pending |
| ORCH-02 | Phase 4 | Pending |
| ORCH-03 | Phase 4 | Pending |
| ORCH-04 | Phase 4 | Pending |
| ORCH-05 | Phase 4 | Pending |
| ATTR-01 | Phase 5 | Pending |
| ATTR-02 | Phase 5 | Pending |
| ATTR-03 | Phase 5 | Pending |
| ATTR-04 | Phase 5 | Pending |
| ATTR-05 | Phase 5 | Pending |
| ATTR-06 | Phase 5 | Pending |
| ATTR-07 | Phase 5 | Pending |
| ATTR-08 | Phase 5 | Pending |
| LOOP-01 | Phase 6 | Pending |
| LOOP-02 | Phase 6 | Pending |
| LOOP-03 | Phase 6 | Pending |
| UI-01 | Phase 6 | Pending |
| UI-02 | Phase 6 | Pending |
| UI-03 | Phase 6 | Pending |
| UI-04 | Phase 2 | Pending |
| PILOT-01 | Phase 6 | Pending |
| PROF-01 | Phase 7 | Pending |
| PROF-02 | Phase 7 | Pending |
| PROF-03 | Phase 7 | Complete |
| PROF-04 | Phase 7 | Complete |
| PROF-05 | Phase 7 | Pending |
| PROF-06 | Phase 7 | Pending |
| PROF-07 | Phase 8 | Pending |
| PROF-08 | Phase 8 | Pending |
| PROF-09 | Phase 8 | Pending |
| PROF-10 | Phase 8 | Pending |
| PROF-11 | Phase 8 | Pending |

**Phase summary counts:**

| Phase | Requirement count | Requirements |
|-------|-------------------|--------------|
| Phase 1 — Foundations + Elementor Read Path | 10 | FND-01, FND-02, FND-03, FND-04, FND-05, ELEM-01, ELEM-02, ELEM-03, ELEM-05, ELEM-06 |
| Phase 2 — Elementor Write Path + Template Ingest + Slot Editor | 6 | ELEM-04, ELEM-07, ELEM-08, ELEM-09, ELEM-10, UI-04 |
| Phase 3 — Engine to Publish Adapter + Pre-Flight Gate | 6 | ADAPT-01, ADAPT-02, ADAPT-03, ADAPT-04, ADAPT-05, ADAPT-06 |
| Phase 4 — Durable Publish Orchestration | 5 | ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05 |
| Phase 5 — Closed-Loop Attribution | 8 | ATTR-01, ATTR-02, ATTR-03, ATTR-04, ATTR-05, ATTR-06, ATTR-07, ATTR-08 |
| Phase 6 — Feedback Loop + Unified Shell + Pilot | 7 | LOOP-01, LOOP-02, LOOP-03, UI-01, UI-02, UI-03, PILOT-01 |
| Phase 7 — Client Profile Seeder v1 | 6 | PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06 |
| Phase 8 — Client Profile Seeder v2 | 5 | PROF-07, PROF-08, PROF-09, PROF-10, PROF-11 |
| **Total** | **53** | |
