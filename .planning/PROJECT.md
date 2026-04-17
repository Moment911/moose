# Koto

## What This Is

Koto is a full-stack marketing agency OS at hellokoto.com — a white-label platform that lets agencies (and their clients) run the entire client lifecycle from first voice interview through proposal, design review, and programmatic SEO publishing in one place. Built on Next.js 16 + React 19 + Supabase + Claude + Retell + Telnyx + Resend, deployed on Vercel. The current focus (KotoIQ) unifies the existing `/wordpress`, `/seo`, and `/kotoiq` surfaces into a single closed-loop SEO engine that doesn't just report rankings — it publishes pages, measures revenue, and auto-tunes over time.

## Core Value

Agencies run every layer of a client engagement — onboarding, discovery, proposals, design review, voice answering, and now **closed-loop programmatic SEO that attributes dollars to pages** — from a single platform without ever losing per-agency white-label isolation or data provenance.

## Requirements

### Validated

<!-- Shipped capabilities confirmed working in production at hellokoto.com. Derived from the existing codebase + _knowledge/ modules. -->

- ✓ Client onboarding form (26 adaptive fields, multi-recipient, autosave every 2s, 5-page completion PDF) — existing
- ✓ Voice onboarding via Retell "Koto Onboarding 2" agent with PIN verification and real-time answer sync — existing
- ✓ Per-client Retell number provisioning + release on completion — existing
- ✓ Discovery module (12-section docs, live transcription, AI Coach, section completion bars) — existing
- ✓ KotoProof design review (annotations on images/PDF/HTML/video, revision rounds, public review tokens) — existing
- ✓ AI proposal builder (3-pane, Claude Sonnet streaming) + public viewer at `/koto-proposal/:id` — existing
- ✓ Client management with health scores 0-100 (A-F grade) — existing
- ✓ Answering Service LLM framework (industry-siloed prompts, routing targets, Claude post-call analysis) — existing
- ✓ Telnyx SMS (preferred) + Twilio fallback, per-client Telnyx number management — existing
- ✓ WordPress plugin infrastructure (REST proxy, command queue, license keys, `koto_wp_sites` registry) — existing
- ✓ Token usage tracking (`koto_token_usage`) wired into every Claude API call — existing
- ✓ White-label foundation (custom domain, DNS verify, agency branding) — existing
- ✓ Platform hierarchy: Koto Admin → Agencies (Momenta) → Clients (Unified, RDC, Pangea) — existing
- ✓ Agency-scoped data isolation enforced on all client queries — existing
- ✓ VerifiedDataSource standard for all real-world data (source_url + fetched_at) — existing

**KotoIQ semantic + content generation layer (~7,700 lines shipped — already in production):**

- ✓ Scout query parser (search term → structured SEO query) — `src/lib/scoutQueryParser.ts`
- ✓ Strategy engine (turns client situation into SEO plan) — `src/lib/strategyEngine.ts`
- ✓ Semantic agents Tier 1 (Query Gap Analyzer, Frame Semantics, Semantic Role Labeler, Named Entity Suggester) — `src/lib/semanticAgents.ts`
- ✓ Semantic agents Tier 2 + Tier 3 — `src/lib/semanticAgentsTier2.ts`, `semanticAgentsTier3.ts`
- ✓ Semantic site analyzer (N-grams, headings, contextual flow, orphan contexts, thin-content detection) — `src/lib/semanticAnalyzer.ts`
- ✓ Semantic post-processors (output refinement) — `src/lib/semanticPostProcessors.ts`
- ✓ Hyperlocal content engine (rank-grid weak points → neighborhood clusters → auto-briefs + LocalBusiness schema) — `src/lib/hyperlocalContentEngine.ts`
- ✓ Topical map engine — `src/lib/topicalMapEngine.ts`
- ✓ E-E-A-T engine — `src/lib/eeatEngine.ts`
- ✓ Query path engine — `src/lib/queryPathEngine.ts`
- ✓ Knowledge graph exporter — `src/lib/knowledgeGraphExporter.ts`
- ✓ Content calendar engine — `src/lib/contentCalendarEngine.ts`
- ✓ Content refresh engine (decay detection + refresh) — `src/lib/contentRefreshEngine.ts`
- ✓ AI visibility engine (AI/LLM visibility tracking scaffold) — `src/lib/aiVisibilityEngine.ts`
- ✓ Plagiarism engine — `src/lib/plagiarismEngine.ts`
- ✓ Autonomous pipeline (orchestrates multi-engine runs) — `src/lib/autonomousPipeline.ts`
- ✓ Multi-AI blender (blends 3 AIs for output quality) — `src/lib/multiAiBlender.ts`
- ✓ Dynamic prompt builder — `src/lib/dynamicPromptBuilder.ts`
- ✓ Rank grid pro engine — `src/lib/rankGridProEngine.ts`
- ✓ Competitor watch engine — `src/lib/competitorWatchEngine.ts`
- ✓ Backlink + backlink opportunity engines — `src/lib/backlinkEngine.ts`, `backlinkOpportunityEngine.ts`
- ✓ Brand SERP engine — `src/lib/brandSerpEngine.ts`
- ✓ GSC audit engine, Bing audit engine, on-page engine — `src/lib/{gscAuditEngine,bingAuditEngine,onPageEngine}.ts`
- ✓ Internal link engine — `src/lib/internalLinkEngine.ts`
- ✓ GMB image engine — `src/lib/gmbImageEngine.ts`
- ✓ Visitor intent scorer — `src/lib/visitorIntentScorer.ts`
- ✓ Industry benchmark + industry LLM engines — `src/lib/{industryBenchmarkEngine,industryLLMEngine}.ts`
- ✓ KotoIQ unified API route (`/api/kotoiq`) with 35 tabs already wired — `src/app/api/kotoiq/route.ts`, `src/components/kotoiq/*Tab.jsx`
- ✓ Conversational Ask KotoIQ bot — `src/components/kotoiq/ConversationalBot.jsx`, `src/lib/askKotoIQEngine.ts`

