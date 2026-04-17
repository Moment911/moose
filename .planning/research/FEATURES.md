# Features Research — KotoIQ M1: Elementor Template-Clone Publisher + Closed-Loop Attribution

**Milestone:** KotoIQ M1 — adapter + closed-loop layer bridging existing ~7,700-line semantic/content stack into native Elementor v4 publishing with per-page revenue attribution.
**Researched:** 2026-04-17
**Confidence:** HIGH (scope is narrow and grounded in the shipped codebase); MEDIUM on the novelty claim in §2 (cannot prove absence, only that targeted searches did not surface a match).

---

## Scope rule for this document

**Do not list any feature that duplicates a shipped engine.** The content-generation side of KotoIQ is built and in production. Every feature below is an adapter, a pipeline stage, a UI surface, or a feedback-loop wire that **consumes** existing engine output — never regenerates it.

Shipped engines M1 consumes (referenced throughout §4):

- `src/lib/semanticAgents.ts` + `semanticAgentsTier2.ts` + `semanticAgentsTier3.ts`
- `src/lib/semanticAnalyzer.ts`, `src/lib/semanticPostProcessors.ts`
- `src/lib/hyperlocalContentEngine.ts` (the hyperlocal brief + LocalBusiness-schema engine — this IS the content pipeline)
- `src/lib/autonomousPipeline.ts` (multi-engine orchestrator)
- `src/lib/contentRefreshEngine.ts` (decay + refresh)
- `src/lib/topicalMapEngine.ts`, `eeatEngine.ts`, `queryPathEngine.ts`, `knowledgeGraphExporter.ts`, `contentCalendarEngine.ts`
- `src/lib/rankGridProEngine.ts`, `competitorWatchEngine.ts`, `backlinkEngine.ts`, `backlinkOpportunityEngine.ts`
- `src/lib/brandSerpEngine.ts`, `aiVisibilityEngine.ts`, `industryBenchmarkEngine.ts`, `industryLLMEngine.ts`
- `src/lib/gscAuditEngine.ts`, `bingAuditEngine.ts`, `onPageEngine.ts`, `internalLinkEngine.ts`, `gmbImageEngine.ts`, `visitorIntentScorer.ts`, `plagiarismEngine.ts`
- `src/lib/multiAiBlender.ts`, `dynamicPromptBuilder.ts`, `strategyEngine.ts`, `scoutQueryParser.ts`, `askKotoIQEngine.ts`
- `src/app/api/kotoiq/route.ts` + 35 existing `*Tab.jsx` components under `src/components/kotoiq/`
- `src/app/api/wp/route.ts` (`proxyToPlugin()` + `koto_wp_commands` audit-queue pattern)

---

## 1. Table Stakes

Must-ship for M1 to be called "done." If any of these is missing, M1 is not a closed loop — it is a fire-and-forget publisher.

### 1.1 Native Elementor v4 Read/Write Adapter

| # | Feature | Complexity | Why table stakes |
|---|---------|------------|------------------|
| 1.1.1 | **Builder detection endpoint** (`builder/detect` — WP plugin) returning `{ elementor_version, pro_version, atomic_enabled, theme_name, php_version }` | **S** | Every other endpoint branches on this; no v4 gating without it. |
| 1.1.2 | **Elementor page lister** (`builder/pages`) — lists posts with `_elementor_edit_mode` set | **S** | Operator picks a master from a real list; no guessing post IDs. |
| 1.1.3 | **`_elementor_data` reader** (`builder/elementor/{id}` GET) returning raw JSON + `_elementor_version` + `_elementor_page_settings` | **S** | Source of truth for ingest. |
| 1.1.4 | **`_elementor_data` writer via `Document::save()` PHP adapter** (`builder/elementor/{id}` PUT) — invokes Elementor's own save API from inside the plugin, NOT direct `update_post_meta('_elementor_data', ...)` | **M** | Direct postmeta writes trigger atomic-widget CSS-regen + revision + version-pinning bugs reported against v4 (GitHub #32632 / #33000 / #35397). Calling Elementor's canonical `Document::save()` avoids them and handles `wp_slash` / revision / CSS regen correctly. |
| 1.1.5 | **Schema registry (per-site pinned)** — `kotoiq_elementor_schema_versions` stores Zod schemas derived from live captured JSON per `{elementorVersion}.{widgetType}` | **M** | v4 developer APIs are not public; only ground truth is captured JSON. Registry lets the adapter survive 4.0.3 → 4.1 drift without code release. |
| 1.1.6 | **Schema drift detector** — on every ingest, diff captured shape against pinned schema; flag additive vs breaking changes | **S** | Elementor ships minor versions silently; without this we deindex sites after a plugin update. |
| 1.1.7 | **Master template ingest** — pull one Elementor v4 page → store in `kotoiq_templates.elementor_data` + auto-populate `kotoiq_template_slots` | **M** | Clone source-of-truth. Master stays in Koto; original WP page is never mutated. |
| 1.1.8 | **Slot detector** — walk the JSON tree, identify fillable positions (heading text, paragraph, button text+URL, image URL+alt, link URL, repeater rows) via stable `element-id:settings.property` paths | **M** | Slots must survive minor template edits; path-based IDs, not array indices. |
| 1.1.9 | **Slot editor UI** (`src/views/kotoiq/SlotEditorPage.jsx`) — review auto-detected slots; rename, add, remove, assign wildcards, set constraints | **M** | Auto-detection on atomic widgets is never perfect; operator override required before any campaign runs. |
| 1.1.10 | **Elementor CSS regeneration trigger** wrapped in `class_exists` / `method_exists` guards for plugin-version mismatch safety | **S** | Without this, newly written pages render with stale CSS until a manual admin regen. |

