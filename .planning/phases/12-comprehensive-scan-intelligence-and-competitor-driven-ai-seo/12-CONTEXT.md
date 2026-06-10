# Phase 12: Comprehensive scan intelligence + competitor-driven AI SEO/GEO/AEO strategy - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning
**Source:** User feature spec (conversation) + Phase 11 codebase knowledge (acts as PRD)

<domain>
## Phase Boundary

Upgrade the FRONT HALF of the Phase 11 guided `/kotoiq-wp` flow from "capture page
inventory + infer services" into a full intelligence + strategy engine. The initial
scan becomes a comprehensive extraction; the user curates everything; competitor
intel spans organic + AEO + GEO; and the semantic Koto tool produces a fast-rank
AI-SEO/GEO/AEO strategy.

**Heavy assembly over existing engines + a few new pieces. Not a rebuild.** Lands as
richer steps inside the existing Phase 11 guided spine (`ClientView` Guided tab).

**In scope (7 workstreams):**
1. Comprehensive four-category extraction (keywords / phrases / services / offerings)
2. Multi-category editable chips UI
3. Synergistic recommendations
4. Manual entry (all categories)
5. Competitor-intel aggregator (organic top 3-5 + AEO + GEO)
6. Extensive opportunity list
7. Semantic fast-rank strategy

**Out of scope:** plugin changes; new data providers; reskinning (the blazly look is a
separate effort); rebuilding any existing engine.
</domain>

<decisions>
## Implementation Decisions

### Surface
- Extends the Phase 11 guided spine inside `src/components/kotoiq-wp/ClientView.jsx`
  (Guided tab → `GuidedSpine.jsx` + `steps/`). Richer step 2 (site → comprehensive
  extraction), step 3 (competitors: organic+AEO+GEO), step 4 (gaps → extensive list),
  plus a NEW strategy step (semantic fast-rank plan).

### WS1 — Comprehensive extraction
- On the initial scan, run `discoverAllUrls` (full sitemap, not the 5-cap) +
  `pageContentExtractor` over ALL pages (reuse the 11-02 baseline capture path).
- ONE unified Claude pass (Haiku for cost; `logTokenUsage`) over the extracted page
  content → FOUR categories: `keywords`, `phrases`, `services`, `offerings`. Heuristic
  fallback per category when Claude is unavailable (extends `serviceInference`'s
  heuristic-first pattern and `voiceOnboardingAutoSetup` quick_scan keyword logic).
- Persist to `kotoiq_client_profile.fields` (same store `saveConfirmedServices` uses),
  one provenance-tagged record list per category (`{value, source_type, confidence,
  source_url, captured_at}`), so `scoreServiceCityGrid` and downstream read them.

### WS2 — Multi-category editable chips
- Generalize `ServiceChips.jsx` into a category-parameterized chips component used for
  all four categories. AI-inferred items visibly flagged (data-integrity). Select
  some/all, delete some/all. Reuse the 11-03 save path (extend `saveConfirmedServices`
  to a category-aware `saveConfirmedField(category, items)`).

### WS3 — Synergistic recommendations
- New Claude engine: input = confirmed services/offerings + industry/business context;
  output = complementary/synergistic services + products, as ACCEPT-able suggestion
  chips (distinct visual state from confirmed). Sonnet for quality (per model policy).
  `logTokenUsage`. Reuse `localStrategistEngine`'s business-context shaping.

### WS4 — Manual entry
- Every category's chips support adding a custom item (services / products / keywords /
  phrases). Manual items are `source_type: user_added` (confidence 1.0).

### WS5 — Competitor-intel aggregator
- For the chosen service×city set, a new aggregator gathers THREE lenses with provenance:
  - **Organic:** top 3-5 competitors via `analyze_competitors` / `dfs_compare` /
    `grid-scan` organic results (DataForSEO SERP).
  - **AEO:** `aeoVisibilityEngine` across ChatGPT / Claude / Gemini / Perplexity /
    Google AI Overviews (citation presence + share of voice).
  - **GEO:** `grid-scan` map-pack (local-pack ranks across the geo grid).
- Output = one unified competitor-intel set (per-competitor, per-lens) wrapped in
  `VerifiedDataSource` (source_url + fetched_at). Cities via Census (`geoLookup`).

### WS6 — Extensive opportunity list
- Feed the aggregated competitor keywords/pages into `content-gap` + `keyword-gap` +
  `pageGapEngine` (+ the WS5 intel) → an EXTENSIVE ranked keyword + page opportunity
  list (the build target). Reuse `scoreServiceCityGrid` bucketing where it fits.

### WS7 — Semantic fast-rank strategy
- New guided step. Run the "semantic Koto tool" (`semanticAgents` +
  `localStrategistEngine` + `planBuilderEngine` + `hubBuilder`) over confirmed inputs +
  competitor intel + opportunity list → a concrete strategy to rank the client's pages
  as FAST as possible across AI-SEO / GEO / AEO:
  topic clusters, pillar/hub architecture, internal-linking plan, AEO/GEO tactics
  (schema, llms.txt, FAQ/answer-first formatting, citation targets), prioritized build
  order. Sonnet for the strategy synthesis. Persist the plan (reuse `planBuilderEngine`
  PlanDraft / `kotoiq_page_suggestions`).