### Active

<!-- Current milestone v1.0 scope: KotoIQ M1 — Elementor Template-Clone Publisher + Closed-Loop Attribution.

IMPORTANT: The semantic + content generation layer already exists and is shipped. M1 is NOT rebuilding that — M1 is the **adapter + closed-loop layer** that bridges existing engine output into native Elementor publishing and wires attribution. -->

**Milestone v1.0 — KotoIQ M1: Elementor Template-Clone Publisher + Closed-Loop Attribution**

*Goal: Wire the existing semantic/content engines into a native Elementor publish + rescan + attribute loop on momentamktg.com.*

**Native Elementor integration (new):**
- [ ] WP plugin read endpoints (detect builder version, list pages, get page `_elementor_data`, scan theme tokens)
- [ ] Koto-side API proxy for builder endpoints (extend `/api/wp` pattern)
- [ ] Elementor v4 atomic widget schema registry (built from live captured JSON from momentamktg.com, versioned per site)
- [ ] WP plugin write endpoint (invoke Elementor's own `Document::save()` via PHP adapter — do NOT write `_elementor_data` directly per research pitfall)
- [ ] Master template ingest (read one hand-designed Elementor page → store as master template in Supabase)
- [ ] Template slot detector (identify variable fields in master template)

**Engine → publish adapter (new — bridges existing engines):**
- [ ] Brief-to-Elementor-tree serializer — takes output from `hyperlocalContentEngine` / `semanticAgents` and produces valid Elementor v4 atomic-widget JSON per template slot map
- [ ] Template clone + slot-fill pipeline (N variants from 1 master template using existing engine briefs)
- [ ] Pre-flight gate (require unique local data + populated slots + valid schema before publish — anti-deindex defense)
- [ ] Durable publish orchestration via Vercel Workflow DevKit (batch publish, cadence, retries)
- [ ] Publish cadence controls (scheduled drip vs. burst, conservative default ~10/day)

**Closed-loop attribution + measurement (new):**
- [ ] Per-page Core Web Vitals monitoring (CrUX API + `web-vitals` RUM library, separate lab vs field data)
- [ ] IndexNow proactive submission on publish (Bing/Yandex/Naver/Seznam — Google Indexing API dropped per research: restricted to JobPosting/BroadcastEvent)
- [ ] GSC sitemap ping for Google indexing
- [ ] Telnyx per-page call attribution (per-page unique number for pilot ≤30 pages; DNI pool upgrade path)
- [ ] Per-page KPI rollup (rank + clicks + CWV + calls + revenue joined on `page_id`)

**Feedback loop (new — wires existing `contentRefreshEngine` to published pages):**
- [ ] Weekly rescan of published pages → feed results into existing `contentRefreshEngine.ts`
- [ ] Decay-triggered re-publish via same adapter (Claude proposes slot edits → operator approves → publish)

**UI consolidation + orchestration (new):**
- [ ] KotoIQ unified shell consolidating `/wordpress` + `/seo` + existing KotoIQ tabs into one command center
- [ ] Publish queue dashboard (pending / publishing / live / failed per campaign)
- [ ] Per-page detail view (KPIs, attribution, refresh history, "stop" and "unpublish" controls)

**Foundations (do first — research Phase 1):**
- [ ] Agency-isolation audit + `getAgencyScopedSupabaseClient()` helper + ESLint rule before any new table ships
- [ ] New tables: `kotoiq_templates`, `kotoiq_slot_maps`, `kotoiq_campaigns`, `kotoiq_published_pages`, `kotoiq_page_vitals`, `kotoiq_page_crux`, `kotoiq_indexnow_submissions`, `kotoiq_elementor_schema_versions`, `kotoiq_page_call_attribution` — all carry `agency_id` + `client_id`
- [ ] Idempotency keys on every plugin command and Workflow step

**Pilot:**
- [ ] 20 real hyperlocal landing pages published and live on momentamktg.com
- [ ] Each page generated from existing `hyperlocalContentEngine` output, published as native Elementor, indexed, attributed

### Out of Scope

<!-- Explicit boundaries. Prevents scope creep. -->

- **Drag-and-drop WYSIWYG editor inside Koto** — rebuilding Elementor's editor is ~year of scope for marginal value. Clients design the master template in Elementor admin (where it's already perfect); Koto clones + fills.
- **Avada / Fusion Builder adapter** — deferred to a later milestone. One adapter at a time; Elementor first.
- **Full AI Overview / LLM citation tracking engine** — deferred to M4 (Intel command center). M1 tracks rank + calls only.
- **Rank Math clone (KotoSEO Engine)** — deferred to M3. Strategic moat but a dependency for quality at scale, not M1.
- **Watermark Remover** — legal gray area; removed from roadmap entirely.
- **Plagiarism Check as in-house build** — delegate to Copyscape API if needed.
- **Upwork Tool** — unclear SEO value; defer or cut.
- **Brand SERP as standalone tool** — fold into AI Overview tracking in M4.
- **WYSIWYG that renders with client's theme CSS inside Koto** — template stays in client's real WP admin.

