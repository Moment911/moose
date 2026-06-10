# Phase 12: Comprehensive scan intelligence + competitor-driven AI SEO/GEO/AEO strategy — Research

**Researched:** 2026-06-10
**Domain:** Next.js 16 / React 19 dashboard assembly over existing KotoIQ SEO/GEO/AEO + strategy engines + Supabase + Claude (Haiku/Sonnet)
**Confidence:** HIGH — every claim below verified by reading source at named file:line. No external library claims needed.

---

<user_constraints>
## User Constraints (from 12-CONTEXT.md)

### Locked Decisions
- **Surface:** Extends the Phase 11 guided spine inside `src/components/kotoiq-wp/ClientView.jsx` (Guided tab → `GuidedSpine.jsx` + `steps/`). Richer step 2 (comprehensive extraction), step 3 (organic+AEO+GEO), step 4 (extensive list), plus a NEW strategy step.
- **WS1:** On initial scan, run `discoverAllUrls` (full sitemap, not the 5-cap) + `pageContentExtractor` over ALL pages (reuse 11-02 baseline path). ONE unified Claude pass (**Haiku** for cost; `logTokenUsage`) → FOUR categories: `keywords`, `phrases`, `services`, `offerings`. Heuristic fallback per category when Claude unavailable (extends `serviceInference` heuristic-first + `voiceOnboardingAutoSetup` quick_scan). Persist to `kotoiq_client_profile.fields`, one provenance-tagged record list per category (`{value, source_type, confidence, source_url, captured_at}`), so `scoreServiceCityGrid` + downstream read them.
- **WS2:** Generalize `ServiceChips.jsx` into a category-parameterized chips component for all four categories. AI-inferred items visibly flagged. Select some/all, delete some/all. Reuse the 11-03 save path (extend `saveConfirmedServices` → category-aware `saveConfirmedField(category, items)`).
- **WS3:** New Claude engine: input = confirmed services/offerings + industry/business context; output = complementary/synergistic services + products as ACCEPT-able suggestion chips (distinct visual state from confirmed). **Sonnet** for quality. `logTokenUsage`. Reuse `localStrategistEngine`'s business-context shaping.
- **WS4:** Every category's chips support adding a custom item. Manual items are `source_type: user_added` (confidence 1.0).
- **WS5:** New aggregator gathers THREE lenses with provenance for the chosen service×city set: **Organic** (top 3-5 via `analyze_competitors`/`dfs_compare`/`grid-scan` organic), **AEO** (`aeoVisibilityEngine` across ChatGPT/Claude/Gemini/Perplexity/Google AIO — citation presence + share of voice), **GEO** (`grid-scan` map-pack). Output = one unified competitor-intel set (per-competitor × per-lens) wrapped in `VerifiedDataSource` (source_url + fetched_at). Cities via Census (`geoLookup`).
- **WS6:** Feed aggregated competitor keywords/pages into `content-gap` + `keyword-gap` + `pageGapEngine` (+ WS5 intel) → an EXTENSIVE ranked keyword + page opportunity list. Reuse `scoreServiceCityGrid` bucketing where it fits.
- **WS7:** New guided step. Run the semantic Koto tool (`semanticAgents` + `localStrategistEngine` + `planBuilderEngine` + `hubBuilder`) over confirmed inputs + competitor intel + opportunity list → a fast-rank strategy across AI-SEO/GEO/AEO: topic clusters, pillar/hub, internal-linking, AEO/GEO tactics (schema, llms.txt, FAQ/answer-first, citation targets), prioritized build order. **Sonnet** for synthesis. Persist via `planBuilderEngine` PlanDraft / `kotoiq_page_suggestions`.

### Platform conventions (locked)
- **Data-integrity standard** (`_knowledge/data-integrity-standard.md`): competitors/ranks via live APIs, cities via Census, every fetched fact `VerifiedDataSource` (source_url + fetched_at); AI-generated flagged in UI.
- **Supabase migrations:** files applied MANUALLY (SQL editor) or via the Management API (`POST /v1/projects/{ref}/database/query`) — never `supabase db push`.
- **`logTokenUsage`** on every Claude call. Haiku for cheap extraction; Sonnet for synergy + strategy.
- **Ship direct to `main`, no PRs.** Honor DESIGN.md (navy/cream) unless a separate reskin lands.
- Next.js differs from training data — read `node_modules/next/dist/docs/` before new framework patterns. Route files export ONLY handlers (no helper exports).

### Runtime dependency (NOT a build blocker)
- Claude steps (WS1 extraction, WS3 synergy, WS5 AEO probes, WS7 strategy) require a FUNDED `ANTHROPIC_API_KEY`. As of 2026-06 both the Vercel prod key and a user-supplied key return `$0 credit balance`. Code builds + ships; these steps return empty (graceful heuristic fallback where defined) until a funded key is set. **Surface a visible "AI unavailable" signal rather than swallowing in `catch {}`.**

### Claude's Discretion
- Exact schema for new persistence (prefer extending `kotoiq_client_profile.fields` + `kotoiq_page_suggestions` over new tables).
- Prompt design + token budgets for the unified extractor and synergy/strategy passes.
- How much of steps 2/3/4 to restructure vs add within existing step components.
- The competitor-intel aggregator's shape (one new lib + one action vs per-lens).

### Deferred Ideas (OUT OF SCOPE)
- Blazly-style reskin (light/violet/Inter). Auto-remediation on poor AEO. Auto-publish without approval (keep the gate). Plugin changes; new data providers; rebuilding any existing engine.
</user_constraints>

---

## Summary

Phase 12 is **assembly over a now-mature stack** — and more of it already exists than the CONTEXT assumes. **Phase 11 plan 11-06 (the guided spine) shipped to disk** (`GuidedSpine.jsx` + 7 step files exist, dated 2026-06-08; only the SUMMARY file is missing). So the "extend the guided spine" surface is real and present, not theoretical. Every engine the CONTEXT names was read this session and is reusable as-is. The genuinely NEW code is small: a unified four-category extractor (WS1, extends `serviceInference`'s exact heuristic-first→Haiku pattern), a synergy engine (WS3, mirrors `localStrategistEngine`'s Sonnet+JSON shape), a competitor-intel aggregator (WS5, the only real new IO orchestration), and the assembled UI wiring.

Three correctness anchors for the planner:

1. **WS1 persistence is already half-built.** `saveConfirmedServices` (`serviceInference.ts:353`) already writes `kotoiq_client_profile.fields.services[]` as `{value, source_type, confidence, source_url, captured_at}` — the EXACT shape the four-category spec wants. The smallest correct change is to generalize this single function to `saveConfirmedField(category, items)` writing `fields[category]` and to produce all four category lists from one Haiku pass. `score_grid` (`route.ts:6290`) **already reads `kotoiq_client_profile.fields.services[]` first** and falls back to the clients table — so persisting the four categories there means downstream is already wired for `services`; `keywords`/`phrases`/`offerings` are new reads.

