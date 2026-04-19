---
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
plan: 04
subsystem: api

tags: [vitest, typescript, kotoiq, profile-seeder, anthropic, claude-sonnet, claude-haiku, sse, retell, pipeline-orchestrator, stage-0, d-22, prof-01, prof-02, prof-04]

# Dependency graph
requires:
  - phase: 07-01
    provides: ClientProfile + ProvenanceRecord + EntityGraphSeed types + getKotoIQDb(agencyId).clientProfile helpers + Vitest infra + tests/fixtures/profiles.ts (COMPLETE_PROFILE / PARTIAL_PROFILE / DISCREPANCY_PROFILE)
  - phase: 07-02
    provides: profileConfig (MODELS / FEATURE_TAGS / SEED_DEBOUNCE_SECONDS / MAX_VOICE_TRANSCRIPT_PULLS / MAX_PASTED_TEXT_CHARS / HOT_COLUMNS / STAGE_DEMANDS) + profileIngestInternal 4 deterministic pullers
  - phase: 07-03
    provides: profileExtractClaude (Sonnet pasted-text) + profileVoiceExtract (Haiku transcript) + profileDiscoveryExtract (Haiku per-section) + profileDiscrepancy (D-11 cross-source) + profileNarration (4 SSE primitives)
provides:
  - profileGraphSerializer.ts — profileToEntityGraphSeed (D-22) + profileToLegacyClientShape (hyperlocalContentEngine bridge)
  - profileRetellPull.ts — pullRetellTranscripts({clientId, agencyId}) → RetellCall[] with FK-chain isolation
  - profileGate.ts — computeCompleteness(profile) — Sonnet judge returning {completeness_score, completeness_reasoning, soft_gaps}
  - profileSeeder.ts — seedProfile({clientId, agencyId, pastedText?, forceRebuild?}) master Stage 0 orchestrator (D-21)
  - pipelineOrchestrator.ts (extended) — STAGE_NAMES prepends 'Profile' (Stage 0); 6 existing stage indices shifted; durable kotoiq_pipeline_runs writes around every stage transition
  - /api/kotoiq/profile/stream_seed/route.ts — SSE endpoint that narrates the full Stage 0 seed pipeline
  - 11 new vitest cases (5 graphSerializer + 4 gate + 2 seeder) — total project Vitest now 50/50
affects:
  - 07-05 (Clarification queue — may seed clarifications from seedProfile result.discrepancies + profileGate.soft_gaps)
  - 07-06 (Live ribbon — subscribes to kotoiq_pipeline_runs realtime once the table is on remote)
  - 07-07 (Operator field UX — reads profile + writes via getKotoIQDb.clientProfile.updateField/addField/deleteField)
  - 07-08 (Soft launch gate — wraps computeCompleteness)
  - hyperlocalContentEngine + semanticAgents* + eeatEngine + knowledgeGraphExporter (downstream consumers of EntityGraphSeed)

# Tech tracking
tech-stack:
  added: []   # no new dependencies — uses existing @supabase/supabase-js + Anthropic fetch + Vitest
  patterns:
    - "Lazy-import pattern at runStageSeedProfile boundary: pipelineOrchestrator.ts uses `await import('../kotoiq/profileSeeder')` instead of top-level import — avoids circular dep risk with kotoiqDb and keeps pipelineOrchestrator's startup cost lean"
    - "Per-stage steps jsonb append pattern: kotoiq_pipeline_runs has no current_stage/current_step columns; we append events to the steps jsonb column on every transition (stage start/end + final terminal state)"
    - "Defensive try/catch around every kotoiq_pipeline_runs write — table is part of 7-migration prod backlog and may not exist on remote yet (Phase 07-01 SUMMARY 'Known follow-ups')"
    - "Concurrency cap = 3 for both per-section discovery extraction and per-call voice transcript extraction — chosen to balance Anthropic rate limits against the PROF-01 <10s seed target"
    - "FK-chain isolation pattern (vs agency_id column): koto_onboarding_phone_pool has no agency_id, so pullRetellTranscripts relies on the upstream pullFromClient .eq('agency_id', agencyId) check to enforce isolation. Documented inline so future readers don't lose the isolation contract"