## Context

**Existing codebase is mature.** Koto has been built iteratively across dozens of features documented in `_knowledge/modules/` (onboarding, voice-onboarding, discovery, kotoproof, proposals, clients, answering-llm). The WordPress plugin + REST proxy layer is production-shipped (`src/app/api/wp/route.ts`, `moose_wp_sites` + `koto_wp_commands` tables, the `koto` WP plugin installed on client sites). `PageBuilderPage.jsx` (~1100 lines) already generates templated HTML using 43 wildcards and 11 module types — this existing UI becomes the shell for the template slot editor, not a replacement.

**Elementor v4.0.2 on the pilot.** Momentamktg.com runs Elementor + Elementor Pro 4.0.2, the brand-new atomic-widget architecture (`e-heading`, `e-button`, `e-div-block`, `e-flexbox`, CSS-class design system). LLM training data on v4 is thin — adapters must be built against live captured JSON, not documentation.

**Three stacked loops drive the product vision:**
1. Intel loop — ingest GSC/GBP/keywords/competitors/backlinks → ranked page backlog (**mostly shipped**: rank grid pro, competitor watch, backlinks, GSC/Bing audit, brand SERP, AI visibility engines all exist)
2. Publish loop — fingerprint site → generate theme-matching pages → schedule + push (**partially shipped**: content generation engines exist — hyperlocal, semantic tiers 1-3, topical map, E-E-A-T, query path. **Missing**: native builder write-back, durable publish orchestration, cadence)
3. Tune loop — rescan → decay detection → Claude auto-refresh → re-publish (**partially shipped**: `contentRefreshEngine.ts` exists. **Missing**: scheduled rescan of published pages, attribution feedback loop, auto re-publish via same adapter)

**M1's actual contribution is the adapter layer that wires existing engines into native Elementor publishing + closed-loop attribution.** The heavy-lifting content generation is already done (~7,700 lines shipped). M1 ships the bridge: engine output → Elementor v4 atomic-widget JSON → WP plugin write → IndexNow → CWV + call attribution → decay rescan. M2 wires the tune loop more deeply. M3 delivers KotoSEO Engine. M4 expands intel (AI Overview citation tracking is the big new piece). M5 ships moat features.