### 1.2 Engine → Publish Adapter (the bridge)

| # | Feature | Complexity | Why table stakes |
|---|---------|------------|------------------|
| 1.2.1 | **Brief-to-Elementor serializer** — takes `hyperlocalContentEngine` brief output (LocalBusiness schema + neighborhood copy + local entities) and emits valid Elementor v4 atomic-widget JSON per template slot map | **L** | The single load-bearing piece. Round-trips through Zod-against-pinned-schema. This is the ONE "L" in the list — everything else is glue. |
| 1.2.2 | **Claude Sonnet structured-output slot filler** using `output_config.format: json_schema` (strict: true) — one tool per `slot_kind`, each call returns `{ slot_id, value }` | **M** | Free-form Claude output loses slot bindings; strict structured outputs eliminate retry-on-JSON-parse loops. Logs to `koto_token_usage` with `feature='builder_slot_fill'`. |
| 1.2.3 | **Slot-fill splicer** — precise deep-set into `_elementor_data` by path; preserves unknown settings keys untouched | **S** | "Never drop keys you don't recognize" — forward-compat on Elementor minor releases. |
| 1.2.4 | **Template-clone + variant materialization** — given N seed rows (city × service × phone), produce N `kotoiq_variants.rendered_elementor_data` rows | **S** | Trivial once serializer + splicer work; map over seeds. |
| 1.2.5 | **Pre-flight gate** — BLOCK publish unless: (a) every required slot populated with non-empty unique-per-variant value, (b) at least one unique-local-data field present (phone OR address OR neighborhood-specific text), (c) JSON validates against pinned schema, (d) no two variants in the same campaign share identical hash of rendered body | **M** | **The scaled-content-abuse defuser.** Google's policy flags bursts of near-identical pages; the pre-flight gate makes deindex-by-construction impossible. Non-negotiable — the publish function refuses to run rather than depending on operator vigilance. |
| 1.2.6 | **Variant preview** — render one variant as a WP draft post (unpublished) and show a screenshot + JSON diff against master before bulk publish | **M** | Operators must see one variant look right before the other 19 fire. |

### 1.3 Durable Publish Orchestration

| # | Feature | Complexity | Why table stakes |
|---|---------|------------|------------------|
| 1.3.1 | **Vercel Workflow DevKit `publishCampaign` definition** — per-variant: `generate` → `publish` → `indexnow` → `step.sleep(24h)` → `cwvFirstRead` | **M** | Publish campaigns span minutes to days. A deploy mid-campaign cannot lose variants. Workflow's durable sleep + deterministic replay is purpose-built for this. |
| 1.3.2 | **Cadence controls** — `kotoiq_campaigns.cadence_config` with `{ per_day_cap, start_at, timezone }`; default **~10/day drip** for established domains, lower for new ones | **S** | Burst publishing is deindex risk even for genuinely differentiated pages. Drip by default. |
| 1.3.3 | **Idempotency keys on every Workflow step + plugin command** — keyed on `(campaign_id, variant_id, step_name)` | **S** | Workflow retries must be safe; plugin PUTs must be safe. One publish == one WP post even under retry storms. |
| 1.3.4 | **Publish queue dashboard** (`src/views/kotoiq/PublishQueuePage.jsx`) — live status: pending / publishing / live / failed; per-variant retry | **M** | Operators need visibility; "trust me bro" orchestration doesn't fly at 10/day cadence. |
| 1.3.5 | **`/api/wp/builder/publish/route.ts`** — kicks Workflow runs, polls status; follows existing `{action, agency_id, client_id, site_id, ...}` dispatch pattern | **S** | One more route in the pattern 131 existing routes already follow. |

### 1.4 Closed-Loop Attribution

| # | Feature | Complexity | Why table stakes |
|---|---------|------------|------------------|
| 1.4.1 | **CrUX API client** (`src/lib/builder/cruxClient.ts`) — field CWV per URL, 28-day window, with origin-level fallback when URL has <500 visits | **S** | Free, 150 qpm, no SDK needed. Field-data half of CWV. |
| 1.4.2 | **`web-vitals` RUM beacon** — ~2KB script injected into published pages by the plugin's write endpoint; beacons LCP/INP/CLS/FCP/TTFB to `/api/kotoiq/vitals` via `navigator.sendBeacon` | **S** | Fills the CrUX gap for new/low-traffic pages. Session-level granularity CrUX cannot give. |
| 1.4.3 | **Per-page Telnyx number provisioning** — on first publish of a variant, `telnyx.numberOrders.create`, store on `kotoiq_publishes.tracking_number`, inject into the page's `{{phone}}` slot | **M** | Only attribution method with confidence = 1.0. Works economically up to ~30 pages at $1-2/number/month; pilot is 20 pages. DNI pool upgrade deferred to post-M1. |
| 1.4.4 | **Inbound call → page attribution linker** — hook in the existing Telnyx inbound webhook path that calls `attributionLinker.match(call)`, inserts `kotoiq_call_attribution { inbound_call_id, publish_id, match_method='dynamic_number', confidence=1.0 }` | **S** | Joins `koto_inbound_calls` (existing) to `kotoiq_publishes` via tracking number. No schema change to calls table. |
| 1.4.5 | **IndexNow submitter** (`src/lib/builder/indexnow.ts`) — protocol v1, 10K URLs per POST, key file served from `{site}/{key}.txt` by the WP plugin | **S** | Covers Bing/Yandex/Naver/Seznam. Free, no rate limit for reasonable usage. |
| 1.4.6 | **GSC sitemap ping on publish** — mark in `kotoiq_indexnow_submissions` with `engine='google_sitemap_ping'`; Google Indexing API dropped per research (restricted to JobPosting/BroadcastEvent) | **S** | Sitemap ping + GSC deep-link is the remaining legitimate Google signal for LocalBusiness/Service pages. |
| 1.4.7 | **Per-page KPI rollup** — SQL view joining `kotoiq_publishes` + `koto_wp_rankings` (existing) + `kotoiq_cwv_readings` + `kotoiq_call_attribution` + inbound-call revenue estimate → one row per page with rank, clicks, CWV, call count, estimated revenue | **M** | The whole point: "which published page made us money?" must be one query. |
| 1.4.8 | **Per-page detail view** (`src/views/kotoiq/PublishedPageDetailPage.jsx`) — KPIs, attribution trail, refresh history, "stop" + "unpublish" controls | **M** | Single pane of glass per page. |

