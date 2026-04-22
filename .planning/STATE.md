---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready-for-pilot
stopped_at: M1 code-complete + infra green; Phase 8 UI scope-cut to next milestone; remaining work is human UAT + PILOT-01 operator test
last_updated: "2026-04-21T22:10:00.000Z"
last_activity: 2026-04-21
progress:
  total_phases: 8
  completed_phases: 8
  total_plans: 15
  completed_plans: 15
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Agencies run every layer of a client engagement from a single white-label platform — now including closed-loop programmatic SEO that attributes dollars to pages.
**Current focus:** PILOT-01 — 20 live hyperlocal pages on momentamktg.com

## Current Position

Phase: 8 (code-complete + verified)
Plan: All 15 plans code-complete
Status: Ready for pilot + human UAT
Last activity: 2026-04-21

Progress: [██████████] 100% code-complete; 88% toward M1 done-done (pending human UAT + PILOT-01 operator test)

### Phase 8 plan state (as of 2026-04-21)

| Plan | Status | SUMMARY | Note |
|------|--------|---------|------|
| 08-01 | complete | yes | foundation (SOURCE_CONFIG + agency integrations schema) |
| 08-02 | complete | yes | cost guardrails (checkBudget + estimateCost + rate limits) |
| 08-03 | complete | yes | encryption vault + /api/kotoiq/integrations dispatcher |
| 08-04 | complete | yes | form parsers (Typeform + Jotform + Google Forms + scrape fallback) |
| 08-05 | complete | yes | website crawl (SSRF + robots + 3-mode + Playwright probe) |
| 08-06 | complete | yes | GBP (OAuth + authenticated pull + Places fallback) |
| 08-07 | complete | yes | file upload (PDF + DOCX + HEIC/image vision/OCR) |

Code for 04-07 shipped via remote aggregate commit 75ac2ff, landed in main via merge 2a24317. SUMMARYs authored retroactively (04 by agent, 05/06/07 reconciled in this session).

## Performance Metrics

**Velocity:**