**Google scaled-content-abuse policy is a product constraint.** Mass-publishing similar pages = deindex risk. Every generated page must carry unique local data, substantive content, real images, and perfect schema — defused by construction (not post-hoc audit).

## Constraints

- **Tech stack**: Next.js 16.2.2 App Router + React 19 + Supabase (pgvector-ready) + Claude API + Vercel Functions. No new frameworks; extend the existing stack.
- **Builder target**: Elementor + Elementor Pro 4.0.2 atomic widgets only for M1. Adapter versioned; v4 JSON shape pinned.
- **AI model usage**: Claude Sonnet 4.6 for generation; Haiku 4.5 for classification/extraction. Every call logs to `koto_token_usage` with feature tag.
- **Data integrity**: All real-world data wrapped in `VerifiedDataSource` (source_url + fetched_at) per platform standard. No hardcoded facts as ground truth.
- **Agency isolation**: All client data scoped to logged-in agency. Always require auth.
- **Security**: Bearer token + license-key pattern on WP plugin endpoints. No destructive plugin operations without explicit command queue entry.
- **Compatibility**: Must not break existing `PageBuilderPage.jsx` HTML/wildcard mode — the native builder path is additive, not a replacement.
- **Platform hierarchy**: Koto Admin → Agencies (Momenta) → Clients (Unified, RDC, Pangea). Never rename these tiers.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Template-clone architecture, not in-Koto drag-drop WYSIWYG | Rebuilding Elementor's editor = year of scope for marginal value. Clone + slot-fill ships in weeks with 90% of the business value. | — Pending |
| Pilot on momentamktg.com first, not a client site | Safe blast radius; Adam's own agency site. Break-fix freely before touching a paying client. | — Pending |
| Elementor v4 before Avada/Fusion | Atomic widget architecture is schema-friendlier; JSON structure is cleaner; one adapter proven before the second. | — Pending |
| Build adapters from live captured JSON, not documentation | v4 training data is thin and docs lag the platform. Live JSON from the pilot is ground truth. | — Pending |
| CWV + IndexNow + Telnyx attribution baked in from M1 (not deferred) | These are table stakes for "closed loop" — deferring them makes M1 a ship-and-forget tool, which is exactly what we're differentiating against. | — Pending |
| Rank Math clone (KotoSEO Engine) is M3, not M1 | Strategic moat but a dependency for quality at scale. M1 must prove template-clone works first; without that, KotoSEO has nothing to gate on. | — Pending |
| Drop: Watermark Remover, standalone Plagiarism builder, Upwork Tool, standalone Brand SERP | None directly drive the closed-loop thesis. Cutting prevents scope drift. | — Pending |
| M1 is the adapter + closed-loop layer, NOT rebuilding content generation | ~7,700 lines of semantic/content engines already ship in production (`semanticAgents`, `hyperlocalContentEngine`, `autonomousPipeline`, etc.). Re-implementing them would be wasted work. M1 only builds what doesn't exist: native Elementor write, publish orchestration, IndexNow, CWV, per-page attribution, rescan loop, unified shell. | — Pending |
| Do NOT write `_elementor_data` postmeta directly — invoke Elementor's own `Document::save()` via PHP adapter | Research surfaced GitHub #32632/#33000/#35397 atomic-widget save bugs in v4 when bypassing the official save path. Direct writes cause CSS regen + revision + version-pinning issues. Safer to call into Elementor's save API from inside the WP plugin. | — Pending |
| Drop Google Indexing API; use IndexNow + GSC sitemap ping only | Google's Indexing API is officially restricted to JobPosting + BroadcastEvent schemas and carries a spam warning for misuse. Using it for Service / LocalBusiness pages risks account revocation. IndexNow covers Bing/Yandex/Naver/Seznam; Google gets sitemap + GSC deep-link signals. | — Pending |
| Use Vercel Workflow DevKit for durable publish orchestration | GA'd early 2026. Durable sleep + deterministic replay fit the publish → wait → CWV read → decay rescan loop exactly. `koto_wp_commands` queue stays as plugin-call audit log (unchanged — 131 routes depend on it); Workflow sits above it for multi-step orchestration. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 after initialization — corrected scope to reflect ~7,700 lines of shipped semantic/content engines; M1 re-framed as adapter + closed-loop layer, not content-generation rebuild*