2. **WS3/WS7 Claude engines THROW on a missing key today — this is the "visible AI-unavailable" gap to fix.** `localStrategistEngine.ts:188` and `planBuilderEngine.ts:196` both do `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })` (non-null assertion) → the call throws when the key is unfunded/absent. `serviceInference.ts:216` is the GOOD pattern (`if (!process.env.ANTHROPIC_API_KEY) return {services:[], ok:false}` → graceful). New WS3/WS7 engines must copy the `serviceInference` graceful-degrade pattern and surface an explicit "AI unavailable" status to the UI, never a silent `catch {}`.

3. **WS5 is the only substantial new orchestration.** The three lenses each have a working engine but DIFFERENT identity models: organic competitors are URL/domain rows (`analyze_competitors` SERP `rank_group`), GEO is a business-name rank grid (`grid-scan` `target_business`), AEO is brand rows in `kotoiq_aeo_competitors` (client_id-scoped, requires seeding + a paid 5-engine scan). Unifying "per-competitor × {organic, aeo, geo}" requires a name/domain reconciliation step the aggregator must own. Recommend ONE new lib (`competitorIntel.ts`) + ONE action (`competitor_intel`), each lens wrapped in `createVerifiedData`.

**Primary recommendation:** Build as **6 plans** — (1) unified four-category extractor + `saveConfirmedField` generalization; (2) multi-category `CategoryChips` (generalize `ServiceChips`) + manual entry (WS2+WS4 together); (3) synergy engine + accept-able suggestion chips (WS3); (4) competitor-intel aggregator across 3 lenses (WS5); (5) extensive opportunity list glue (WS6); (6) semantic fast-rank strategy engine + new guided strategy step + steps 2/3/4 enrichment (WS7 + UI). Sequence: 1→2 (2 needs 1's persistence); 3 after 2; 4 independent (can parallelize); 5 needs 4; 6 needs 1+4+5.

---

## Standard Stack

**No new libraries.** Everything is in `package.json` already. Relevant existing deps:

| Library | Purpose | Notes |
|---------|---------|-------|
| Next.js 16 / React 19 | App-router API routes + client components | AGENTS.md: read `node_modules/next/dist/docs/` before new framework patterns; route files export only handlers |
| `@anthropic-ai/sdk` | Claude (extraction Haiku, synergy/strategy Sonnet) | `logTokenUsage` mandatory |
| `@supabase/supabase-js` | DB; `getKotoIQDb(agencyId)` agency-scoped helper | `kotoiq_client_profile` IS in `DIRECT_AGENCY_TABLES` (auto-scoped) |
| `cheerio` | HTML parse in `pageContentExtractor` | already used |
| `lucide-react` | icons | Facebook/Instagram/Youtube NOT exported — alias to Globe/Camera/Play (MEMORY) |

**Pinned model ids (verified via grep across `src/lib` — counts are call sites):**
- `claude-sonnet-4-6` (110), `claude-sonnet-4-6-20250627` (4) — strategist/plan-builder/quality. **Use for WS3 synergy + WS7 strategy** `[VERIFIED: grep src/lib]`
- `claude-haiku-4-5-20251001` (25), `claude-haiku-4-5` (3) — cheap classification. **Use for WS1 extraction** `[VERIFIED: serviceInference.ts:34]`

`content-gap`/`keyword-gap` routes call Claude via raw `fetch` with bare `model:'claude-sonnet-4-6'` and `anthropic-version:'2023-06-01'` (`content-gap/route.ts:89`, `keyword-gap/route.ts:161`) — note these do NOT call `logTokenUsage` and have their own key-missing throw. WS6 should be cautious reusing them as-is (see WS6).

---

## Workstream-by-Workstream

### WS1 — Comprehensive four-category extraction

**Reused (no rebuild):**
- `discoverAllUrls(domain)` — `pageDiscovery.ts:111` — full deduped same-domain sitemap list (asset-filtered, 500-URL sanity cap, homepage first). Already exported (added in 11-02). Returns `{ urls: string[], sitemap_url?, error? }`.
- `fetchAndExtract(url)` — `pageContentExtractor.ts:62` → `ExtractedPage`. Available content per page: `h1`, `h2_list[]` (up to 20), `cta_list[]`, `hero_copy` (≤500c), `body_text` (≤50,000c), `meta_title`, `meta_description`, `schema_orgs[]`, `word_count`, `content_hash`. This is RICH enough to drive a four-category extraction; the current `serviceInference` only feeds Claude `path + h1 + meta_title` (`serviceInference.ts:181-196`) — the extractor should feed `h1 + h2_list + meta_description + hero_copy` for keywords/phrases/offerings.
- `kotoiq_site_baseline` table (11-02) — the latest dated capture of the client's own pages. `infer_services` (`route.ts:6793`) already loads the latest-`captured_at` batch (`url, h1, title, page_type, word_count`). **The same loader feeds the four-category extractor.** NOTE: baseline columns don't include `h2_list`/`hero_copy`/`meta_description` — so the unified extractor either (a) re-`fetchAndExtract`s the latest baseline URLs for richer signal, or (b) works from the stored `h1`/`title` only. Recommend (a) on first run to get keyword/phrase quality; cite token budget concern below.
- Heuristic fallbacks per category:
  - **services** — `servicesFromHeuristic(pages)` (`serviceInference.ts:132`, pure, `/services/{slug}` + H1 → normalized dedup-sorted).
  - **keywords** — `voiceOnboardingAutoSetup.ts` quick_scan keyword logic (633 LOC; `trigger_auto_setup` action @`route.ts:4711` per 11-RESEARCH). Reuse its keyword-extraction heuristic for the keyword category fallback.
  - **phrases/offerings** — no existing heuristic; derive from `h2_list`/`hero_copy` n-grams when Claude is unavailable (new, small, pure).

**Smallest correct change (NEW lib `comprehensiveExtractor.ts`):**
- ONE Haiku pass returning strict JSON `{keywords[], phrases[], services[], offerings[]}` over the latest baseline pages' signals. Mirror `serviceInference.inferViaClaude` exactly: `HAIKU_MODEL = 'claude-haiku-4-5-20251001'`, `AbortController` 20s timeout, `safeParse`, `logTokenUsage({feature:'kotoiq_comprehensive_extraction', model:HAIKU_MODEL, agencyId, metadata:{client_id, pages}})`, graceful `{ok:false}` when `!process.env.ANTHROPIC_API_KEY` (NOT the `!`-assertion throw).
- Each item wrapped `{value, source_type:'ai_inferred', confidence, source_url, captured_at}` — the exact `StoredServiceRecord` shape (`serviceInference.ts:328`).

**Persistence (Claude's discretion → recommended):** Generalize `saveConfirmedServices` (`serviceInference.ts:353`) to `saveConfirmedField({agencyId, clientId, category, items})` writing `fields[category]` (where `category ∈ {keywords, phrases, services, offerings}`) via `db.clientProfile.upsert({client_id, fields})` — the helper auto-injects `agency_id` and `onConflict:'agency_id,client_id'` (`kotoiqDb.ts:377`). Keep `saveConfirmedServices` as a thin `category='services'` wrapper for back-compat with the existing `save_services` action and `score_grid` reader. **This avoids any new table** (CONTEXT preference). Confirm: `score_grid` reads `fields.services[]` at `route.ts:6290-6294` — unchanged for `services`.

**Routes/actions:** add `extract_comprehensive` (loads latest baseline → calls `comprehensiveExtractor` → returns 4 flagged lists, does NOT auto-confirm, mirroring `infer_services` @`route.ts:6784`) and generalize `save_services` → `save_field` accepting `{category, items}`. Both ride the existing AUTH gate; append to the if-chain (no `ALLOWED_ACTIONS` constant exists — confirmed 11-05 SUMMARY).

**Reused vs NEW:** discovery/extract/baseline-loader/persistence-helper = REUSED (one generalization). Four-category Haiku prompt + per-category heuristic fallbacks for phrases/offerings = NEW (small, pure).

---

### WS2 — Multi-category editable chips + WS4 manual entry

**Reused:** `ServiceChips.jsx` (read in full, 268 lines). It already implements: on-mount `infer_services` fetch → seed chips; `ai_inferred` chip with AI badge (`AiBadge`, info/violet, `ServiceChips.jsx:34`); remove chip; add chip (`user_added`, confidence 1.0 — this IS WS4 manual entry already, `ServiceChips.jsx:129-138`); single "Confirm" CTA → `save_services` with provenance (`user_added` / `user_confirmed` / `ai_inferred`, `ServiceChips.jsx:145-154`). Built entirely on DESIGN.md koto/* primitives (`SectionHeader`, `EducationalNote`, `ActionCallout`, `CtaButton`, `FlagChip`, `Skeleton`, `KotoKeyframes`).

**Smallest correct change (NEW `CategoryChips.jsx`, generalize `ServiceChips`):**
- Add props: `category` (`'keywords'|'phrases'|'services'|'offerings'`), `inferAction` (default `extract_comprehensive`), `saveAction` (default `save_field`), plus per-category `title`/`subtitle`/`icon`/`placeholder`. The fetch sends `{action: inferAction, ...}` and reads `d[category]` (the extractor returns all four; one fetch can hydrate four chip groups, OR pass the pre-fetched list down as a prop to avoid 4 round-trips).
- Save sends `{action:'save_field', category, items}`. Provenance logic is unchanged (`user_added` / `user_confirmed` / `ai_inferred`).
- WS4 manual entry already exists in the add-chip path; manual item = `user_added`, confidence 1.0 — matches CONTEXT exactly. No new work beyond carrying it into the generalized component.
- Keep `ServiceChips` as a `<CategoryChips category="services" .../>` wrapper so `StepGaps.jsx:100` (which renders `<ServiceChips/>`) keeps working untouched. (Or update `StepGaps` to render four `CategoryChips`.)

**Reused vs NEW:** chip rendering / provenance / save flow = REUSED. Category parameterization + a 4-group layout = NEW (thin). DESIGN.md primitives already correct.

---

### WS3 — Synergistic recommendations

**Reused (business-context shaping):** `localStrategistEngine.recommendLocalStrategy(s, body)` (`localStrategistEngine.ts:178`) shows the canonical shape to mirror: `LocalStrategyInput { client_id, agency_id, business_name, business_model, services[], areas[], brand_voice?, existing_pages?, notes? }`, Sonnet `claude-sonnet-4-6-20250627`, strict-JSON output with `try/catch` parse + fence-strip, `logTokenUsage({feature:'kotoiq_local_strategist', model:'claude-sonnet-4-6'})`, cost math ($3 in/$15 out per 1M). The business-context fields to reuse: `business_name`, `business_model`, `industry`. Pull industry/business_name from `clients` (via `pick()` across dedicated cols + `onboarding_answers`) or `kotoiq_client_profile`.

**Smallest correct change (NEW `synergyEngine.ts` + `recommend_synergies` action):**
- Input: confirmed `services` + `offerings` (read from `kotoiq_client_profile.fields` — what WS1 persisted) + `industry`/`business_name`. Output: complementary/synergistic services + products as strict JSON `{synergistic_services[], complementary_products[]}`, each item a short noun phrase + a one-line rationale.
- **Sonnet** (`claude-sonnet-4-6-20250627`), `logTokenUsage({feature:'kotoiq_synergy_recommendations', model:'claude-sonnet-4-6', agencyId})`.
- **CRITICAL graceful-degrade:** do NOT copy `localStrategistEngine.ts:188`'s `ANTHROPIC_API_KEY!` throw. Copy `serviceInference.ts:216` (`if (!process.env.ANTHROPIC_API_KEY) return {ok:false, ...}`) and return an explicit `{ok:false, reason:'ai_unavailable'}` so the UI shows a visible "AI unavailable" banner.
- UI: suggestion chips in a DISTINCT visual state from confirmed (CONTEXT). Use a new FlagChip variant or the `tip`/violet styling; an "Accept" button promotes a suggestion → writes it into the relevant category's `fields[]` as `user_added`/`user_confirmed` via `save_field` (reuse WS2 path). Suggestions are NOT auto-persisted until accepted.

**Reused vs NEW:** Sonnet+JSON+logging+cost pattern = REUSED (copy localStrategist shape). The prompt, the accept-to-promote chip UX, and the graceful-degrade fix = NEW.

---

### WS5 — Competitor-intel aggregator (organic + AEO + GEO)

This is the largest new piece. Each lens has a working engine but a different identity model:

**Lens A — ORGANIC** (`analyze_competitors` @`route.ts:1401`):
- Input modes: `{keyword}` OR `{urls:[...]}` OR `{market:{service, city, state}}` (builds `"{service} {city} {state}"`, `route.ts:1408-1414`).
- Pulls DataForSEO SERP via `getSERPResults(keyword)` → top 15 `{url, domain, title, rank: rank_group}` (`route.ts:1446-1448`). Analyzes top 10 competitor pages + client page; optional Moz DA/PA. **Authoritative organic rank = `rank_group`.** Returns per-URL analyses + AI gap analysis.
- `dfs_compare` @`route.ts:5259` → `getDomainIntersection(domain1, domain2, location='United States', limit=100)` (`dataforseo.ts:505`) — keyword intersection/gaps between two domains. Use for "what competitor X ranks for that we don't" once a top organic competitor domain is known.

**Lens B — GEO** (`grid-scan` `/api/seo/grid-scan/route.ts`):
- Input `{keyword, location, target_business, grid_size(≤7), spacing_km, search_radius_km}`. Geocodes `location` → generates an N×N grid → Google Places `searchNearby` at each point → finds `target_business` rank per cell. Returns `grid_results[]` (per-cell `{lat,lng,row,col,rank,total,top3[]}`) + `summary{avg_rank, best_rank, coverage_pct, ...}`. **Map-pack rank is per-BUSINESS-NAME**, and `top3[]` per cell names the local-pack winners (this is the competitor signal for GEO).
- Cost: each cell is a Places call (`trackPlatformCost`); a 5×5 = 25 cells per keyword per business. **Spend concern** for many service×city combos (see Risks).

**Lens C — AEO** (`aeoVisibilityEngine.ts`):
- `setupClientForAEO(s, {client_id, agency_id?, seed_prompts=true, seed_self_competitor=true})` (`aeoVisibilityEngine.ts:35`) — seeds the client's own brand as `is_self` into `kotoiq_aeo_competitors` and seeds ~40 prompts into `kotoiq_aeo_prompts` (via `seedPromptsForClient`). **Must run before any scan.**
- `runAEOVisibilityScan(s, {client_id, agency_id?, engines?, prompt_limit?})` (`aeoVisibilityEngine.ts:117`) — runs active prompts × 5 engines (ChatGPT/Claude/Gemini/Perplexity/Google AIO, `ALL_ENGINES` @:29), parses mentions, persists to `kotoiq_aeo_runs`. ~120s for 40 prompts (under the 300s cap). **Costs real money per engine call** + parser calls.
- Read APIs for per-engine SoV/citations: `getCompetitorCompare(s, {client_id, days})` → per-brand `{brand, is_self, mentions, share, avg_position}` (`:431`); `getCitedSources(s, {client_id, days, limit})` → cited URLs (`:396`); `getPromptMatrix` → engine×prompt presence (`:344`); `getOverviewStats` → 4 KPI cards (`:484`).
- **Competitors must be seeded first.** `kotoiq_aeo_competitors` (migration `20260608_kotoiq_aeo_visibility.sql`) is `client_id`-scoped (NO `agency_id` column), `UNIQUE(client_id, brand_name)`, has `is_self`, `aliases[]`, `domain`. Existing actions: `aeo_add_competitor` (`route.ts:4306`), `aeo_list_competitors` (:4294). **To get competitor AEO share-of-voice you must add the organic/GEO competitors into `kotoiq_aeo_competitors` before running the scan** — i.e. Lens A/B feed Lens C's brand list.

**Proposed aggregator shape (Claude's discretion → recommended): ONE lib `competitorIntel.ts` + ONE action `competitor_intel`.**
- Input: `{agency_id, client_id, services[], cities[], state}` (cities Census-validated via `geoLookup` / `selectCitiesToCheck`).
- Flow: for the chosen service×city set —
  1. **Organic:** call `analyze_competitors` `market` mode per representative service×city → collect top 3-5 `{name, domain, rank_group}`.
  2. **GEO:** call `grid-scan` per service×city (or a representative subset to control spend) → collect local-pack `top3[]` + the client's `avg_rank`.
  3. **Reconcile identities:** union organic domains + GEO business names into a competitor roster; upsert each into `kotoiq_aeo_competitors` (`aeo_add_competitor`); ensure self is seeded (`setupClientForAEO` once).
  4. **AEO:** ensure prompts seeded; `runAEOVisibilityScan`; read `getCompetitorCompare` → per-brand `{share, avg_position}`.
  5. **Merge** into a unified set: `competitors[] = [{ name, domain, organic:{rank, gaps?}, geo:{local_pack_rank, cells_present}, aeo:{share, avg_position, mentions} }]`.
- **Provenance:** wrap each lens's facts with `createVerifiedData(data, {source_url, source_name, source_type, fetched_at, expires_at})` (`dataIntegrity.ts:100`); `buildExpiresAt('rankings')` = 24h staleness for ranks (data-integrity standard). `scoreServiceCityGrid` already does exactly this for the rank inputs (`scoreServiceCityGrid.ts:30-34`) — copy that wrapping.
- **Persistence:** prefer a `competitor_intel` jsonb on `kotoiq_client_profile.fields` (per CONTEXT "extend, don't add tables"), OR a small new `kotoiq_competitor_intel` table if the per-cell volume is large. Discretion. The 11-RESEARCH already noted `kotoiq_competitor_url_snapshots` / `kotoiq_competitors` / `kotoiq_grid_scans_pro` exist as raw stores — the aggregator can read those rather than re-fetch when fresh.

**Reused vs NEW:** all three lens engines + provenance wrapping = REUSED. The identity-reconciliation + roster-seeding + merged output + the single action = NEW (this is the phase's real new orchestration). Honor data-integrity on every fetched rank.

---

### WS6 — Extensive opportunity list

**Reused:**
- `pageGapEngine.analyzePageGaps(input)` (`pageGapEngine.ts`, 651 LOC) — already produces `PageSuggestion[]` with `{service, city, state, priority, reason, search_volume, keyword_difficulty, competitor_count, competitor_urls[], competitor_fingerprints?}`, accepts explicit `cities[]` (11-04 added `selectCitiesToCheck`). This is the per-service×city gap producer.
- `scoreServiceCityGrid()` (`scoreServiceCityGrid.ts`, 404 LOC) — the formula + bucketing (`quick_win`/`net_new`/`big_bet`/`low_demand_deprioritize`) wrapper over `analyzePageGaps`. `score_grid` action @`route.ts:6272` already wired, reads confirmed `fields.services[]`. **This already IS the "extensive ranked list" producer** for the service×city axis.
- `content-gap` (`/api/seo/content-gap/route.ts`) — Sonnet over GSC keywords → topic clusters + quick wins + content calendar. `keyword-gap` (`/api/seo/keyword-gap/route.ts`) — Sonnet over GSC keywords → gap_opportunities + competitor_keywords + location_keywords.

**The gap (NEW glue):** `content-gap`/`keyword-gap` currently read ONLY the client's GSC keywords (`getGSCKeywords`) — they do NOT ingest aggregated competitor keywords. To make the list EXTENSIVE and competitor-driven, the new glue must feed WS5's aggregated competitor keywords/pages (from `dfs_compare` intersection + organic SERP titles + AEO cited URLs) INTO these analyses, or more cleanly, feed them into `analyzePageGaps`/`scoreServiceCityGrid` as additional seed phrases. Two viable paths:
1. **Preferred — extend the grid:** pass WS5's competitor keyword set as extra `services`/phrases into `analyzePageGaps` so `scoreServiceCityGrid` buckets them. Keeps ONE ranked output + the existing provenance + UI (`StepGaps`).
2. **Augment the Sonnet routes:** add an optional `competitor_keywords[]` param to `content-gap`/`keyword-gap` prompts. CAUTION: those routes don't call `logTokenUsage` and throw on missing key — fix both if reused.

**Reused vs NEW:** gap engines + scorer + bucketing = REUSED. The competitor-keyword injection + merge into one extensive ranked list = NEW (thin glue). `StepGaps.jsx` already renders the bucketed report — enrich it to show the larger list.

---

### WS7 — Semantic fast-rank strategy

**What each engine produces (verified):**
- `semanticAgents.ts` (`src/lib/semanticAgents.ts`) — four Claude pipelines: `runQueryGapAnalyzer` → `{primary_angle, context_signifiers, competitor_gaps, recommended_h2_order, query_network[]}` (accepts `competitor_pages[]`); Frame Semantics; Semantic Role Labeler; Named Entity Suggester → `{entities[], missing_critical[]}`. These produce per-page semantic-SEO signals (clusters, query network, entities).
- `localStrategistEngine.recommendLocalStrategy` → the big one: `url_structure`, `topic_clusters[]` (with `kind:'service_x_city'`, schema_types, internal_link_targets, e_e_a_t_signals), `internal_linking_strategy{hub_and_spoke, cross_links[]}`, `schema_plan{site_wide, service_pages, city_pages}`, `aeo_strategy{target_entities, answer_format_pages, citation_strategy, structured_answers}`, `attack_plan[]` (phased build order). **AUTO-PERSISTS clusters → `kotoiq_page_suggestions`** (`localStrategistEngine.ts:248,257`). This already covers most of "fast-rank strategy across SEO/GEO/AEO" — clusters + pillar/hub + internal-linking + AEO tactics + prioritized phases.
- `planBuilderEngine.buildPlan(s, {client_id, agency_id, goal, context})` → `PlanDraft {goal, summary, steps[], context, meta}` persisted to `kotoiq_plans` + `kotoiq_plan_steps` as `status:'draft'`. Steps are tied to real `/api/kotoiq` actions with `depends_on`. **This is the persistence target for the "prioritized build order" as an executable plan.**
- `hubBuilder.buildHubPage` (`wp-shim/hubBuilder.ts`, pure) → CollectionPage + BreadcrumbList + ItemList pillar/hub HTML+JSON-LD. `hubTitle`/`hubSlug` deterministic. Already used by `deploy_hub` + `computeInternalLinks` (11-05).
- AEO/GEO-specific tactics (schema, llms.txt, FAQ/answer-first, citation targets) ALREADY come from: `localStrategistEngine.aeo_strategy` + `schema_plan`; the **shim already serves `/llms-full.txt`, `/{slug}.md`, and schema** (session-log #4 `mdTwinBuilder.ts` + md-server.php; hubBuilder BreadcrumbList). So WS7's AEO/GEO tactics are an ASSEMBLY of existing outputs, not new generation.

**Smallest correct change (NEW `fastRankStrategyEngine.ts` + `recommend_strategy` action + new guided step):**
- Compose ONE strategy output: call `recommendLocalStrategy` (clusters + hub + linking + AEO/schema tactics + phased attack) seeded with confirmed services/offerings (WS1) + cities (WS4) + competitor intel (WS5) + the extensive opportunity list (WS6) as `notes`/`existing_pages`/competitor context; optionally enrich top clusters with `semanticAgents.runQueryGapAnalyzer` (pass WS5 competitor pages as `competitor_pages`). Persist the executable build order via `buildPlan` (`kotoiq_plans`) AND rely on `recommendLocalStrategy`'s existing `kotoiq_page_suggestions` persistence.
- **Sonnet** for synthesis; `logTokenUsage` (both underlying engines already do). **Graceful-degrade:** `recommendLocalStrategy`/`buildPlan` THROW on missing key (`:188`/`:196`) — wrap the WS7 call in a guard that checks `ANTHROPIC_API_KEY` first and returns `{ok:false, reason:'ai_unavailable'}` to drive the visible UI banner.
- **New guided step** ("Your strategy" / fast-rank plan) inserted into `GuidedSpine.jsx` `STEPS[]` (`GuidedSpine.jsx:43`) between step 4 (gaps) and step 5 (plan), or replacing/augmenting step 5. Render clusters, pillar/hub plan, internal-linking, AEO/GEO tactics, and the prioritized build order. Reuse `StepShell` + koto primitives.

**Reused vs NEW:** all four engines = REUSED (composition only). The composition lib, the strategy step UI, and the graceful-degrade guard = NEW.

---

### UI — guided spine integration

**State of disk (verified):** `GuidedSpine.jsx` + `steps/{StepConnected, StepSiteToday, StepCompetitors, StepGaps, StepPlan, StepLiveCited, StepShell}.jsx` ALL EXIST (2026-06-08). `ClientView.jsx` (39KB) hosts the Guided tab. The spine owns shared cross-step state (`runId`, `selectedState`, `selectedCities`, `confirmedServices`) and polls `run_all_status` (`GuidedSpine.jsx:73-97`). Steps use `StepShell` (status pill + EducationalNote + one CTA) + koto primitives — DESIGN.md compliant.

**Enrichment per step (smallest correct change):**
- **Step 2 (`StepSiteToday`):** add the comprehensive four-category extraction — render four `CategoryChips` groups (keywords/phrases/services/offerings) hydrated from one `extract_comprehensive` call. Today step 2 only shows baseline page count/types via `get_site_inventory` (`route.ts:6742`).
- **Step 3 (`StepCompetitors`):** currently kicks `analyze_competitors` for one representative city (`StepCompetitors.jsx:63-79`). Enrich to call the WS5 `competitor_intel` aggregator (organic + AEO + GEO) and render the per-competitor × per-lens set (Blazly-style GEO/AEO visibility bars per CONTEXT specifics). Reuse `CityPicker` (already wired, `StepCompetitors.jsx:111`).
- **Step 4 (`StepGaps`):** already renders the bucketed `score_grid` report + embeds `ServiceChips` (`StepGaps.jsx:100`). Enrich with the EXTENSIVE list (WS6) — swap `ServiceChips` for the four `CategoryChips`, show the larger ranked list.
- **NEW strategy step (WS7):** add to `STEPS[]` + a `<StepStrategy/>` rendering `recommend_strategy` output. `GuidedSpine.jsx` switches steps by index (`:159-164`) — add a 7th entry.
- **DESIGN.md primitives available** (`src/components/ui/koto/index.jsx`, verified exports): `Eyebrow, SectionHeader, EducationalNote, ActionCallout, EmptyState, StatGrid, Stat, WorkflowStepper, FlagChip, NextStepLink, BottomCTA, LiveTicker, Tooltip, Skeleton, ErrorState, CtaButton, KotoKeyframes`. Tokens via `src/styles/koto-tokens` (`t`). Navy `#201b51`, pink `#cb1c6b`, cream `#faf9f6`. Reference impl: `AEOVisibilityTab.jsx`.

**Reused vs NEW:** spine + step shells + CityPicker + status polling + primitives = REUSED. Four-category chip groups in step 2, the 3-lens competitor view in step 3, the extensive list in step 4, and the new strategy step = NEW UI.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Full-site URL discovery | sitemap crawler | `discoverAllUrls(domain)` `pageDiscovery.ts:111` | robots→sitemap, same-domain, asset-filtered, 500-cap done |
| Page content extraction | HTML parser | `fetchAndExtract` `pageContentExtractor.ts:62` → `ExtractedPage` | h1/h2/hero/body/meta/schema/hash done |
| Four-category persistence | new table | generalize `saveConfirmedServices` → `saveConfirmedField(category)` → `kotoiq_client_profile.fields[category]` | `score_grid` already reads `fields.services[]`; helper auto-scopes agency_id |
| Editable AI-flagged chips | new component | generalize `ServiceChips.jsx` → `CategoryChips` | AI badge + provenance + add/remove + save already built on koto primitives |
| Manual entry | new input flow | `ServiceChips` add-chip path (`user_added`, conf 1.0) | already matches CONTEXT WS4 exactly |
| Synergy/strategy Claude shape | new SDK plumbing | copy `localStrategistEngine`/`planBuilderEngine` (Sonnet, strict-JSON, cost, logTokenUsage) | proven pattern; copy graceful-degrade from `serviceInference`, NOT the `!`-throw |
| Organic competitor rank | new SERP fetch | `analyze_competitors` `market` mode (`rank_group`) + `dfs_compare` intersection | DataForSEO SERP + Moz DA/PA done |
| Map-pack GEO rank | new Places grid | `grid-scan` `target_business` | geocode + N×N searchNearby + per-cell rank + top3 done |
| AEO citation/SoV | new LLM-probe harness | `setupClientForAEO` + `runAEOVisibilityScan` + `getCompetitorCompare` | 5-engine scan + mention parse + per-brand share done |
| Provenance wrapping | custom timestamp logic | `createVerifiedData` + `buildExpiresAt` `dataIntegrity.ts:100` | source_url+fetched_at+stale grading + `DataSourceBadge` done |
| Gap scoring + buckets | new scorer | `scoreServiceCityGrid` / `analyzePageGaps` | formula + quick_win/net_new/big_bet + provenance done |
| Pillar/hub + internal links | hub builder / link injector | `hubBuilder.buildHubPage` + `computeInternalLinks` (11-05) | CollectionPage/BreadcrumbList + sibling/cross/hub merge done |
| Executable plan persistence | new plan table | `buildPlan` → `kotoiq_plans`/`kotoiq_plan_steps` | draft plan + step deps + action binding done |

**Key insight:** WS3/WS7 look like new "AI engines" but are Sonnet-prompt + JSON-parse wrappers identical to two engines that already exist; the real new work is WS5's three-lens reconciliation and the four-category extractor prompt.

---

## Runtime State Inventory

Phase 12 is additive (new libs/actions/UI + extended jsonb), not a rename/refactor.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New `kotoiq_client_profile.fields.{keywords,phrases,services,offerings}` lists; possibly `fields.competitor_intel`; new `kotoiq_aeo_competitors` rows (seeded from organic/GEO rosters); new `kotoiq_aeo_prompts` (40 seeded per client); `kotoiq_aeo_runs` (per scan); strategy → `kotoiq_page_suggestions` + `kotoiq_plans`/`kotoiq_plan_steps` | None new-table required if extending `fields` (discretion); AEO seeding is a data write at WS5 run time |
| Live service config | None new — no `webhook.set` changes. (Existing save_post/publish_post webhooks from 11-01 untouched.) | None |
| OS-registered state | None — no cron changes (existing `aeo-visibility-scan` + `freshness-refresh` crons untouched) | None |
| Secrets/env vars | Uses existing `ANTHROPIC_API_KEY` (currently $0 — see Risks), `CENSUS_API_KEY`, `NEXT_PUBLIC_GOOGLE_PLACES_KEY`, DataForSEO creds, `MOZ_API_KEY` (optional). No new secrets. | Confirm a FUNDED `ANTHROPIC_API_KEY` before the Claude steps return non-empty |
| Build artifacts | None | None |

**Nothing in Live service config / OS state / new secrets — verified by reading 11 summaries + the route/engines this session.**

---

## Common Pitfalls

1. **`ANTHROPIC_API_KEY!` throw vs graceful degrade.** `localStrategistEngine.ts:188`, `planBuilderEngine.ts:196`, and the `content-gap`/`keyword-gap` routes THROW on missing/unfunded key. New WS3/WS7 engines must copy `serviceInference.ts:216`'s guard and return an explicit `{ok:false, reason:'ai_unavailable'}` → visible UI banner. Never `catch {}` the $0-credit error silently (CONTEXT).
2. **AEO needs seeding before a scan.** `runAEOVisibilityScan` returns zeros if `kotoiq_aeo_prompts`/`kotoiq_aeo_competitors` aren't seeded. The aggregator must `setupClientForAEO` (idempotent upserts) and add organic/GEO competitors into `kotoiq_aeo_competitors` BEFORE the scan, or AEO SoV is empty.
3. **Identity reconciliation across lenses.** Organic = domains, GEO = business names, AEO = brand_name rows. A naive merge double-counts. The aggregator must map domain→brand (use `kotoiq_aeo_competitors.domain`/`aliases[]`).
4. **Token + spend budget on large sites.** Comprehensive extraction over ALL pages (WS1) and a 5-engine AEO scan + N×N Places grid per service×city (WS5) can be expensive. Cap baseline pages fed to the extractor (`pageSignalsForClaude` already slices to 60 / 8000 chars — `serviceInference.ts:182,195`); cap GEO grid_size and run a representative service×city subset; gate AEO scans behind explicit user action.
5. **Don't add new tables when `fields` suffices.** CONTEXT prefers extending `kotoiq_client_profile.fields` + `kotoiq_page_suggestions`. `fields` is untyped jsonb (the WS3 SUMMARY proved you can't add to the typed `SOURCE_TYPES` enum without breaking the Phase-8 parity test — keep the self-contained provenance shape, write `fields` directly).
6. **Route files export only handlers.** New engine logic goes in `src/lib/...`, exposed via actions appended to the `/api/kotoiq` if-chain. No `ALLOWED_ACTIONS` constant exists.
7. **DataForSEO/Places failures are silent fallbacks.** `analyze_competitors` falls back to `koto_intel_reports` competitors when DataForSEO fails (`route.ts:1450-1456`); `grid-scan` returns `[]` on failure. The aggregator must mark a lens "unavailable" rather than present empty as "no competitors."
8. **Migrations are manual-apply.** If any new column/table IS added, ship the file + append to `_paste_all_pending.sql`; NEVER `supabase db push`.

---

## Environment Availability

| Dependency | Required By | Available | Fallback |
|------------|------------|-----------|----------|
| `ANTHROPIC_API_KEY` (FUNDED) | WS1 extract, WS3 synergy, WS5 AEO, WS7 strategy | ✗ ($0 credit, both keys) | Heuristic fallbacks (WS1) + visible "AI unavailable" (WS3/5/7). Code builds + ships. |
| `CENSUS_API_KEY` | WS4/WS5 cities via `geoLookup` | ✓ (prior phases) | — |
| `NEXT_PUBLIC_GOOGLE_PLACES_KEY` | WS5 GEO grid-scan + geocode | ✓ | grid-scan 500s without it (route guards) |
| DataForSEO creds | WS5 organic SERP + `dfs_compare` + WS6 volume/KD | ✓ | `analyze_competitors` falls back to intel-report competitors |
| `MOZ_API_KEY` | WS5 organic DA/PA enrichment | optional | skipped if absent (`route.ts:1489`) |
| Paired v4 site + `kotoiq_site_baseline` rows | WS1 extraction source | ✓ (11-02) | extractor returns empty if no baseline (graceful, mirrors `infer_services`) |

**Blocking with no fallback:** none for BUILD. **Runtime:** funded `ANTHROPIC_API_KEY` is required for the AI steps to return non-empty — this is the one operator action that gates real output (NOT a build blocker).

---

## Validation Architecture (nyquist_validation = true)

| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) |
| Quick run | `npx vitest run <file>` |
| Full suite | `npm run test` |
| Typecheck | `npx tsc --noEmit` (repo ships clean) |
| Browser verify | `next dev --no-turbo` (React19/Turbopack Sidebar bug) — dashboard behind Supabase auth |

**Phase Requirements → Test Map (illustrative; pure-function-first):**
| WS | Behavior | Test | Exists? |
|----|----------|------|---------|
| WS1 | four-category heuristic fallbacks (pure) + Haiku JSON parse + logTokenUsage once | `tests/kotoiq/comprehensiveExtractor.test.ts` | ❌ Wave 0 |
| WS1 | `saveConfirmedField` writes `fields[category]` (mock clientProfile) | (same/serviceInference) | ❌ Wave 0 |
| WS3 | synergy graceful-degrade returns `{ok:false}` when no key; JSON parse on fixture | `tests/kotoiq/synergyEngine.test.ts` | ❌ Wave 0 |
| WS5 | identity reconciliation (domain↔brand) merge is correct + dedup (pure) | `tests/kotoiq/competitorIntel.test.ts` | ❌ Wave 0 |
| WS7 | strategy composition guard returns `ai_unavailable` w/o key | `tests/kotoiq/fastRankStrategy.test.ts` | ❌ Wave 0 |

**Wave 0:** keep extractor/synergy/reconciliation/strategy-guard as pure IO-free functions (mirrors `scoreServiceCityGrid`'s `computeCellScore`/`bucketCell` and `servicesFromHeuristic`) so they unit-test on fixtures without DB/network. Existing kotoiq tests live in `tests/kotoiq/`.

---

## Security Domain (security_enforcement = enabled)

| ASVS | Applies | Control |
|------|---------|---------|
| V2 Auth | yes | New actions ride `/api/kotoiq` verifySession + CRON_SECRET gate (no new auth surface) |
| V4 Access Control | yes | Agency isolation via `getKotoIQDb`/`clientProfile.upsert` auto-inject `agency_id`; `kotoiq_aeo_*` are client_id-scoped — confirm client ownership via the route gate before AEO writes |
| V5 Input Validation | yes | Validate `category ∈ {keywords,phrases,services,offerings}`, cities Census-filtered (`selectCitiesToCheck` drops unknowns), grid_size ≤ 7 |
| V6 Crypto | reuse | No new crypto |
| SSRF | yes | WS1 fetch constrained to the client's own paired domain (baseline is same-host filtered; `discoverAllUrls` same-domain). Don't fetch arbitrary competitor URLs server-side beyond the existing engines' constrained inputs |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| Unverified AI categories/synergies drive builds | Tampering | AI-inferred FlagChip + accept gate; only confirmed `fields[]` feed scoring/strategy |
| Stale/fabricated competitor ranks | Tampering | `createVerifiedData` + `buildExpiresAt('rankings')` 24h on every lens fact |
| Cross-agency profile/AEO leak | Info disclosure | route gate + agency-scoped helper; AEO writes after client-ownership check |
| AEO/Places spend blowout | DoS (cost) | gate scans behind explicit user action; cap grid + representative service×city subset |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 11-06 guided spine shipped (files on disk, SUMMARY missing) and is the surface to extend | UI/Summary | Low — files verified present + dated; if it was reverted, planner must re-establish the spine first |
| A2 | Generalizing `saveConfirmedServices`→`saveConfirmedField(category)` over `fields[category]` is the right persistence (no new table) | WS1 | Low — `score_grid` already reads `fields.services[]`; CONTEXT prefers extending `fields` |
| A3 | ONE `competitorIntel.ts` lib + ONE `competitor_intel` action beats per-lens actions | WS5 | Medium — discretion; identity reconciliation argues for one owner, but per-lens is also valid |
| A4 | `recommendLocalStrategy` + `buildPlan` cover most of WS7; the new engine is composition + a guard | WS7 | Medium — if the product wants a single bespoke strategy prompt, more new prompt work |
| A5 | WS6 is best done by feeding competitor keywords into `analyzePageGaps`/`scoreServiceCityGrid` (one ranked output) rather than augmenting the Sonnet `content-gap`/`keyword-gap` routes | WS6 | Medium — augmenting the Sonnet routes is also viable but they lack logTokenUsage + throw on no key |
| A6 | The synergy/strategy "visible AI-unavailable" requirement means NEW engines must NOT copy the `ANTHROPIC_API_KEY!` throw | WS3/WS7 | Low — verified the throw at `:188`/`:196`; CONTEXT explicitly requires a visible signal |

---

## Open Questions

1. **Confirm 11-06 spine is the live surface** (files exist, no SUMMARY). If it was never merged to main, WS-UI must first land the spine. Recommend the planner verify `git log` for `GuidedSpine.jsx`.
2. **WS5 persistence: `fields.competitor_intel` jsonb vs new `kotoiq_competitor_intel` table?** Volume (competitors × service×city × 3 lenses) may argue for a table. Discretion — default to `fields` unless the per-client payload is large.
3. **WS6: extend the grid (A5 preferred) vs augment the Sonnet gap routes?** If augmenting the Sonnet routes, also add `logTokenUsage` + graceful key-degrade to them (they lack both today).
4. **WS5 spend control:** run AEO + full GEO grid for EVERY service×city, or a representative subset? Recommend a representative subset + explicit "run full scan" action to bound DataForSEO/Places/AEO cost.

---

## Recommended Plan Split

**6 plans.**

1. **12-01 — Unified four-category extractor** (WS1)
   - New `comprehensiveExtractor.ts` (Haiku, graceful-degrade, `logTokenUsage`); per-category heuristic fallbacks (reuse `servicesFromHeuristic`, `voiceOnboardingAutoSetup` quick_scan). Generalize `saveConfirmedServices`→`saveConfirmedField(category)`. New `extract_comprehensive` + generalized `save_field` actions. Pure-fn unit tests.
2. **12-02 — Multi-category editable chips + manual entry** (WS2 + WS4)
   - Generalize `ServiceChips`→`CategoryChips` (category prop, 4-group layout, AI badge, manual `user_added`). Keep `ServiceChips` as a wrapper. No new persistence (rides 12-01).
3. **12-03 — Synergy engine + suggestion chips** (WS3)
   - New `synergyEngine.ts` (Sonnet, copy localStrategist shape, graceful-degrade, `logTokenUsage`); `recommend_synergies` action; accept-to-promote chips in a distinct visual state.
4. **12-04 — Competitor-intel aggregator (organic + AEO + GEO)** (WS5)
   - New `competitorIntel.ts` + `competitor_intel` action: reconcile organic (`analyze_competitors`/`dfs_compare`) + GEO (`grid-scan`) + AEO (`setupClientForAEO`/`runAEOVisibilityScan`/`getCompetitorCompare`), seed AEO roster, wrap each lens in `createVerifiedData`. Pure reconciliation unit tests. Independent of 12-01..03 — can parallelize.
5. **12-05 — Extensive opportunity list** (WS6)
   - Feed WS5 competitor keywords/pages into `analyzePageGaps`/`scoreServiceCityGrid` → one extensive ranked list; enrich `StepGaps`. (Needs 12-04.)
6. **12-06 — Semantic fast-rank strategy + guided UI** (WS7 + UI)
   - New `fastRankStrategyEngine.ts` composing `recommendLocalStrategy` + `semanticAgents` + `buildPlan` + `hubBuilder`, with the key-guard; `recommend_strategy` action; new `<StepStrategy/>` step + enrich steps 2/3/4 (four `CategoryChips`, 3-lens competitor view, extensive list). DESIGN.md primitives. Ends in a human-verify checkpoint.

**Dependency ordering:** 12-01 → 12-02 ; 12-03 (after 12-02) ; 12-04 (parallel) ; 12-04 → 12-05 ; (12-01 + 12-04 + 12-05) → 12-06.

---

## Sources (all HIGH — read this session at file:line)

- `12-CONTEXT.md`, `ROADMAP.md` (Phase 12 entry), `.planning/config.json`
- All Phase 11: `11-CONTEXT.md`, `11-RESEARCH.md`, `11-0{1..5}-SUMMARY.md`, `11-06-PLAN.md` (no SUMMARY — spine shipped to disk)
- `src/lib/kotoiq/serviceInference.ts` (full — WS1 extension target + graceful-degrade pattern)
- `src/components/kotoiq/ServiceChips.jsx` (full — WS2 generalization target)
- `src/lib/kotoiqDb.ts` (full — `clientProfile.upsert`, `DIRECT_AGENCY_TABLES`)
- `src/lib/kotoiq/aeoVisibilityEngine.ts` (full — WS5 AEO lens), `supabase/migrations/20260608_kotoiq_aeo_visibility.sql`
- `src/lib/kotoiq/localStrategistEngine.ts` + `planBuilderEngine.ts` (full — WS3/WS7 shape + the `ANTHROPIC_API_KEY!` throw)
- `src/lib/semanticAgents.ts` (signatures), `src/lib/wp-shim/hubBuilder.ts` (signatures)
- `src/lib/kotoiq/pageContentExtractor.ts` + `pageDiscovery.ts` (full — WS1 inputs, `discoverAllUrls`)
- `src/lib/builder/scoreServiceCityGrid.ts` (header + signals — WS5/WS6)
- `src/app/api/kotoiq/route.ts` (analyze_competitors @1401, dfs_compare @5259, score_grid @6272, sync_page_factory @6211, get_site_inventory @6742, infer_services @6784, save_services @6828, derive_phrases @6860, aeo_* @4224-4330, run_all_status @5846, list_build_order @6120, get_page_factory_stats @5864)
- `src/app/api/seo/{content-gap,keyword-gap,grid-scan}/route.ts` (full — WS5 GEO + WS6 gap routes)
- `src/components/kotoiq-wp/GuidedSpine.jsx` + `steps/{StepShell,StepCompetitors,StepGaps,StepPlan,StepLiveCited}.jsx` (full — UI)
- `src/components/ui/koto/index.jsx` (primitive exports), `src/lib/dataforseo.ts:505` (`getDomainIntersection`)
- `_knowledge/data-integrity-standard.md`, `_knowledge/session-log.md`, `DESIGN.md`, `CLAUDE.md`/`AGENTS.md`

---

## Metadata

**Confidence:** Standard stack HIGH (no new deps, all files read). Integration points HIGH (verified at file:line). WS5 reconciliation MEDIUM on exact merge shape (discretion). WS7 composition MEDIUM (depends on how bespoke the strategy prompt must be). Runtime-key dependency HIGH (verified both engines throw; CONTEXT confirms $0 credit).

**Research date:** 2026-06-10
**Valid until:** ~2026-07-10 (re-verify `/api/kotoiq` action line numbers and `GuidedSpine` step list if the monoliths change; confirm 11-06 merge state).

## RESEARCH COMPLETE