key-files:
  created:
    - src/lib/kotoiq/profileGraphSerializer.ts (Task 1, 3ce1aaa)
    - src/lib/kotoiq/profileRetellPull.ts (Task 2, 87c5409)
    - src/lib/kotoiq/profileGate.ts (Task 3, 8b0a9da)
    - src/lib/kotoiq/profileSeeder.ts (Task 5, 4e98cd5)
    - src/app/api/kotoiq/profile/stream_seed/route.ts (Task 6, d02d832)
    - tests/profileGraphSerializer.test.ts (Task 1, 3ce1aaa)
    - tests/profileGate.test.ts (Task 3, 8b0a9da)
    - tests/profileSeeder.test.ts (Task 5, 4e98cd5)
  modified:
    - src/lib/builder/pipelineOrchestrator.ts (Task 4, 1fd8816 — Stage 0 + DB writes + 6 si-index shifts)

key-decisions:
  - "kotoiq_pipeline_runs writes use the ACTUAL columns from 20260419_kotoiq_automation.sql (id, client_id, agency_id, status, steps jsonb, created_at, completed_at) — not the columns the plan assumed (current_stage, current_step, started_at, updated_at). Stage/step transitions append to the steps jsonb event log instead. Without this discovery, every write would error on first contact with the live DB."
  - "Every kotoiq_pipeline_runs write wrapped in try/catch + console.error per the system reminder — table is part of the 7-migration prod backlog and isn't on remote yet. The pipeline continues working when writes fail; the D-23 ribbon will light up once the backlog migration is applied. Documented as a Known follow-up below."
  - "Used getServiceClient via the existing local sb() helper at line 86 of pipelineOrchestrator.ts (not a kotoiqDb.raw() call as the plan suggested) — KotoIQDb interface has no raw() method; it has client: SupabaseClient instead. The local sb() returns the same service-role client. Cross-agency guard preserved by .eq('agency_id', agencyId) on every query."
  - "Stage 0 step count = 2 (load_profile + serialize_graph) — matches the STAGE_STEP_COUNTS = [2, 6, 5, 5, -1, -1, 3] entry verbatim from the plan. Both steps run sequentially inside runStageSeedProfile so a cancel between them is honoured by the cancelFlags check."
  - "stages_to_run default expanded from [1,2,3,4,5,6] to [1,2,3,4,5,6,7] — existing callers passing the old default still work but won't trigger the new Profile stage. Documented in code comment so callers know to opt in by omitting the option (or passing the full array)."
  - "Concurrency cap of 3 chosen for both discovery sections + voice transcripts — RESEARCH §10 cost envelope has 50K token/min headroom that comfortably supports 3 parallel Haiku calls. Going higher risks Anthropic rate-limit responses; going lower extends the seed past the PROF-01 <10s target on profiles with 6+ sections."
  - "D-10 margin notes derived rule-based (no extra LLM call) inside seedProfile — keeps Stage 0 cost flat. v2 may swap to a Haiku one-shot if the rule-based emphasis catches turn out to miss too many notable insights."

patterns-established:
  - "Plan 4 composition pattern — profileSeeder is the SINGLE place that imports every Plan 2 puller + Plan 3 extractor. Downstream callers (pipelineOrchestrator, stream_seed route) import seedProfile only. Prevents the merge-logic + sort-logic from duplicating across call sites."
  - "Stage 0 si=0 contract — every NEW pipeline stage prepended in the future bumps every existing si by 1. Plan 4's commit message documents the convention so the next phase that adds a stage knows the protocol."
  - "Streaming-narration error UX — errors caught inside the SSE controller's start() callback are surfaced as a final narration line (`I hit a snag: <message>. I'll carry on without it.`) rather than HTTP errors. Keeps the client's reader from seeing a dropped connection mid-stream."

requirements-completed: [PROF-01, PROF-02, PROF-04, PROF-06]

# Metrics
duration: ~21min
completed: 2026-04-19
---