- Total plans completed: 8
- Average duration: —
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |
| 07 | 8 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 07 P01 | 30min | 6 tasks | 10 files |
| Phase 07 P02 | 35min | 2 tasks | 4 files |
| Phase 07 P03 | 20min | 5 tasks | 9 files |
| Phase 07 P04 | 21min | 6 tasks | 9 files |
| Phase 07 P05 | 8min | 2 tasks | 4 files |
| Phase 07 P06 | 10min | 1 tasks | 2 files |
| Phase 07 P08 | 25min | 6 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Agency-isolation helper + ESLint rule + `kotoiq_*` migration must land before any real data handling
- Phase 1: Elementor v4 adapters built from live captured JSON (ELEM-05), not documentation
- Phase 1: `getKotoIQDb(agencyId)` helper is new-code-only (KotoIQ routes); retrofit of existing 131 routes is a separate initiative
- Phase 1: No template design exists yet — ELEM-05 schema capture will use any existing Elementor page on momentamktg.com
- Phase 2: Writes go through `Document::save()` PHP adapter — never direct `update_post_meta('_elementor_data', ...)`
- Phase 3: Pre-flight gate refuses rather than warns — construction-time defense against Google's scaled-content-abuse policy
- Phase 4: Vercel Workflow DevKit for durable publish orchestration; `koto_wp_commands` stays as plugin-call audit log
- Phase 5: IndexNow + GSC sitemap ping only — Google Indexing API excluded (restricted to JobPosting/BroadcastEvent)
- [Phase 07]: Plan 1: Per-table updated_at trigger function pattern (one CREATE FUNCTION per table) — repo never had a shared set_updated_at helper; followed 20260461 precedent
- [Phase 07]: Plan 1: Pinned model IDs claude-sonnet-4-5-20250929 + claude-haiku-4-5-20251001 as canonical; CONTEXT 'Sonnet 4.6 / Haiku 4.5' is aspirational
- [Phase 07]: Plan 1: Vitest resolve.conditions includes 'react-server' so server-only resolves to its empty stub at test time (mirrors Next.js)
- [Phase 07]: Plan 2: Reused Plan 1's Record<string, any> jsonb-row idiom (with eslint-disable) instead of unknown narrowing — keeps profileIngestInternal consistent with kotoiqDb.ts (70+ same-style sites)
- [Phase 07]: Plan 2: pain_point_emphasis appended from BOTH hot_lead_reasons AND notable_insights (two ProvenanceRecord entries, not merged) — preserves source attribution for the chat-widget 'where did this come from?' UX
- [Phase 07]: Plan 2: Voice _call_analysis array values stored as ProvenanceRecord.value: string[] (not joined) so Plan 3 discrepancy catcher can do list-symmetric-diff per DISCREPANCY_TOLERANCE = 0.5
- [Phase 07]: Plan 3: Year-shaped numeric discrepancy uses absolute window (tolerance × 25 years) instead of relative spread — literal formula gives 404-year window for founding_year, fails plan's stated test outcomes
- [Phase 07]: Plan 3: ExtractedFieldRecord tuple shape ({field_name, record}) keeps ProvenanceRecord byte-identical to Plan 2 deterministic-puller output; seeder groups by field_name before merging
- [Phase 07]: Plan 3: profileDiscrepancy.ts intentionally NOT server-only (pure function) so Plan 7 operator UI can run live discrepancy previews without HTTP roundtrip
- [Phase 07]: Plan 4: kotoiq_pipeline_runs schema mismatch — plan assumed columns (current_stage, current_step, started_at, updated_at) that don't exist; refactored to append events to steps jsonb column instead
- [Phase 07]: Plan 4: Used getKotoIQDb.client (not .raw()) — KotoIQDb interface has no raw() method; relies on local sb() helper + explicit .eq('agency_id',...) since kotoiq_pipeline_runs is not in DIRECT_AGENCY_TABLES
- [Phase 07]: Plan 4: D-10 margin notes derived rule-based (no extra LLM call) inside seedProfile — keeps Stage 0 cost flat; v2 may swap to Haiku one-shot if rule-based misses too many notable insights
- [Phase 07]: Plan 4: Concurrency cap = 3 for both per-section discovery + per-call voice extraction — balances Anthropic rate limits against PROF-01 <10s seed target
- [Phase 07]: Plan 5: Used getKotoIQDb.client + .from() instead of .raw() — KotoIQDb interface has no raw() method (mirrors Plan 4 deviation)
- [Phase 07]: Plan 5: createNotification called with positional signature (sb, agencyId, type, title, body, link, icon, metadata) — actual helper is positional, NOT object-args as plan assumed
- [Phase 07]: Plan 5: buildQuestionFromGap is rule-based via 20-template table (no extra Haiku call) — keeps per-clarification cost bounded; v2 may swap to Haiku phrasing
- [Phase 07]: Plan 5: All forwarders return {ok, error?} and never throw (D-19 non-blocking) — pipeline never blocks on dispatch failure
- [Phase 07]: Plan 6: Used db.client.from(...) + explicit .eq('agency_id', agencyId) for non-kotoiq tables — KotoIQDb has no raw() method (3rd plan to hit + standardise this; canonical Phase 7 pattern now)
- [Phase 07]: Plan 6: Imported CANONICAL_FIELD_NAMES from profileTypes (NOT profileConfig — only HOT_COLUMNS lives there). Full 26-name list is the canonical baseline schema.
- [Phase 07]: Plan 6: Defense in depth — route NEVER passes agency_id to db.clientProfile.upsert. The Plan 1 helper auto-injects it (kotoiqDb.ts:343-352), making cross-agency writes structurally impossible.
- [Phase 07]: Plan 6: Established canonical kotoiq HTTP route shape — verifySession FIRST → 401 if !verified || !agencyId → ALLOWED_ACTIONS validation → action chain → typed db helpers. Future Plan 7/8 routes mirror this verbatim.
- [Phase 07]: Plan 8: Variant-driven ClarificationCard (chat/dashboard/hotspot) — single source of truth for severity copy + handlers across 3 surfaces
- [Phase 07]: Plan 8: ConversationalBot extension via 5 optional props w/ safe defaults — existing KotoIQPage caller untouched (backward-compat extension contract)
- [Phase 07]: Plan 8: position:fixed + raw getBoundingClientRect (no scrollX/Y) + capture-phase scroll listener — keeps HotspotDots anchored when scrolling inside scrollable shells
- [Phase 07]: Plan 8: Worst-severity-per-field grouping in ClarificationsOverlay — ONE HotspotDot per field with count badge mitigates T-07-26 by construction

### Pending Todos

None yet.

### Blockers/Concerns

yet. Research called out risks that are pre-mitigated in phase gates:

