# Phase 11: KotoIQ WP guided onboarding and competitor-driven gap engine - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning
**Source:** Conversation + codebase recon (acts as PRD)

<domain>
## Phase Boundary

Turn `/kotoiq-wp` into a guided, self-explanatory experience. On first install (pairing
complete) it scans the client's site, lets the user confirm the services it found and pick
target cities, finds content gaps **proven by competitor rank data**, ranks the build order,
and auto-links what gets built — for SEO/GEO/AEO.

**This phase is wiring + one scoring function + UX assembly over engines that already exist.
It is NOT a rebuild.** The deployed WP plugin (`kotoiq-shim 4.2.5`) is a locked thin RPC shim;
all intelligence lives dashboard-side. No plugin changes in this phase.

**In scope (7 workstreams):**
1. Orchestration spine (pair → auto-scan + audits + webhook registration)
2. Day-1 baseline page-inventory snapshot
3. Service auto-extraction → editable chips
4. City multi-select picker driving competitor discovery
5. Competitor-driven gap scoring (`scoreServiceCityGrid`)
6. Auto internal-linking of built pages
7. Guided 6-step UI shell

**Out of scope:** plugin changes; new competitor data providers; rebuilding any existing engine.
</domain>

<decisions>
## Implementation Decisions

### Location & surface
- Everything lives at the existing `/kotoiq-wp` route (`src/views/kotoiq/KotoIQShellPage.jsx`).
- The current tab-bag (Intel / Publish / Tune / Pipeline / Settings) is replaced **for the
  first-run/client view** by a linear 6-step spine. Power-user tabs may remain reachable, but
  the default guided path is the spine.

### Orchestration spine (workstream 1)
- Trigger is **dashboard-side** in the pair-callback handler (`src/app/api/seo/wp-register`).
  Pairing is dashboard-initiated, so the dashboard already knows the moment a site connects —
  no plugin webhook for "paired" is needed (and none exists in the shim allowlist).
- On successful pair: mark connected, then enqueue the scan + `/api/kotoiq?action=run_all_audits`
  chain (fire-and-forget, tracked via `kotoiq_sync_log`).
- Register `save_post` + `publish_post` webhooks via the shim `webhook.set` verb so the
  dashboard inventory stays live after the first scan (no polling).

### Baseline snapshot (workstream 2)
- Store a day-1 inventory of the client's OWN pages (URL, title, H1, type, word count,
  content hash) in a new table so later scans diff against it. Reuse `pageDiscovery` +
  `pageContentExtractor`. Snapshot is immutable; ongoing state tracked separately.

### Service auto-extraction (workstream 3)
- After the scan, infer the services list FROM the scanned pages (not the keyword scan).
  Present as **editable add/remove chips**, pre-seeded from the real site. User can add/remove.
- Replaces the manual comma-separated textbox in `PageSuggestionsTab`. Confirmed services feed
  the gap grid.
- Optional per-service **target phrases**: auto-derive from the keyword engines (GSC +
  DataForSEO) AND let the user pin/add phrases manually. Both seed the grid.

### City picker (workstream 4)
- A **city multi-select** (Census-backed, per data-integrity standard) replaces the
  State+Counties inputs as the targeting control. Chosen cities scope competitor discovery
  (`grid-scan` / `analyze_competitors` / `pageGapEngine` already accept location).

### Competitor-driven gap scoring (workstream 5)
- New `scoreServiceCityGrid()` joins the service×city matrix (`localStrategistEngine`
  kind:`service_x_city`, `pageGapEngine`) to competitor rank data.
- Per cell (service × city):
  `score = (demand + competition_strength) × (1 − our_coverage) ÷ difficulty`
  - demand: client targets it (in grid) + derived phrase volume
  - competition_strength: how many/how strong competitors rank for "{service} {city}"
  - our_coverage: do we already have a page, and is it thin
  - difficulty: keyword/SERP difficulty
- Output is a **ranked build order** bucketed into **quick wins** (already rank ~8-25),
  **net-new** (competitors cover, we have nothing), **big bets** (high volume/difficulty).
  This replaces generic best-practice strategy as the recommendation.