# Phase 7 Plan 4: Stage 0 Composition + Streaming Narration Summary

**Six modules ship that compose Plans 2 + 3 into the full Stage 0 seeder (D-21): the master `seedProfile()` orchestrator that pulls every internal source, runs every Claude extractor, merges with operator-edit-wins-ties + descending-confidence, derives D-10 margin notes, and serializes the D-22 entity graph; the Sonnet completeness gate (PROF-04); the Retell `/list-calls` fetch helper with FK-chain isolation; the entity-graph serializer + legacy-shape projector; the `pipelineOrchestrator` extended with Stage 0 + durable `kotoiq_pipeline_runs` writes for the D-23 ribbon; and the SSE narration endpoint at `/api/kotoiq/profile/stream_seed` (PROF-01). 11 new Vitest cases green; 50/50 project total; tsc clean; build green.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-04-19T16:02:45Z
- **Completed:** 2026-04-19T16:23:24Z
- **Tasks:** 6 (4 with TDD: 1, 3, 5; 2 verify-only: 2, 4, 6)
- **Files created:** 8 (5 lib modules + 3 vitest suites)
- **Files modified:** 1 (pipelineOrchestrator.ts — Stage 0 + DB writes + 6 si-index shifts)

## Accomplishments

- **profileGraphSerializer.ts (Task 1)** — `profileToEntityGraphSeed(profile)` returns the exact 8-key D-22 shape (`client_node, service_nodes, audience_nodes, competitor_nodes, service_area_nodes, differentiator_edges, trust_anchor_nodes, confidence_by_node`). `profileToLegacyClientShape(profile)` returns the 8-field shape `hyperlocalContentEngine.ts:147` reads. Pure function (no `server-only`) so Plan 7 operator UI can render a live entity-graph preview without an HTTP roundtrip.

- **profileRetellPull.ts (Task 2)** — `pullRetellTranscripts({clientId, agencyId})` queries `koto_onboarding_phone_pool WHERE assigned_to_client_id = clientId`, calls Retell `/list-calls` per phone (capped at `MAX_VOICE_TRANSCRIPT_PULLS=10`), filters out transcripts shorter than 40 chars (matches the noise guard in profileVoiceExtract). FK-chain isolation documented inline since the phone pool table has no `agency_id` column — isolation flows through the upstream `pullFromClient` agency_id check. Phone numbers are NEVER accepted from arguments (T-07 mitigation).

- **profileGate.ts (Task 3)** — `computeCompleteness(profile)` calls Sonnet 4.5 with `STAGE_DEMANDS` from profileConfig, returns `{completeness_score (clamped [0,1]), completeness_reasoning, soft_gaps (capped at 15)}`. Falls back to score=0 + empty gaps on any failure (missing key, fetch throw, non-2xx, JSON parse fail) so the seeder never sees an exception. 20s `AbortSignal.timeout`. Logs via `FEATURE_TAGS.COMPLETENESS_GATE`.

- **pipelineOrchestrator.ts (Task 4)** — `STAGE_NAMES` now `['Profile','Ingest','Graph','Plan','Generate','Ship','Measure']`. `STAGE_STEP_COUNTS = [2,6,5,5,-1,-1,3]`. New `runStageSeedProfile()` lazy-imports `profileSeeder` + `profileGraphSerializer` and runs as Stage 0. All 6 existing `runStage*` functions had their `const si = N` bumped by 1 (Ingest 0→1, Graph 1→2, Plan 2→3, Generate 3→4, Ship 4→5, Measure 5→6). `runFullPipeline` now orchestrates 7 stages and writes to `kotoiq_pipeline_runs` on insert + every stage transition + terminal state. `runFullPipeline(config)` signature unchanged — existing callers (`/api/kotoiq/pipeline`) work without modification.