### Platform conventions (locked)
- **Data-integrity standard** (`_knowledge/data-integrity-standard.md`): competitors/
  ranks via live APIs, cities via Census, every fetched fact `VerifiedDataSource`
  (source_url + fetched_at); AI-generated flagged in UI.
- **Supabase migrations:** files applied MANUALLY (SQL editor) or via the Supabase
  Management API (`POST /v1/projects/{ref}/database/query` with `SUPABASE_ACCESS_TOKEN`)
  — never `supabase db push`.
- **`logTokenUsage`** on every Claude call. Haiku for cheap extraction, Sonnet for
  synergy + strategy quality.
- **Ship direct to `main`, no PRs.** Honor DESIGN.md (current navy/cream) unless/until a
  separate reskin lands.
- This Next.js differs from training data — read `node_modules/next/dist/docs/` before
  new framework patterns. Route files export only handlers (no helper exports — see the
  pre-existing `redeployCampaignCore` note; `next build` tolerates it but standalone tsc
  flags it).

### Runtime dependency (NOT a build blocker)
- The Claude-powered steps (WS1 extraction, WS3 synergy, WS5 AEO probes, WS7 strategy)
  require a FUNDED `ANTHROPIC_API_KEY`. As of 2026-06 both the Vercel prod key and a
  user-supplied key return `$0 credit balance`. Code builds + ships; these steps return
  empty (graceful heuristic fallback where defined) until a funded key is set. Surface a
  visible "AI unavailable" signal rather than silently swallowing the error in `catch {}`.

### Claude's Discretion
- Exact schema for any new persistence (prefer extending `kotoiq_client_profile.fields`
  and `kotoiq_page_suggestions` over new tables).
- Prompt design + token budgets for the unified extractor and synergy/strategy passes.
- How much of steps 2/3/4 to restructure vs add within the existing step components.
- The competitor-intel aggregator's shape (one new lib + one action vs per-lens).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 (the foundation this extends)
- `.planning/phases/11-kotoiq-wp-guided-onboarding-and-competitor-driven-gap-engine/` — CONTEXT/RESEARCH/PLANs/SUMMARYs
- `src/components/kotoiq-wp/ClientView.jsx` (Guided tab), `GuidedSpine.jsx`, `steps/*.jsx`
- `src/components/kotoiq/ServiceChips.jsx` (to generalize)
- `src/lib/kotoiq/serviceInference.ts` (`inferServices`, `saveConfirmedServices`, `kotoiq_client_profile.fields.services[]`)
- `src/lib/kotoiq/baselineSnapshot.ts` (`captureBaseline`, `discoverAllUrls`)
- `src/lib/builder/scoreServiceCityGrid.ts` + `pageGapEngine.ts`

### Engines to reuse (do not rebuild)
- `src/lib/kotoiq/pageDiscovery.ts` (`discoverPages`, `discoverAllUrls`), `pageContentExtractor.ts`
- `src/lib/voiceOnboardingAutoSetup.ts` (quick_scan keyword extraction)
- `src/lib/kotoiq/aeoVisibilityEngine.ts` (+ `aeoMentionParser`, `aeoPromptSeeder`)
- `src/lib/kotoiq/localStrategistEngine.ts`, `planBuilderEngine.ts`, `semanticAgents.ts`, `hubBuilder.ts`, `topicalMapEngine.ts`
- API actions in `src/app/api/kotoiq/route.ts`: `analyze_competitors`, `dfs_compare`, `run_all_audits`, `score_grid`, `infer_services`, `save_services`, `get_site_inventory`
- `src/app/api/seo/`: `content-gap`, `keyword-gap`, `grid-scan`
- `src/lib/geoLookup.ts` (Census), `src/lib/dataIntegrity.ts` (`createVerifiedData`)

### Standards (MANDATORY)
- `_knowledge/data-integrity-standard.md`, `DESIGN.md`, `CLAUDE.md`, `AGENTS.md`
</canonical_refs>

<specifics>
## Specific Ideas

- The user's framing, verbatim intent: "scan ALL webpages → comprehensive keyword/
  phrase/service/offering list → let me choose some/all or delete → recommend
  synergistic services/products → let me manually enter → competitor search top 3-5
  organic + AEO + GEO → extensive list from those results → run the semantic Koto tool
  to plan a strategy to rank the client's pages as FAST as possible in AI SEO/GEO/AEO."
- Blazly (blazly.ai) is the cited UX/feature peer (AI SEO/GEO platform) — its GEO card
  (ChatGPT/Gemini/Claude/Grok visibility bars) mirrors what the AEO lens should surface.
</specifics>

<deferred>
## Deferred Ideas

- Blazly-style visual reskin (light/violet/Inter) — separate design initiative, not this phase.
- Auto-remediation on poor AEO performance — future.
- Auto-publish without approval — keep the approval gate.
</deferred>

---

*Phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo*
*Context gathered: 2026-06-09 via conversation + Phase 11 codebase knowledge*
