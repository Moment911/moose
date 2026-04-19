---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 07-01-PLAN.md (Tasks 3-6 in continuation agent; Tasks 1-2 prior agent + operator)
last_updated: "2026-04-19T14:42:53.501Z"
last_activity: 2026-04-19
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 8
  completed_plans: 1
  percent: 13
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Agencies run every layer of a client engagement from a single white-label platform — now including closed-loop programmatic SEO that attributes dollars to pages.
**Current focus:** Phase 07 — client-profile-seeder-v1-internal-ingest-gap-finder

## Current Position

Phase: 07 (client-profile-seeder-v1-internal-ingest-gap-finder) — EXECUTING
Plan: 2 of 8
Status: Ready to execute
Last activity: 2026-04-19

Progress: [████████░░] 75% (6 of 8 phases code complete; pilot pending)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 07 P01 | 30min | 6 tasks | 10 files |

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

### Pending Todos

None yet.

### Blockers/Concerns

yet. Research called out risks that are pre-mitigated in phase gates:

- Scaled-content-abuse policy → Phase 3 pre-flight gate (ADAPT-05)
- Elementor v4 atomic-widget save bugs (#32632 / #33000 / #35397) → Phase 2 `Document::save()` adapter (ELEM-04)
- Cross-agency data leak → Phase 1 foundation work (FND-01..05)
- Vercel function timeouts on bulk publish → Phase 4 Workflow orchestration (ORCH-01..05)
- kotoiq_pipeline_runs realtime publication ADD deferred — table doesn't exist on remote yet (in 20260419_kotoiq_automation.sql backlog); blocks D-23 live ribbon work in 07-04..07-08

## Session Continuity

Last session: 2026-04-19T14:42:53.498Z
Stopped at: Completed 07-01-PLAN.md (Tasks 3-6 in continuation agent; Tasks 1-2 prior agent + operator)
Resume file: None

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