- **profileSeeder.ts (Task 5)** — `seedProfile({clientId, agencyId, pastedText?, forceRebuild?})` composes the full Stage 0 flow: debounce → 4 parallel internal pullers → per-section Haiku discovery (concurrency 3) → Retell transcripts + per-call Haiku extraction (concurrency 3) → optional pasted-text Sonnet extraction → merge with operator-edit-wins sort → promote hot columns → detect cross-source discrepancies → derive D-10 margin notes (rule-based, capped at 4) → upsert profile row → serialize D-22 entity graph + second upsert. Returns `{profile, discrepancies, sourcesAdded}`.

- **/api/kotoiq/profile/stream_seed/route.ts (Task 6)** — POST handler that auths via `verifySession` (agency_id NEVER from body — T-07-01d), validates pasted_text length against `MAX_PASTED_TEXT_CHARS=50000` (413 if over), pre-reads deterministic sources for first 3 narration lines (well within 500ms target), runs `seedProfile()`, narrates field count + discrepancies, closes with `streamHaikuWrapUp` Haiku stream + final newline. Headers from `narrationResponseHeaders()` (Content-Type=text/plain, Cache-Control=no-cache,no-transform, X-Accel-Buffering=no). `runtime='nodejs'` + `maxDuration=60`. Errors caught inside the SSE controller and surfaced as a final narration line so the client never sees an empty stream. Route registered as `ƒ /api/kotoiq/profile/stream_seed` (verified by `npm run build`).

## Task Commits

1. **Task 1: profileGraphSerializer — D-22 entity graph + legacy client shape** — `3ce1aaa` (feat) — TDD RED → GREEN, 5/5 pass on first run
2. **Task 2: profileRetellPull — Retell /list-calls fetch with FK-chain isolation** — `87c5409` (feat) — verify-only (no test file requested by plan)
3. **Task 3: profileGate — Sonnet completeness judge (PROF-04)** — `8b0a9da` (feat) — TDD RED → GREEN, 4/4 pass on first run
4. **Task 4: pipelineOrchestrator — Stage 0 + durable kotoiq_pipeline_runs writes** — `1fd8816` (feat) — verify-only; tsc reported expected unresolved import for `../kotoiq/profileSeeder` (resolved by Task 5)
5. **Task 5: profileSeeder — Stage 0 master orchestrator (D-21)** — `4e98cd5` (feat) — TDD RED → GREEN, 2/2 pass on first run; resolves Task 4's unresolved import
6. **Task 6: /api/kotoiq/profile/stream_seed — SSE narration endpoint (PROF-01)** — `d02d832` (feat) — verify-only; route registered, build green

**Plan metadata:** _to be filled by final docs commit_

## Files Created/Modified

**Created (5 lib + 3 tests + 1 route):**
- `src/lib/kotoiq/profileGraphSerializer.ts` — D-22 + legacy shape (250 LOC)
- `src/lib/kotoiq/profileRetellPull.ts` — Retell /list-calls helper (115 LOC)
- `src/lib/kotoiq/profileGate.ts` — Sonnet completeness judge (175 LOC)
- `src/lib/kotoiq/profileSeeder.ts` — master Stage 0 orchestrator (440 LOC)
- `src/app/api/kotoiq/profile/stream_seed/route.ts` — SSE endpoint (190 LOC)
- `tests/profileGraphSerializer.test.ts` — 5 vitest cases (D-22 keys, client_node id, service_nodes, confidence_by_node, legacy shape)
- `tests/profileGate.test.ts` — 4 vitest cases (PROF-04 ≤8 + ≤15 soft_gaps shapes, fallback on failure, score clamping)
- `tests/profileSeeder.test.ts` — 2 vitest cases (composition + debounce path; every dependency mocked)

**Modified:**
- `src/lib/builder/pipelineOrchestrator.ts` — Stage 0 (`runStageSeedProfile`), STAGE_NAMES + STAGE_STEP_COUNTS shift, 6 `const si = N` bumps, `pipelineRunInsert` + `pipelineRunUpdateStage` helpers, expanded `runFullPipeline` IIFE (6 → 7 stages + DB writes around every transition)

## Decisions Made