### 1.5 Feedback Loop — Rescan → Decay → Auto-Refresh

| # | Feature | Complexity | Why table stakes |
|---|---------|------------|------------------|
| 1.5.1 | **Weekly rescan cron** — Vercel Cron kicks a Workflow per site that walks `kotoiq_publishes`, pulls current rank/CWV/clicks, feeds each URL into `contentRefreshEngine.ts` | **S** | `contentRefreshEngine` already detects decay; we wire the trigger. |
| 1.5.2 | **Decay-triggered re-publish** — when `contentRefreshEngine` recommends refresh, queue a variant regeneration against same slot map using updated engine output; operator approves → publish via same adapter | **M** | Closes the loop. Publish once, measure, regenerate, re-publish — no human re-briefing. |
| 1.5.3 | **Refresh history on per-page detail view** — timeline of (published → refresh #1 → refresh #2 ...) with diff of slot_fills between versions | **S** | Audit trail for "why did rank improve/tank." |

### 1.6 UI Consolidation

| # | Feature | Complexity | Why table stakes |
|---|---------|------------|------------------|
| 1.6.1 | **Unified KotoIQ shell** (`src/views/kotoiq/KotoIQDashboardPage.jsx`) consolidating `/wordpress` + `/seo` + existing KotoIQ tabs into one command center with tabs: **Intel · Publish · Tune · Settings**. M1 lights up **Publish** (new) + read-only **Intel** (existing 35-tab surface mounted unchanged). | **M** | Three UIs undermine "one closed loop." Existing routes stay as redirect shims for URL backward-compat. |
| 1.6.2 | **Redirect shims** from `/wordpress`, `/seo`, related legacy paths into the new shell tabs | **S** | Don't break existing bookmarks. |
| 1.6.3 | **Campaign composer** (`src/views/kotoiq/CampaignComposerPage.jsx`) — pair a template with a seed dataset, preview N rows, schedule cadence | **M** | UI entry point for the publish loop. |
| 1.6.4 | **Template ingest UI** (`src/views/kotoiq/TemplateIngestPage.jsx`) — pick site → list pages → pull one → render preview + auto-detected slots | **S** | UI wrapper over read endpoints. |

### 1.7 Foundations (must land Phase 1)

| # | Feature | Complexity | Why table stakes |
|---|---------|------------|------------------|
| 1.7.1 | **Agency-isolation audit** — sweep every new + touched route, confirm `.eq('agency_id', agencyId)` (or transitive equivalent) on every Supabase query; document gaps | **S** | Per `_knowledge/feedback_agency_isolation.md`, hard platform constraint. Ship a gap = cross-tenant leak. |
| 1.7.2 | **`getAgencyScopedSupabaseClient()` helper** in `src/lib/supabase.js` — returns a proxy that refuses `from()` calls without a subsequent `.eq('agency_id', ...)` | **M** | App-level belt to complement RLS suspenders. |
| 1.7.3 | **ESLint custom rule** flagging direct `supabase.from('kotoiq_*')` without downstream `.eq('agency_id', ...)` or use of the scoped helper | **M** | Prevents regressions from future contributors. |
| 1.7.4 | **Supabase migration `20260XXX_kotoiq_builder.sql`** — creates all 10 new tables (`kotoiq_templates`, `kotoiq_template_slots`, `kotoiq_campaigns`, `kotoiq_variants`, `kotoiq_publishes`, `kotoiq_cwv_readings`, `kotoiq_indexnow_submissions`, `kotoiq_call_attribution`, `kotoiq_elementor_schema_versions`, `kotoiq_builder_sites`) with RLS mirroring existing `koto_wp_sites` shape | **M** | All new tables carry `agency_id` explicit or transitive; enforced at app + RLS + Workflow metadata layers. |
| 1.7.5 | **Extend `koto_wp_pages` with `template_id`, `variant_id`, `publish_id`** — additive, no existing columns change | **S** | Dual-write: `kotoiq_publishes` canonical, `koto_wp_pages` existing sync-cache. |

### 1.8 Pilot

| # | Feature | Complexity | Why table stakes |
|---|---------|------------|------------------|
| 1.8.1 | **20 real hyperlocal landing pages live on momentamktg.com**, each generated from `hyperlocalContentEngine` output, published as native Elementor, indexed via IndexNow + GSC ping, with per-page Telnyx number + CWV reading | **M** | M1 is "done" when the closed loop runs end-to-end on Adam's own agency site. |

---

## 2. Differentiators

These features make M1 genuinely novel. They are small in implementation relative to the shipped semantic stack, but the **combination** does not appear to exist as a single product in 2026.

### 2.1 Native Elementor v4 atomic-widget write-back

**What it is:** Koto writes directly into `_elementor_data` via Elementor's own `Document::save()` PHP API, producing pages the Elementor editor treats as first-class — editable in the Elementor UI, rendered by Elementor's CSS pipeline, versioned via Elementor's revision system.

**Competitive analysis:**

- **AirOps** ([WordPress integration docs](https://docs.airops.com/building-workflows/workflow-steps/integrations/wordpress); [March 2026 CMS integrations announcement](https://www.businesswire.com/news/home/20260303233493/en/AirOps-Brings-AI-Search-Optimization-Directly-Into-the-Enterprise-Content-Stack-with-New-Suite-of-CMS-and-Project-Management-Integrations)): publishes via WP REST API as Gutenberg / standard posts. Added CMS integrations for WordPress, Contentful, Sanity, ContentStack, Ghost, Strapi. **No Elementor-native write.** Pages appear in WP but are not Elementor documents — cannot be edited in the Elementor editor.
- **SEOmatic** ([WordPress integration](https://seomatic.ai/integrations/wordpress)): WP REST API only. Claims "works with Elementor" in the sense that pages render inside an Elementor-themed site — does **not** write Elementor documents. Generated pages are standard WP posts wrapped in theme chrome.
- **Programmatic SEO tools broadly** (Webflow publishers, Framer sync, Ghost integrations, Strapi pipelines): all write to headless CMS or page-builder-agnostic REST. None write atomic-widget JSON.
- **Elementor's own AI Site Planner / AI Builder** (v4 launch April 2026): generates Elementor pages *inside the Elementor admin UI*. No external API surface for programmatic scaled publishing.

**The gap:** No product surfaced in targeted searches that generates pages from external engine output AND writes them as native Elementor v4 atomic documents. Closest is SEOmatic, which publishes via REST and lets Elementor theme-wrap them — not the same thing. Confidence: MEDIUM on absence.

### 2.2 Per-page Telnyx attribution tied to `page_id` on generated landing pages

**What it is:** Every variant at publish time gets its own Telnyx number, injected into the page's phone slot, stored in `kotoiq_publishes.tracking_number`. When a call arrives, the attribution linker resolves `to_number → publish_id → variant_id → template_id → campaign_id` — 1:1 map with confidence 1.0.

**Competitive analysis:**

- **CallRail DNI** ([DNI overview](https://support.callrail.com/hc/en-us/articles/5711814948877-Dynamic-number-insertion-overview); [Unbounce integration](https://unbounce.com/product/integrations/callrail/)): client-side JS swaps phone numbers **by traffic source** (Google Ads, Bing Organic, Yelp, etc.), not per-generated-page. Granularity = source. CallRail + Unbounce pairs landing pages with numbers but requires manual page-by-page setup, and CallRail does not generate the pages.
- **Invoca**: enterprise DNI, similar model — session-level attribution by traffic source, not per-generated-page.
- **AirOps / SEOmatic / programmatic SEO tools**: none include phone-attribution in the publish pipeline. Users wire CallRail separately, which does source-level (not page-level) attribution.

**The gap:** No product bakes per-page number provisioning into the publish pipeline for programmatically generated pages. Doing so requires owning both the number inventory (Telnyx) and the publish pipeline — which Koto does, because the Telnyx infra is already in the stack from the answering service.

**Economics:** $1-2/number/month × 20 pilot pages = $20-40/month/client. Economical to ~30 pages. Pool DNI upgrade (~$10-40/month per pool) unlocks 100+ pages post-M1.

### 2.3 Rescan → decay → auto-refresh → re-publish loop

**What it is:** Weekly cron walks published pages, feeds them into the already-shipped `contentRefreshEngine.ts`, which detects decay (rank drop, CWV regression, CTR decay, stale entities). Decay-flagged pages queue a variant regeneration pass through the same adapter; operator approves; re-publish.

**Competitive analysis:**

- **AirOps**: has a "refresh" workflow step that regenerates content and re-publishes via WP REST. Not wired to an automated decay detector — operator manually queues refreshes. Not Elementor-aware.
- **Clearscope / Frase / MarketMuse**: surface "pages to refresh" dashboards but don't publish. Advisory only.
- **`contentRefreshEngine.ts` is already shipped** inside KotoIQ but is not wired to published pages today. M1 is the wire.

**The gap:** Shipped content-refresh detector + native Elementor write-back adapter + durable workflow orchestration = a fully-automated tune loop. Combo does not appear elsewhere.

### 2.4 Per-page revenue rollup (rank + clicks + CWV + calls + revenue in one query)

**What it is:** SQL view `kpi_by_page` joins five signals — `koto_wp_rankings` (rank) + GSC sync (clicks) + `kotoiq_cwv_readings` (CWV) + `kotoiq_call_attribution` (calls) + industry-configured per-call value (revenue) — into one row per published page.

**Competitive analysis:**

- **Rank trackers** (Semrush, Ahrefs, STAT): rank per page. No call data.
- **Call-tracking** (CallRail, Invoca): calls per source. No rank or CWV.
- **GSC + GA4**: clicks + sessions per page. No calls.
- **Current agency pattern**: Ahrefs + GSC + CallRail + Semrush stitched in Looker Studio.

**The gap:** No native tool surfaces rank + organic clicks + CWV + calls + revenue per generated page in one view.

### 2.5 Pre-flight gate that mathematically prevents scaled-content-abuse

**What it is:** Publish is blocked unless unique-local-data + slot-population + schema-validity + cross-variant-hash-uniqueness all pass. Not a post-hoc content audit — a gate built into the publish function. The 20 pilot pages cannot be near-duplicates even if an operator tries.

**Competitive analysis:** Programmatic SEO tools (AirOps, SEOmatic, Clay) rely on operator prompting + post-publish audit. None gate publish on quantitative uniqueness.

**The gap:** Publish-gate-by-construction is a moat. "How do you avoid Google's scaled content policy?" → "The function refuses to run" — not "we prompt Claude carefully."

### Summary: is this combo standalone?

| Capability | AirOps | SEOmatic | CallRail | `contentRefreshEngine` as-is | **Koto M1** |
|------------|--------|----------|----------|-----------------------------|-------------|
| Publish to WordPress | ✓ (REST) | ✓ (REST) | ✗ | ✗ | ✓ |
| **Native Elementor v4 atomic write** | ✗ | ✗ | ✗ | ✗ | **✓** |
| Per-page phone attribution on generated pages | ✗ | ✗ | source-level only | ✗ | **✓** |
| Decay detection | partial | ✗ | ✗ | ✓ | ✓ (wired) |
| Auto re-publish on decay | manual trigger | ✗ | ✗ | ✗ | **✓** |
| Per-page rank + clicks + CWV + calls + revenue in one view | ✗ | ✗ | ✗ | ✗ | **✓** |
| Publish-gate on uniqueness | ✗ | ✗ | ✗ | ✗ | **✓** |

Based on searches, **this combination is standalone in the market as of April 2026.** Confidence: MEDIUM (proving absence is hard; based on targeted competitive searches not surfacing a match).

---

## 3. Anti-Features (explicitly NOT in M1)

Each has been considered and rejected for M1 — either already shipped or deliberately out of scope.

| Anti-feature | Why NOT in M1 |
|--------------|--------------|
| **Content-generation rebuilds** (semantic agents T1/T2/T3, `hyperlocalContentEngine`, `topicalMapEngine`, `eeatEngine`, `queryPathEngine`, `knowledgeGraphExporter`, `contentCalendarEngine`, `autonomousPipeline`, `multiAiBlender`, `dynamicPromptBuilder`, `strategyEngine`, `scoutQueryParser`, `rankGridProEngine`, `competitorWatchEngine`, `backlinkEngine`, `brandSerpEngine`, `gscAuditEngine`, `bingAuditEngine`, `onPageEngine`, `internalLinkEngine`, `aiVisibilityEngine`, `visitorIntentScorer`, `plagiarismEngine`, `gmbImageEngine`, `industryBenchmarkEngine`, `industryLLMEngine`, `askKotoIQEngine`) | **Already shipped — ~7,700 lines in production.** M1 consumes these; it does not rebuild them. See §4. |
| **In-Koto drag-and-drop WYSIWYG editor** (render Elementor preview inside Koto, drag-to-position) | Rebuilding Elementor's editor = year of scope for marginal business value. Clients design the master template in real Elementor admin, where it is already perfect. Captured in `PROJECT.md` Key Decisions. |
| **Avada / Fusion Builder adapter** | Deferred to M2. One adapter at a time; Elementor first, proven, then second. |
| **Full AI Overview / LLM citation tracking engine** | Deferred to M4 (Intel command center). M1 tracks rank + clicks + CWV + calls only. `brandSerpEngine.ts`, `aiVisibilityEngine.ts` surface read-only in the Intel tab; full citation buildout is M4. |
| **Rank Math clone / KotoSEO Engine** | Deferred to M3. Strategic moat but M1 must prove template-clone works first. Without that, KotoSEO has nothing to gate on. |
| **Watermark Remover** | Legal gray area; removed from roadmap entirely per `PROJECT.md`. |
| **Plagiarism Check as standalone in-house UI** | `plagiarismEngine.ts` already exists for in-pipeline checks. If a standalone Copyscape-replacement UI is needed, delegate to Copyscape API. Not M1. |
| **Upwork Tool** | Unclear SEO value; deferred or cut. |
| **Brand SERP as standalone tool** | Fold into AI Overview tracking in M4. `brandSerpEngine.ts` continues to feed the existing 35-tab surface read-only in M1. |
| **WYSIWYG rendering with client's theme CSS inside Koto** | Template stays in client's real WP admin; screenshot-based preview is sufficient for M1. |
| **Google Indexing API integration for Service/LocalBusiness pages** | API restricted to JobPosting + BroadcastEvent; use for other pages risks account revocation. IndexNow covers Bing/Yandex/Naver/Seznam; Google gets sitemap ping + GSC. Wire Indexing API only when a client ships JobPosting or BroadcastEvent pages (post-M1). |
| **Number-pool DNI** (shared pool with session-keyed assignment) | Deferred. Per-page dedicated numbers are economical up to 30 pages; pilot is 20. Pool upgrade unlocks 100+ pages/client at lower cost — nothing for M1 to prove that a 20-page pilot can't. |
| **Synthetic Lighthouse CWV inside a Vercel function** | 20-60s per run, blows past function timeouts, gives lab data that doesn't match real users. CrUX API (field) + `web-vitals` RUM is sufficient for M1. |
| **Cross-builder page renderer** (render Avada + Gutenberg + Elementor in one preview iframe) | Single-builder focus for M1. |
| **Rebuild of `PageBuilderPage.jsx` HTML-wildcard mode** | Keep as a tab. "Additive, not a replacement" is documented constraint. |
| **New external queue infrastructure** (Redis, BullMQ, pg-boss, SQS) | Vercel Workflow DevKit covers the need. Don't introduce new ops surface. |
| **Bypassing `koto_wp_commands`** for plugin calls | Every plugin call stays audit-logged. Workflow orchestrates above the queue; the queue logs each HTTP hit. |

---

## 4. Upstream Dependencies — What M1 Features Consume

For each M1 feature or cluster, the specific shipped file paths it wires into. The roadmapper should treat these as **wire, don't build**.

### 4.1 Engine → Publish Adapter (§1.2) consumes

| M1 feature | Consumes (file path) | What the shipped engine supplies |
|------------|---------------------|----------------------------------|
| 1.2.1 Brief-to-Elementor serializer | `src/lib/hyperlocalContentEngine.ts` | Rank-grid weak-point → neighborhood-cluster → landing-page brief with LocalBusiness schema. The content pipeline. |
| 1.2.1 Brief-to-Elementor serializer | `src/lib/semanticAgents.ts` + `semanticAgentsTier2.ts` + `semanticAgentsTier3.ts` | Query Gap Analyzer output, Frame Semantics, Semantic Role Labeler entities, Named Entity Suggester — populates heading + paragraph slots. |
| 1.2.1 Brief-to-Elementor serializer | `src/lib/autonomousPipeline.ts` | Orchestrates multi-engine runs so the serializer gets a pre-assembled bundle, not piecemeal engine calls. |
| 1.2.1 Brief-to-Elementor serializer | `src/lib/knowledgeGraphExporter.ts` | Entity graph → schema.org JSON-LD in the page footer slot. |
| 1.2.1 Brief-to-Elementor serializer | `src/lib/eeatEngine.ts` | E-E-A-T signals for byline / about / credentials slots. |
| 1.2.1 Brief-to-Elementor serializer | `src/lib/queryPathEngine.ts` | Query path output → FAQ slots + internal-link anchor text. |
| 1.2.1 Brief-to-Elementor serializer | `src/lib/internalLinkEngine.ts` | Internal-link targets for in-page anchor slots. |
| 1.2.2 Claude structured-output slot filler | `src/lib/multiAiBlender.ts` + `src/lib/dynamicPromptBuilder.ts` | Prompt assembly + multi-model blending for slot values; logs to `koto_token_usage` via existing path. |
| 1.2.5 Pre-flight gate | `src/lib/semanticAnalyzer.ts` | Thin-content detection + site N-gram overlap — uniqueness score across variants. |
| 1.2.5 Pre-flight gate | `src/lib/plagiarismEngine.ts` | Cross-variant + cross-web plagiarism check. |
| 1.2.6 Variant preview | `src/lib/topicalMapEngine.ts` | Topical-map context alongside variant preview to validate fit with campaign's topic cluster. |

### 4.2 Native Elementor Adapter (§1.1) consumes

| M1 feature | Consumes (file path) | What the shipped code supplies |
|------------|---------------------|-------------------------------|
| 1.1.1–1.1.4 Plugin read/write endpoints | `src/app/api/wp/route.ts` — `proxyToPlugin()` + `koto_wp_commands` pattern | Transport, auth (Bearer + license key headers `Authorization` / `X-KOTO-Key` / `X-Koto-API-Key`), audit queue INSERT-then-UPDATE, 30s `AbortSignal.timeout`, site connectivity tracking via `koto_wp_sites.last_ping`. New `/api/wp/builder/*` routes slot into this pattern — **extend `koto_wp_commands`, don't invent a new queue**. |
| 1.1.1–1.1.4 Plugin read/write endpoints | Existing `koto` WP plugin (PHP) | Bearer auth, `register_rest_route` scaffolding at `/wp-json/koto/v1/*`, license-key resolution. New `builder/*` endpoints are additive. |
| 1.1.7 Master template ingest | Existing `koto_wp_sites` (Supabase) | Site registry — which WP sites to list Elementor pages from. No change. |
| 1.1.9 Slot editor UI | Existing 43-wildcard pool + 11 module types in `src/views/PageBuilderPage.jsx` | Wildcard vocabulary (`{service}`, `{city}`, `{phone}`, ...) reused across HTML mode AND Elementor mode. Slot editor draws from this shared pool. |

### 4.3 Closed-Loop Attribution (§1.4) consumes

| M1 feature | Consumes (file path) | What the shipped code supplies |
|------------|---------------------|-------------------------------|
| 1.4.3 Per-page Telnyx number provisioning | `src/app/api/onboarding/telnyx-provision/route.ts` pattern | Proven Telnyx provisioning + Supabase write pattern. Symmetric: one number per page vs one per client. |
| 1.4.4 Inbound call → page attribution | Existing `koto_inbound_calls` table | Call arrival data. New `kotoiq_call_attribution` is a JOIN table, not a mutation on calls. |
| 1.4.4 Inbound call → page attribution | Existing Telnyx inbound webhook path (per `_knowledge/modules/answering-llm.md`) | Webhook arrival — M1 adds a post-webhook hook that calls `attributionLinker.match(call)`. |
| 1.4.7 Per-page KPI rollup | Existing `koto_wp_rankings` table | Rank data per-page per-keyword. |
| 1.4.7 Per-page KPI rollup | `src/lib/gscAuditEngine.ts` | Clicks + impressions per URL (already pulling from GSC). |
| 1.4.7 Per-page KPI rollup | Existing call-value logic in the answering module | Revenue estimation per call (industry-configurable). |
| 1.4.7 Per-page KPI rollup | `src/lib/visitorIntentScorer.ts` | Intent-score signal per call, augments attribution quality score. |

### 4.4 Feedback Loop (§1.5) consumes

| M1 feature | Consumes (file path) | What the shipped code supplies |
|------------|---------------------|-------------------------------|
| 1.5.1 Weekly rescan cron | `src/lib/contentRefreshEngine.ts` | Decay detection — takes URL + current metrics, returns refresh recommendation. Fully shipped. M1 wires the cron trigger and feeds published pages in. |
| 1.5.1 Weekly rescan cron | `src/lib/rankGridProEngine.ts` + `competitorWatchEngine.ts` | Rank deltas + competitor movement as decay signals. |
| 1.5.1 Weekly rescan cron | Existing Vercel Cron slots configured in `vercel.json` | Cron scheduling — add new handlers, don't invent new cron infra. |
| 1.5.2 Decay-triggered re-publish | `src/lib/autonomousPipeline.ts` | Same orchestrator that does initial generation handles refresh generation. Round-trip through same adapter. |
| 1.5.2 Decay-triggered re-publish | `src/lib/backlinkEngine.ts` + `backlinkOpportunityEngine.ts` | Decay-refresh pass may suggest new internal-anchor targets based on fresh backlink data. |

### 4.5 Publish Orchestration (§1.3) consumes

| M1 feature | Consumes | What the shipped code supplies |
|------------|---------|-------------------------------|
| 1.3.1 Vercel Workflow `publishCampaign` | Existing `koto_wp_commands` audit-queue pattern from `src/app/api/wp/route.ts` | Every Workflow step that calls the WP plugin goes through `proxyToPlugin()`, which logs to the queue. Workflow orchestrates; queue records. Load-bearing architectural decision. |
| 1.3.1 Vercel Workflow `publishCampaign` | Existing `koto_token_usage` logging in every Claude call path | Per-variant token usage logs with `feature='builder_slot_fill'`, matching proposal + discovery precedent. |

### 4.6 UI Consolidation (§1.6) consumes

| M1 feature | Consumes | What the shipped code supplies |
|------------|---------|-------------------------------|
| 1.6.1 Unified KotoIQ shell | `src/app/api/kotoiq/route.ts` + 35 existing `*Tab.jsx` components under `src/components/kotoiq/` | The entire Intel + existing KotoIQ surface. M1 does not rebuild any tabs; mounts them inside the new shell unchanged. |
| 1.6.1 Unified KotoIQ shell | `src/components/kotoiq/ConversationalBot.jsx` + `src/lib/askKotoIQEngine.ts` | Ask KotoIQ bot surfaces inside the shell as a permanent sidebar. No change. |
| 1.6.1 Unified KotoIQ shell | Existing `src/components/Sidebar.jsx` + `src/hooks/useAuth.jsx` | Navigation + agency-scoped auth. Standard. |
| 1.6.3 Campaign composer | `src/lib/scoutQueryParser.ts` + `src/lib/strategyEngine.ts` | Suggest seed rows from the client's strategy document. |
| 1.6.3 Campaign composer | `src/lib/rankGridProEngine.ts` | Suggest hyperlocal targets based on weak rank-grid cells. |
| 1.6.3 Campaign composer | `src/lib/industryBenchmarkEngine.ts` + `industryLLMEngine.ts` | Industry-appropriate slot constraints (tone, required entities, banned phrases). |

### 4.7 Foundations (§1.7) consumes

| M1 feature | Consumes | What the shipped code supplies |
|------------|---------|-------------------------------|
| 1.7.2 `getAgencyScopedSupabaseClient()` helper | Existing `src/lib/supabase.js` client factory + `resolveAgencyId()` in `src/lib/apiAuth.ts` | Same auth resolution pattern used by `src/app/api/wp/route.ts` and every existing route. |
| 1.7.4 New tables migration | Existing `koto_wp_sites` RLS policy shape | New tables' policies mirror this exactly. `agency_id` column + policy check. |

---

## 5. Feature-to-Feature Dependencies — Build Order

The roadmap has six phases in `.planning/research/ARCHITECTURE.md` §8. Below is the feature-level dependency DAG the roadmap should preserve.

```
   ┌── 1.7 Foundations (MUST land first)
   │    (1.7.1 audit → 1.7.2 helper → 1.7.3 ESLint → 1.7.4 migration → 1.7.5 extend koto_wp_pages)
   ▼
   ┌── 1.1 Native Elementor Adapter (Phase 1–3)
   │    1.1.1 detect ─┬─► 1.1.2 pages ─► 1.1.3 read ─► 1.1.5 schema registry
   │                  │                                │
   │                  │                                ▼
   │                  │                        1.1.6 drift detector
   │                  │                                │
   │                  └─► 1.1.7 ingest ─► 1.1.8 slot detector ─► 1.1.9 slot editor UI
   │                                                                  │
   │    1.1.4 writer (Document::save adapter) + 1.1.10 CSS regen ◄────┘
   ▼
   ┌── 1.2 Engine → Publish Adapter (Phase 3–4)
   │    1.2.1 serializer ─┬─► 1.2.3 splicer ─► 1.2.4 variant materialization
   │                      │                                │
   │                      └─► 1.2.2 Claude slot filler ────┤
   │                                                       │
   │    1.2.5 pre-flight gate (BLOCKS on hash/unique/schema) ◄─┤
   │                                                           ▼
   │    1.2.6 variant preview (renders as draft via 1.1.4)
   ▼
   ┌── 1.3 Durable Publish Orchestration (Phase 5)
   │    1.3.1 Workflow ─► 1.3.2 cadence ─► 1.3.3 idempotency ─► 1.3.4 queue dashboard ─► 1.3.5 /api/.../publish
   ▼
   ┌── 1.4 Closed-Loop Attribution (Phase 6 — parallel sub-tracks)
   │    6a: 1.4.5 IndexNow + 1.4.6 GSC ping  (independent)
   │    6b: 1.4.1 CrUX + 1.4.2 RUM + 1.4.7 KPI rollup + 1.4.8 page detail
   │    6c: 1.4.3 Telnyx per-page number + 1.4.4 attribution linker
   │    6d: 1.6 UI consolidation (depends on everything above)
   ▼
   ┌── 1.5 Feedback Loop (Phase 6, after 1.4.7 KPI rollup exists)
   │    1.5.1 rescan cron ─► 1.5.2 decay re-publish ─► 1.5.3 refresh history
   ▼
   1.8 Pilot — 20 pages on momentamktg.com (gated on everything)
```

### Critical dependencies (must not violate)

1. **1.1.4 writer depends on 1.1.5 schema registry.** Writing before we have a pinned schema = writing with hardcoded widget assumptions = breaks on every Elementor minor-version update. Registry + drift detector must land before the first write.

2. **1.2.5 pre-flight gate depends on 1.2.1 serializer + 1.2.4 variant materialization.** The gate validates rendered variants; can't run before variants exist. BUT: the gate MUST land before Phase 5 (batch publish). Publishing N variants without the gate is the scaled-content-abuse risk.

3. **1.3 durable orchestration depends on 1.2 being fully round-trippable.** Don't wrap a half-built adapter in Workflow — you'll spend retries debugging adapter bugs instead of orchestration bugs.

4. **1.4.3 Telnyx per-page number depends on 1.1.9 slot editor.** The `{phone}` slot must exist as a recognized wildcard before we can inject a number into it.

5. **1.4.7 per-page KPI rollup depends on 1.4.1 (CWV) + 1.4.4 (attribution) + 1.4.5 (IndexNow for index-state) + existing GSC sync + existing rank tracking.** Four of the five are shipped; two (CWV + attribution) are new. Rollup is a SQL view + API; trivial once the four data sources land.

6. **1.5 feedback loop depends on 1.4.7 rollup.** Decay detection needs per-page metrics; per-page metrics land in 1.4.7. Parallelize implementation against 1.4, but sequence the wiring.

7. **1.6.1 unified shell depends on every UI component landing.** It's the last thing to wire, not the first. Build subpages individually, then consolidate routing.

8. **1.7 foundations land BEFORE any Phase 2+ work.** Agency-isolation gaps, missed ESLint rules, missing helper are compound-interest bugs. Sweep first.

### What parallelizes cleanly

- Phase 6a (IndexNow) + 6b (CWV) + 6c (attribution) — independent sub-tracks; three engineers can work simultaneously.
- 1.5.1 rescan cron scaffolding can develop in parallel with Phase 6 as long as it doesn't require the 1.4.7 rollup to exist for scaffolding.
- UI components (1.6.2–1.6.4) can develop against mocked APIs in parallel with Phases 3–5.

---

## Complexity roll-up

| Complexity | Count | Features |
|-----------|-------|----------|
| **S** (small, < 1-2 days) | 18 | 1.1.1, 1.1.2, 1.1.3, 1.1.6, 1.1.10, 1.2.3, 1.2.4, 1.3.2, 1.3.3, 1.3.5, 1.4.1, 1.4.2, 1.4.4, 1.4.5, 1.4.6, 1.5.1, 1.5.3, 1.6.2, 1.6.4, 1.7.1, 1.7.5 |
| **M** (medium, 2-5 days) | 16 | 1.1.4, 1.1.5, 1.1.7, 1.1.8, 1.1.9, 1.2.2, 1.2.5, 1.2.6, 1.3.1, 1.3.4, 1.4.3, 1.4.7, 1.4.8, 1.5.2, 1.6.1, 1.6.3, 1.7.2, 1.7.3, 1.7.4, 1.8.1 |
| **L** (large, > 1 week) | **1** | 1.2.1 Brief-to-Elementor serializer |

**One L, ~16 Ms, ~18 Ss.** Most of the work is glue between shipped engines + adapter + new closed-loop wiring. The single L (the serializer) is the keystone: cadence, pre-flight, attribution, decay re-publish all depend on it. If schedule slips, it will slip there.

---

## Sources

**HIGH confidence (primary codebase + architecture doc):**

- `.planning/PROJECT.md` (local) — milestone scope, validated capabilities, constraints, key decisions.
- `.planning/research/STACK.md` (local) — net-new tech + integration points.
- `.planning/research/ARCHITECTURE.md` (local) — component inventory, data flow, build phases.
- `src/app/api/wp/route.ts` (local) — `proxyToPlugin` + `koto_wp_commands` pattern.

**MEDIUM confidence (competitive landscape, verified via targeted search):**

- [AirOps WordPress integration docs](https://docs.airops.com/building-workflows/workflow-steps/integrations/wordpress) — confirms REST-API publishing; no Elementor-native mention.
- [AirOps CMS integrations announcement (March 2026)](https://www.businesswire.com/news/home/20260303233493/en/AirOps-Brings-AI-Search-Optimization-Directly-Into-the-Enterprise-Content-Stack-with-New-Suite-of-CMS-and-Project-Management-Integrations) — WordPress, Contentful, Sanity, ContentStack, Ghost, Strapi listed; no Elementor.
- [SEOmatic WordPress integration](https://seomatic.ai/integrations/wordpress) — WP REST API only, theme-agnostic render.
- [CallRail Dynamic Number Insertion overview](https://support.callrail.com/hc/en-us/articles/5711814948877-Dynamic-number-insertion-overview) — confirms source-level DNI, not per-generated-page.
- [CallRail + Unbounce integration](https://unbounce.com/product/integrations/callrail/) — closest competitor pattern; manual landing page setup, not generator-integrated.
- [Elementor 4.0 atomic architecture launch](https://elementor.com/blog/editor-40-atomic-forms-pro-interactions/) — confirms April 2026 default rollout + atomic widget primitives (`e-heading`, `e-button`, etc.).

**LOW confidence (inferential — absence of evidence):**

- Claim "no product in 2026 combines native Elementor v4 write-back + per-page phone attribution + decay-refresh loop." Based on three targeted searches not surfacing a match. Cannot prove absence; confidence: MEDIUM on novelty.

---

*Features research for: KotoIQ M1 — Elementor Template-Clone Publisher + Closed-Loop Attribution (CORRECTED SCOPE)*
*Researched: 2026-04-17 — supersedes prior FEATURES.md which conflated shipped content-gen engines with M1 scope*