### Auto internal-linking (workstream 6)
- Apply the link plan `localStrategistEngine` already emits into published posts.
- Reuse `hubBuilder.ts` (pillar/hub + BreadcrumbList already built — session-log #6) for
  pillar→cluster + sibling cross-links and anchor text. Schema-only breadcrumbs stay out of
  post content (KSES); link injection uses the established deploy/redeploy path.

### Guided UI shell (workstream 7)
- Linear spine, six steps: **Connected → Your site today → Who you're up against → Your gaps
  → Your plan → Live + cited.**
- Every panel: plain-English "what this does" subtitle (no bare acronyms — e.g. "AEO = whether
  AI assistants recommend you"), exactly one primary action, and a visible status
  (done / running / waiting on you) so long background scans don't look broken.
- Honor `DESIGN.md` (Unified Marketing palette) — read it before any visual decision.

### Platform conventions (locked, project-wide)
- **Data integrity standard applies** (`_knowledge/data-integrity-standard.md`): cities via
  Census, ranks/competitors via live APIs, every fetched fact wrapped in `VerifiedDataSource`
  with `source_url` + `fetched_at`; AI-generated content flagged in UI.
- **Supabase migrations:** new tables shipped as a migration file but **applied manually via
  the SQL editor** — never `supabase db push` (prod has tracking drift).
- **Token usage:** every Claude call logs via `logTokenUsage` (haiku for cheap, sonnet for
  quality).
- **Shipping:** direct to `main`, no PRs.

### Claude's Discretion
- Exact schema/column names for the baseline snapshot table and the gap-score table.
- Scoring weights/normalization inside `scoreServiceCityGrid` (tune to sane defaults; expose
  constants).
- Component decomposition for the 6-step spine and how much of the old tab UI to retain.
- Whether service inference uses a cheap Claude pass over extracted page text or a
  heuristic over URL/H1 patterns (prefer cheapest that's accurate; flag AI-inferred services
  in UI per data-integrity standard so the user verifies before they drive builds).
- Background-job mechanism for the orchestration chain (reuse existing `kotoiq_sync_log`
  fire-and-forget pattern).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & direction
- `.planning/phases/10-kotoiq-wp-plugin-thin-shim-pivot-move-all-business-logic-out/` — the thin-shim cutover this phase depends on; orchestration must live on the v4 shim/dashboard side
- `.planning/phases/09-consolidate-wordpress-site-management-unified-kotoiq-wp-view/` — the `/kotoiq-wp` consolidation (FleetView/ClientView shell this phase extends)
- `KOTOIQ_INVENTORY.md` — repo topology + engine inventory

### Engines to reuse (do not rebuild)
- `src/lib/kotoiq/pageDiscovery.ts` — sitemap/robots page discovery
- `src/lib/kotoiq/pageContentExtractor.ts` — per-page content + content hash
- `src/lib/kotoiq/localStrategistEngine.ts` — service×city matrix, URL architecture, internal-link plan
- `src/lib/builder/pageGapEngine.ts` — service×city opportunities (topical map + sitemap + census geo + competitor fingerprints)
- `src/lib/kotoiq/bulkPageBuilder.ts` — brief generation + publish-to-WP
- `src/lib/kotoiq/aeoVisibilityEngine.ts` — GEO/AEO citation tracking (weekly cron)
- `src/lib/hubBuilder.ts` — pillar/hub + BreadcrumbList auto-architecture
- `src/lib/topicalMapEngine.ts`, `src/lib/internalLinkEngine.ts` — topical graph + link audit

### API routes to wire
- `src/app/api/seo/wp-register/route.ts` — pair callback (orchestration trigger)
- `src/app/api/kotoiq/route.ts` — `run_all_audits`, `analyze_competitors`, `dfs_compare`, `generate_brief`, etc.
- `src/app/api/seo/keyword-gap`, `src/app/api/seo/content-gap`, `src/app/api/seo/grid-scan` — gap + geo-rank inputs
- `src/app/api/builder/gaps` — existing gap entry point

### UI to extend
- `src/views/kotoiq/KotoIQShellPage.jsx` — the `/kotoiq-wp` shell
- `src/components/kotoiq-wp/{ClientView,FleetView,SitesTable}.jsx`
- `src/components/kotoiq/PageSuggestionsTab.jsx` — current (manual) services/cities entry to replace

### Standards (MANDATORY)
- `_knowledge/data-integrity-standard.md` — VerifiedDataSource, authoritative sources, freshness
- `DESIGN.md` — palette, typography, spacing (read before any visual decision)
- `CLAUDE.md` / `AGENTS.md` — Next.js-in-this-repo caveats; read `node_modules/next/dist/docs/` before new framework patterns

### Plugin (reference only — DO NOT modify)
- `wp-plugin-kotoiq-shim/` — locked v4.2.5 thin RPC shim; webhook allowlist:
  `save_post, publish_post, delete_post, trashed_post, wp_login, wp_logout, shim_health_check_failed`
</canonical_refs>

<specifics>
## Specific Ideas

- Gap report copy should read like outcomes, not metrics: "38 opportunities, ranked by what'll
  move traffic fastest — 9 quick wins, 21 net-new, 8 big bets."
- City a client lists but NO competitor targets → surface as either a quick win or a low-demand
  deprioritize, with the reason shown.
- At pair time, register content webhooks immediately so the very first edit after onboarding
  keeps inventory fresh.
</specifics>

<deferred>
## Deferred Ideas

- Auto-action on poor AEO performance (e.g. "SoV < 10% → rebuild schema / create FAQ page") —
  future; this phase surfaces citation status in step 6 but does not auto-remediate.
- Auto-publish without human approval — keep an approval gate before pages go live.
- Per-site Ed25519 key rotation and any plugin-side changes — owned by Phase 10 / M2.
</deferred>

---

*Phase: 11-kotoiq-wp-guided-onboarding-and-competitor-driven-gap-engine*
*Context gathered: 2026-06-08 via conversation + codebase recon*