- **kotoiq_pipeline_runs ACTUAL schema vs PLAN ASSUMED schema** — The plan instructed writing to `current_stage`, `current_step`, `started_at`, `updated_at` columns. The actual table (defined in `20260419_kotoiq_automation.sql`) has `id, client_id, agency_id, keyword, status, ..., steps jsonb, created_at, completed_at` — none of the 4 columns the plan assumed. Decision: append every stage/step transition as an event object inside the `steps` jsonb column. Without this discovery + adjustment, every write would error against the live DB the moment the migration backlog is applied.

- **Try/catch every kotoiq_pipeline_runs write** — Per the system reminder + Phase 07-01 SUMMARY, the table is part of the 7-migration prod backlog NOT yet applied. Writes are wrapped in `try/catch` + `console.error`. The pipeline continues working; the D-23 ribbon will light up once the backlog migration is applied. The error log is the only signal an operator sees during the gap.

- **getKotoIQDb.client (not .raw())** — The plan instructed `getKotoIQDb(agencyId).raw().from('kotoiq_pipeline_runs')`. The `KotoIQDb` interface has no `raw()` method — it has `client: SupabaseClient` instead. Plus `kotoiq_pipeline_runs` is NOT in `DIRECT_AGENCY_TABLES`, so the scoping helper won't auto-inject `agency_id`. Used the local `sb()` helper at line 86 of `pipelineOrchestrator.ts` (the same service-role client) and added `.eq('agency_id', agencyId)` explicitly on every query.

- **Concurrency cap = 3 for both discovery + voice extraction** — Anthropic rate limits + RESEARCH §10 cost envelope balance against the PROF-01 <10s seed target. Going to 5+ risks 429 responses on profiles with many sections; staying at 1 sequential serializes the seed unnecessarily. Empirical first-call latency for Haiku 4.5 is ~1.5-2.5s — 3-way parallel keeps the worst-case section batch under 3s.

- **D-10 margin notes — rule-based, NOT a Claude call** — RESEARCH §10 cost envelope only allows ~$0.03-$0.06 per seed; adding a per-seed Haiku call for margin notes would add ~$0.0007/call (manageable) but the rule-based path covers the high-signal cases (voice `pain_point_emphasis` + 4 keyword-frequency emphases) without the extra fetch latency. v2 may swap to Haiku one-shot if rule-based misses too many notable insights.

- **stages_to_run default expanded** — Old default `[1,2,3,4,5,6]`; new default `[1,2,3,4,5,6,7]`. Existing callers explicitly passing `[1,2,3,4,5,6]` still work but won't run Stage 1 (Profile). Documented in code comment so callers know they need to opt in by omitting the option (or passing the full 7-element array).

- **Lazy import in runStageSeedProfile** — `pipelineOrchestrator.ts → seedProfile → kotoiqDb → @supabase/supabase-js` is a heavy dependency tree to instantiate at module load. Lazy `await import()` defers the cost to first run + sidesteps any circular-import risk if the seeder ever imports back into the orchestrator.