- Scaled-content-abuse policy → Phase 3 pre-flight gate (ADAPT-05)
- Elementor v4 atomic-widget save bugs (#32632 / #33000 / #35397) → Phase 2 `Document::save()` adapter (ELEM-04)
- Cross-agency data leak → Phase 1 foundation work (FND-01..05)
- Vercel function timeouts on bulk publish → Phase 4 Workflow orchestration (ORCH-01..05)
- kotoiq_pipeline_runs realtime publication ADD deferred — table doesn't exist on remote yet (in 20260419_kotoiq_automation.sql backlog); blocks D-23 live ribbon work in 07-04..07-08
- kotoiq_pipeline_runs writes will fail silently against current live DB until 7-migration prod backlog is applied — wrapped in try/catch + console.error; pipeline continues working but D-23 ribbon won't reflect durable state until backlog migration lands

### Phase 7 + Phase 8 UAT — UNBLOCKED (2026-04-21)

Both Phase 7 blockers resolved in this session:

1. **`/api/kotoiq/profile` 401 → FIXED (commit `b934d48`)** — root cause was `useAuth.jsx` dev-bypass diverging from server-side `verifySession()`. Client-side fakes a user + agencyId via `NEXT_PUBLIC_BYPASS_AUTH`, but `supabase.auth` had no real session, so `profileFetch` couldn't attach a Bearer token and every `verifySession()` route 401'd. Added symmetric dev-bypass in `src/lib/apiAuth.ts` (hard-gated on `NODE_ENV!=='production'`). Requires `NEXT_PUBLIC_BYPASS_AUTH=true` in `.env.local` — added this session. Prod auth unchanged.

2. **React "Expected static flag was missing" Sidebar crash on Turbopack** — workaround only; root fix deferred. Use `next dev --no-turbo` for dev UAT until Next 16.x / React 19 patches the fiber reconciliation bug (or until Sidebar is refactored to use `hidden` props instead of conditional JSX fragments at line 426).

**Phase 8 infra (2026-04-21):**
- ✅ Migration `20260520_kotoiq_agency_integrations` applied to prod Supabase (14 cols, 4 indexes, 1 trigger)
- ✅ Env vars set: `KOTO_AGENCY_INTEGRATIONS_KEK` (prod+preview+dev), `GOOGLE_CLIENT_ID/SECRET` (prod+preview+dev), `GOOGLE_PLACES_KEY` (prod+preview+dev). `NEXT_PUBLIC_GOOGLE_CLIENT_*` removed (was browser-leaking the OAuth secret).
- ✅ Phase 8 code patched to accept canonical env names (commit `9becf78`): `GOOGLE_CLIENT_ID || GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_PLACES_KEY || GOOGLE_PLACES_API_KEY`.
- ✅ Playwright Fluid Compute probe smoke-tested against prod: HTTP 200 / 4.56s / Node 24.14.1 / `@sparticuz/chromium` + `playwright-core` launched, navigated, returned a title. Phase 8 Plan 05 website crawl is viable.
- 🟡 **Plan 08-08 UI scope-cut** — zero JSX callers for `seed_form_url`, `seed_website`, `seed_upload`, `seed_gbp_*`. Declared "API-complete, UI v1 next milestone". PILOT-01 runs against Phase 7 internal ingest (Momenta already in Koto with onboarding data).

UAT test data still seeded (reuse for the gauntlet):
- FULL client: `45f441e2-dfa8-426f-a959-566c3a984065` (UAT_SEED__RDC Restoration (full))
- PARTIAL client: `82d1175a-68ed-4713-a4e7-640048220f5c` (UAT_SEED__Partial Restoration Co (gaps))
- Agency: `00000000-0000-0000-0000-000000000099` (Momenta Marketing)
- Cleanup SQL: `UPDATE clients SET deleted_at = now() WHERE name LIKE 'UAT_SEED__%';`

**M1 closure gates remaining:**
- Human UAT gauntlet on Phase 7 PROF-01..PROF-05 (unblocked — run `next dev --no-turbo`)
- PILOT-01 — 20 live hyperlocal pages on momentamktg.com with per-page KPI rollup, attribution, CWV, IndexNow confirmations

## Session Continuity

Last session: 2026-04-20T03:41:51.771Z
Stopped at: Phase 08 UI-SPEC approved
Resume file: .planning/phases/08-client-profile-seeder-v2-external-source-parsers/08-UI-SPEC.md

### Plan 1 Deliverables (COMPLETE)

- `supabase/migrations/20260505_kotoiq_builder.sql` — 10 tables + koto_wp_pages extensions + RLS policies
- `src/lib/kotoiqDb.ts` — `getKotoIQDb(agencyId)` helper with typed accessors for templates, campaigns, schema versions, builder sites

### Plan 2 Deliverables (COMPLETE)

- `eslint-rules/no-unscoped-kotoiq.mjs` — custom ESLint rule flagging unscoped kotoiq_* queries
- `eslint.config.mjs` updated to wire in the rule as `kotoiq/no-unscoped-kotoiq: error`

### Plan 3 Deliverables (COMPLETE)

- `wp-plugin/koto-builder-endpoints.php` — PHP endpoints: builder/detect, builder/pages, builder/elementor/{id} GET
- `src/app/api/wp/route.ts` — added detect_builder, list_elementor_pages, get_elementor_data proxy actions
- **Deploy note**: PHP file must be deployed to the WP plugin on momentamktg.com before endpoints work

### Plan 4 Deliverables (COMPLETE)

- `src/lib/builder/jsonPathUtils.ts` — stable ID-based deep-get/set for Elementor trees (no array indices)
- `src/lib/builder/elementorAdapter.ts` — captureSchema(), detectSlots() from live JSON
- `src/app/api/wp/route.ts` — added capture_elementor_schema action (fetches page → captures schema → persists → detects slots)

### Plan 5 Deliverables (COMPLETE — merged into Plan 4)

- `src/lib/builder/elementorAdapter.ts` — diffSchemas() classifies clean/additive/breaking drift
- capture_elementor_schema action auto-diffs against pinned schema and stores drift_status + drift_details