- **Stream-narration error UX** — Errors caught inside the SSE controller's `start()` callback are surfaced as a final narration line (`I hit a snag: <message>. I'll carry on without it.`) instead of bubbling as HTTP errors. The client `getReader()` keeps draining; no dropped-connection state to handle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] kotoiq_pipeline_runs schema mismatch — plan assumed columns that don't exist**
- **Found during:** Task 4 — when reading the actual migration file the plan instructed me to grep
- **Issue:** Plan instructed writing to `current_stage`, `current_step`, `started_at`, `updated_at` columns. Actual schema in `20260419_kotoiq_automation.sql` has NONE of those columns — it has `id, client_id, agency_id, keyword, status, ..., steps jsonb, created_at, completed_at`. Without correction, every write would have crashed at the first stage transition (once the table reaches remote).
- **Fix:** Refactored `pipelineRunInsert` + `pipelineRunUpdateStage` to append stage/step transitions as JSON event objects inside the `steps` jsonb column. Status updates use the existing `status` column. Terminal states write to `completed_at`. The plan's spirit (durable per-stage state for the D-23 ribbon) is preserved — just stored differently.
- **Files modified:** `src/lib/builder/pipelineOrchestrator.ts`
- **Verification:** `npm run build` exits 0; tsc clean
- **Committed in:** `1fd8816` (folded into Task 4 commit)

**2. [Rule 3 - Blocking] getKotoIQDb interface has no raw() method**
- **Found during:** Task 4 — reading kotoiqDb.ts to plan the agency-scoped write
- **Issue:** Plan instructed `getKotoIQDb(agencyId).raw().from('kotoiq_pipeline_runs')`. The `KotoIQDb` interface (Plan 1 deliverable) does not export a `raw()` method — it has `client: SupabaseClient` instead, and a `from()` method that auto-scopes for `DIRECT_AGENCY_TABLES`. `kotoiq_pipeline_runs` is NOT in that set (it predates the kotoiqDb helper).
- **Fix:** Used the existing local `sb()` helper at line 86 of pipelineOrchestrator.ts (same service-role client) wrapped in a `pipelineRunsTable()` accessor. Cross-agency guard preserved by adding `.eq('agency_id', agencyId)` explicitly to every read/write — verified by acceptance grep `.eq('agency_id', agencyId)` appears on every `kotoiq_pipeline_runs` query.
- **Files modified:** `src/lib/builder/pipelineOrchestrator.ts`
- **Verification:** Acceptance grep confirms `.eq('agency_id', agencyId)` on every kotoiq_pipeline_runs query
- **Committed in:** `1fd8816` (folded into Task 4 commit)

**3. [Rule 1 - Bug] tests/fixtures/profiles.ts missing margin_notes field on Partial<ClientProfile>**
- **Found during:** Task 1 — first test run
- **Issue:** ClientProfile type (Plan 1) requires `margin_notes` field. The test helper `mkProfile` in `tests/profileGraphSerializer.test.ts` was missing it; would have type-erred under strict tsc.
- **Fix:** Added `margin_notes: []` to the `mkProfile` defaults in both `tests/profileGraphSerializer.test.ts` and `tests/profileGate.test.ts`.
- **Files modified:** `tests/profileGraphSerializer.test.ts`, `tests/profileGate.test.ts`
- **Verification:** tsc clean; tests pass
- **Committed in:** `3ce1aaa` (Task 1) + `8b0a9da` (Task 3)

---

**Total deviations:** 3 auto-fixed (1 plan-vs-reality schema mismatch, 1 plan-vs-interface API mismatch, 1 type-shape miss in test fixture).
**Impact on plan:** All three are corrections that PRESERVE plan intent — the schema split satisfies durable-ribbon writes against the actual table; the kotoiqDb pattern preserves cross-agency isolation via explicit `.eq('agency_id', ...)`; the margin_notes addition keeps the fixtures type-correct.

## Issues Encountered

- **Pre-existing unrelated changes in working tree** — Several files (`src/app/api/billing/route.ts`, `src/app/api/calendar/route.ts`, `src/app/api/proposals/builder/route.ts`, `src/app/api/proposals/route.ts`, `src/app/api/track/[token]/route.ts`, `src/app/api/voice/webhook/route.ts`, `src/lib/smsService.ts`, `.planning/config.json`, `supabase/.temp/cli-latest`, scout/* additions) were modified or added by other concurrent agents during this plan's execution. None were staged or committed by me; all my commits added only the files I authored.
- **`npm run lint` (project-wide) OOMs on `.obsidian/plugins/dataview/main.js`** — pre-existing repo issue (documented in Plan 2 SUMMARY); no action needed for this plan.

## Threat Model Coverage

| Threat ID | Mitigation status |
|---|---|
| T-07-01d (agencyId spoofed via request body) | **Mitigated.** stream_seed route reads agencyId from `verifySession` only; body.agency_id ignored. `pipelineRunUpdateStage` filters `.eq('agency_id', agencyId)` on every write. |
| T-07-05 (pipelineOrchestrator additions break existing callers) | **Mitigated.** STAGE_NAMES shift is additive (Profile prepended); `runFullPipeline(config)` signature unchanged; in-memory `activeRuns` Map preserved as fast read path; existing API caller (`/api/kotoiq/pipeline`) works without modification. |
| T-07-13 (kotoiq_pipeline_runs schema mismatch loop) | **Mitigated.** Every write wrapped in try/catch + console.error; never throws back to runFullPipeline. Pipeline continues even if writes fail. |
| T-07-07c (SSE connection kept open forever) | **Mitigated.** maxDuration=60 caps the request. Seeder internal timeouts (20s gate, 15s per Haiku, 30s per Sonnet) bound total time. |
| T-07-07a (DoS via repeated stream_seed POSTs to burn tokens) | **Mitigated.** SEED_DEBOUNCE_SECONDS=30 inside seedProfile refuses re-seed (without forceRebuild AND without pastedText). Pasted-text capped at MAX_PASTED_TEXT_CHARS=50000. |
| T-07 (Retell transcript leak) | **Mitigated.** pullRetellTranscripts queries phones ONLY where assigned_to_client_id=clientId. Phone numbers are never accepted from arguments. FK-chain isolation flows through upstream pullFromClient .eq('agency_id', agencyId). Documented inline so future readers don't lose the contract. |

## Threat Flags

None — plan stayed within its declared `<threat_model>` surface. The new SSE endpoint is the only new network boundary; it's auth-gated by verifySession, agencyId-scoped from session, and cost-bounded by maxDuration + seeder internal timeouts.

## Known Stubs

None. All 5 lib modules and the route are real implementations. The two upserts in `seedProfile` are intentional (the plan called for separate fields-row + entity_graph_seed-row writes so the entity graph reflects the persisted profile).

## Known Follow-ups

- **kotoiq_pipeline_runs writes will fail silently against the current live DB until the 7-migration prod backlog is applied.** The table doesn't exist on remote yet (Phase 07-01 SUMMARY "Known follow-ups"). All writes are wrapped in try/catch + console.error; the pipeline continues working. Once the backlog is applied:
  - Remove the try/catch guards in `pipelineRunInsert` + `pipelineRunUpdateStage` (or keep them as defensive — operator's call)
  - The D-23 live ribbon (Plan 6) will start reflecting durable state
  - Consider a one-line follow-up migration adding `kotoiq_pipeline_runs` to `supabase_realtime` publication so realtime subscribers light up immediately
- **kotoiq_pipeline_runs schema check before next phase that touches it** — Plan 4 found that `current_stage`, `current_step`, `started_at`, `updated_at` columns assumed by the planner do not exist. If the D-23 ribbon work in Plan 6 wants those columns, either:
  - (a) Add them in a new migration (additive — no breakage), then update `pipelineRunUpdateStage` to write to them in addition to the steps jsonb event log
  - (b) Read state out of the existing `steps` jsonb column (the last event = current state) — the data is already there, just shaped differently
- **Concurrent-agent commit hygiene** — During this plan's execution, other agents had unrelated working-tree changes. All my commits stayed atomic by `git add`-ing only the specific Plan 4 files. Future plans on this main-tree-only repo may want to: (a) re-enable worktrees, (b) introduce a per-agent commit lock, or (c) accept the noise and rely on file-history grep for attribution.
- **Token-usage parsing in streamHaikuWrapUp** — Inherited from Plan 3 (estimate-only token logging because text_delta SSE doesn't carry usage). Plan 4 stream_seed route inherits the imprecision. Plan 5 or beyond may parse `message_stop` events for true usage.

## kotoiq_pipeline_runs Column Reference (for future maintenance)

Actual columns from `supabase/migrations/20260419_kotoiq_automation.sql`:

| Column | Type | Used by Plan 4 |
|---|---|---|
| id | uuid PK (we provide) | ✅ insert + update key |
| client_id | uuid FK | ✅ insert |
| agency_id | uuid FK | ✅ insert + every update guard |
| keyword | text | not used (legacy column) |
| status | text | ✅ 'running' / 'completed' / 'failed' / 'cancelled' |
| human_score | numeric | not used |
| topicality_score | numeric | not used |
| plagiarism_score | numeric | not used |
| on_page_score | numeric | not used |
| brief_id | uuid | not used |
| content_html | text | not used |
| plain_text | text | not used |
| schema_json_ld | jsonb | not used |
| steps | jsonb | ✅ append-only event log of stage/step transitions |
| auto_published | boolean | not used |
| published_url | text | not used |
| created_at | timestamptz | ✅ insert default-now |
| completed_at | timestamptz | ✅ written on terminal-state update |

The `steps` jsonb append shape: `{ stage: string, step: string|null, status: 'running'|'completed'|'failed'|'cancelled', at: ISO timestamp }`.

## P50 Latency from POST → first narration line

Not measured — manual smoke test deferred until the operator session can drive it (requires a valid agency session cookie + a real client_id with at least one koto_onboarding_recipients row). The endpoint code structure makes the first-line target very achievable: `Promise.all` of 4 deterministic Supabase queries (no Claude) before the first `writeNarrationLine` — typical Supabase round-trip is 80-200ms; first line should fire well within the 500ms target. The Plan 5/6 UI work that drives the live test will produce the actual P50.

## User Setup Required

None for the lib/route work. Operator setup needed before D-23 live ribbon shows updates:
1. Apply the `20260419_kotoiq_automation.sql` migration to live Supabase (currently in the 7-migration prod backlog)
2. Optional: add `kotoiq_pipeline_runs` to `supabase_realtime` publication so Plan 6's ribbon subscribers receive realtime events

## Next Phase Readiness

Plan 5 (Clarification queue — chat widget + dashboard) can now build on:
- `seedProfile()` returns `{ profile, discrepancies }` — discrepancies feed clarification candidates
- `computeCompleteness()` returns `soft_gaps` — also a clarification candidate source
- 50/50 vitest baseline — no regressions to maintain

Plan 6 (Live pipeline ribbon — D-23) can now build on:
- `kotoiq_pipeline_runs` rows being written on every stage transition (once the migration backlog lands)
- The `steps` jsonb event log gives a complete chronological history per run for the ribbon's "history" view
- `STAGE_NAMES` is now exported as a 7-element array (Profile → Measure)

Plan 7 (Operator field UX) can now build on:
- `profileToEntityGraphSeed` is a pure function — Plan 7 can render a live entity-graph preview as the operator edits without an HTTP roundtrip
- `seedProfile({ pastedText })` accepts the D-25 dropzone paste flow

Plan 8 (Soft launch gate) can now build on:
- `computeCompleteness(profile)` is the gate — Plan 8 wraps it with the launch button + soft_gaps display

**No blockers for downstream plans.** The kotoiq_pipeline_runs follow-up only affects the visibility of D-23 ribbon updates, not the correctness of any Plan 5-8 logic.

## Self-Check: PASSED

All claimed files exist and all commits are in `git log`:
- src/lib/kotoiq/profileGraphSerializer.ts — FOUND
- src/lib/kotoiq/profileRetellPull.ts — FOUND
- src/lib/kotoiq/profileGate.ts — FOUND
- src/lib/kotoiq/profileSeeder.ts — FOUND
- src/app/api/kotoiq/profile/stream_seed/route.ts — FOUND
- tests/profileGraphSerializer.test.ts — FOUND
- tests/profileGate.test.ts — FOUND
- tests/profileSeeder.test.ts — FOUND
- src/lib/builder/pipelineOrchestrator.ts — MODIFIED
- Commit 3ce1aaa — FOUND (Task 1)
- Commit 87c5409 — FOUND (Task 2)
- Commit 8b0a9da — FOUND (Task 3)
- Commit 1fd8816 — FOUND (Task 4)
- Commit 4e98cd5 — FOUND (Task 5)
- Commit d02d832 — FOUND (Task 6)
- `npm test` — 50/50 green
- `npx tsc --noEmit` — 0 errors
- `npm run build` — exits 0; route registered as `ƒ /api/kotoiq/profile/stream_seed`

---
*Phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder*
*Completed: 2026-04-19*
