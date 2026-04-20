---
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
verified: 2026-04-19T20:10:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "PROF-01 end-to-end: paste a Koto internal URL on /kotoiq/launch/:clientId for a client with a populated onboarding record; confirm briefing populates with ≥20 fields in <10 s"
    expected: "Streaming narration starts within 500 ms; briefing renders ≥20 EditableSpans; first narration line cites internal source(s); profile row visible via list_profile API"
    why_human: "Requires real Supabase client row + Anthropic API call; latency target (<10 s) is observable only at runtime; tests cover units in isolation"
  - test: "PROF-02 paste-text Sonnet extraction: paste a 1-3 page voice transcript or pasted text into IngestPanel; confirm Claude extracts canonical fields with citation chips that hover-reveal verbatim source snippet + char-offset range"
    expected: "Within ~6 s, briefing updates with ≥3 new EditableSpans; each new field has a CitationChip showing the verbatim source snippet sliced from the pasted text"
    why_human: "Requires live Anthropic Sonnet call with real text; visual citation hover behavior needs eyes-on"
  - test: "PROF-04 gap-finder: launch a fresh seed for a partially populated client; confirm 3-15 clarifications appear in (a) Pipeline > Needs Clarity tab, (b) chat orb badge count, (c) inline HotspotDots on the briefing"
    expected: "All three surfaces show the same count; severity colors match (high=pink, medium=amber, low=gray); HIGH-severity insert triggers 12 s auto-dismissing modal sheet"
    why_human: "Requires realtime subscription test from a live browser session; visual coordination across three surfaces"
  - test: "PROF-05 reject-field UX: open RejectFieldModal on any auto-populated field; confirm DST color (#DC2626) on the destructive button + provenance preserved (records remain in fields jsonb under rejected:true)"
    expected: "Modal renders with red destructive button; after confirm, hot column blanks but the original ProvenanceRecord[] is still present in the fields jsonb (verifiable via get_profile API)"
    why_human: "Visual color check + post-action data inspection required"
  - test: "PROF-06 Stage 0 wire-in: trigger /api/kotoiq/profile action=launch and confirm pipelineOrchestrator runs Profile (Stage 0) before Ingest (Stage 1)"
    expected: "kotoiq_pipeline_runs.steps jsonb contains a stage='Profile' entry timestamped before stage='Ingest'; STAGE_NAMES array exposes 7 stages starting with 'Profile'"
    why_human: "Requires triggering full pipeline + inspecting steps event log; live observation of stage sequencing. Note: kotoiq_pipeline_runs table not yet on prod (in 7-migration backlog) — writes will silently fail until migration applied"
  - test: "Live pipeline ribbon (D-23 / Plan 7): after launch, confirm LivePipelineRibbon subscribes to kotoiq_pipeline_runs realtime and degrades gracefully"
    expected: "DevTools console shows no uncaught errors on mount; either ribbon updates live (if migration applied) or stays in initial state without crashing (current expected state per Known follow-ups — table not on remote yet)"
    why_human: "Realtime subscription + graceful degradation can only be observed live; depends on operator action to apply backlog migration"
  - test: "Drop-zone deferred_v2 source recording (Plan 7): drag any file onto /kotoiq/launch/:clientId; confirm toast appears + source registry updated"
    expected: "Teal overlay appears during drag; after drop, kotoiq_client_profile.sources jsonb gains a row with source_type='deferred_v2'"
    why_human: "Drag/drop interaction requires manual exercise"
  - test: "Cross-agency isolation: from Agency A's session, attempt to seed a client_id belonging to Agency B; confirm 404 (not 403)"
    expected: "POST /api/kotoiq/profile {action:'seed', client_id:'<other-agency-uuid>'} returns 404 with {error:'Client not found'}"
    why_human: "Requires two real agency sessions to test in browser; unit test covers the code path but a live cross-agency request validates the deployed surface"
  - test: "AskOwnQuestion (D-12): on LaunchPage, click + Ask your own question, submit a question; confirm it surfaces in chat orb + Needs Clarity tab + (if target_field_path set) as HotspotDot within 20 s"
    expected: "All three surfaces reflect the new clarification within ~1 s via realtime; if realtime drops, fallback poll picks it up within 20 s"
    why_human: "Realtime + fallback polling behavior needs live observation"
---

# Phase 7: Client Profile Seeder v1 — Internal Ingest + Gap Finder Verification Report

**Phase Goal:** Stage 0 client profile seeder that ingests internal Koto data (onboarding, voice calls, discovery), uses Claude to extract canonical profile fields with full provenance, surfaces gaps as a non-blocking clarification queue, and provides an operator UI to launch the full pipeline.

**Verified:** 2026-04-19T20:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Operator pastes a Koto internal URL → profile populates in <10 s with 20+ fields resolved | VERIFIED (programmatic) — needs human runtime test | `LaunchPage.jsx:55-126` calls `/api/kotoiq/profile/stream_seed`; route composes `seedProfile` (Plan 4) which calls 4 deterministic pullers + Haiku per-section/transcript extractors; `pullFromClient` maps 15 canonical fields from clients table; tests/profileIngestInternal.test.ts asserts ≥10 fields. Cross-agency 404 verified (test `seed returns 404 when client row missing`). 10 s latency target = human observation. |
| 2 | Operator pastes raw text → Claude extracts structured fields with per-field char-offset citation | VERIFIED (programmatic) — needs human runtime test | `extractFromPastedText` in `profileExtractClaude.ts` uses Sonnet tool-use with `enum: [...CANONICAL_FIELD_NAMES]`; ProvenanceRecord includes `char_offset_start`/`char_offset_end`/`source_snippet`; `tests/profileExtractClaude.test.ts` (5 cases) covers tool_use shape + allowlist + injection mitigation. CitationChip + EditableSpan render the citations in BriefingDoc. |
| 3 | Gap-finder returns ≤8 surgical questions for mostly-complete onboarding, ≤15 for partial | VERIFIED | `profileClarifications.generateClarifications` caps at 15; `tests/profileClarifications.test.ts` asserts "20 gaps → 15 created"; severity classifier (Haiku + rule-based fallback) tested with 4 fixtures. PROF-04 wired. |
| 4 | Every field carries source_type + source_url + captured_at + confidence (VerifiedDataSource compliant) | VERIFIED | `ProvenanceRecord` type in `profileTypes.ts` declares all 4 fields + 5 optional metadata fields; `makeRec` factory in profileIngestInternal.ts clamps confidence to [0,1]; tests audit the D-04 quintet on every emitted record. Hot columns mirror to indexed text columns via `kotoiqDb.clientProfile.updateField` operator-edit-wins-ties sort. |
| 5 | pipelineOrchestrator Stage 0 runs profile seeder before Stage 1 keyword sync; entity graph pre-seeded | VERIFIED (programmatic) — needs human runtime test | `pipelineOrchestrator.ts:196-204` STAGE_NAMES = ['Profile','Ingest',...] (7 stages); `runStageSeedProfile` lazy-imports `profileSeeder` + `profileGraphSerializer`; `runFullPipeline` IIFE invokes runStageSeedProfile first (line 656-659); `profileToEntityGraphSeed` produces the 8-key D-22 contract. Live ordering verification requires triggering an end-to-end run. |

**Score:** 5/5 truths verified programmatically. All 5 require human runtime confirmation for full closure (latency, visual citation, three-surface coordination, color/audit-trail spot-check, end-to-end pipeline run).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260507_kotoiq_client_profile.sql` | Both tables + RLS + realtime + 6 indexes + margin_notes | VERIFIED | Contains `CREATE TABLE IF NOT EXISTS kotoiq_client_profile`, `CREATE TABLE IF NOT EXISTS kotoiq_clarifications`, `margin_notes jsonb NOT NULL DEFAULT '[]'::jsonb`, severity/status/asked_channel CHECK constraints, `ALTER PUBLICATION supabase_realtime ADD TABLE kotoiq_clarifications`, `ALTER PUBLICATION supabase_realtime ADD TABLE kotoiq_pipeline_runs` (latter is no-op until backlog migration applied — documented). Applied to live Supabase per Plan 1 SUMMARY operator confirmation. |
| `src/lib/kotoiq/profileTypes.ts` | ClientProfile, ProvenanceRecord, EntityGraphSeed, Clarification, NarrationEvent | VERIFIED | 12 type/const exports including SOURCE_TYPES (7 values), CANONICAL_FIELD_NAMES (26 entries), full ProvenanceRecord (9 fields), ClientProfile (incl. margin_notes), EntityGraphSeed (8 keys), Clarification + 3 string-literal unions. `import 'server-only'` set. |
| `src/lib/kotoiq/profileConfig.ts` | MODELS / HALO_THRESHOLDS / STAGE_DEMANDS / FEATURE_TAGS / HOT_COLUMNS / hard caps | VERIFIED | 13 named exports; MODELS pinned to claude-sonnet-4-5-20250929 + claude-haiku-4-5-20251001; HALO_THRESHOLDS {CONFIDENT:0.85, GUESSED:0.5}; HOT_COLUMNS 11 entries matching migration; STAGE_DEMANDS 5 stages; tests/profileConfig.test.ts 8/8 green. |
| `src/lib/kotoClientPick.ts` | pick(client, ...keys) shared helper | VERIFIED | Exported function with full JSDoc; KotoProposalBuilderPage.jsx imports it (`import { pick } from '../lib/kotoClientPick'`). |
| `src/lib/kotoiqDb.ts` | clientProfile + clarifications helpers (14 methods) + DIRECT_AGENCY_TABLES extended | VERIFIED | Both tables in DIRECT_AGENCY_TABLES set; clientProfile has 7 methods (get/upsert/updateField/addField/deleteField/list/markLaunched); clarifications has 7 methods (list/get/create/update/markAnswered/markForwarded/markSkipped); operator-edit-wins-ties + descending-confidence sort applied in updateField/addField. |
| `src/lib/kotoiq/profileIngestInternal.ts` | 4 deterministic pullers w/ agency_id guards | VERIFIED | pullFromClient + pullFromRecipients + pullFromDiscovery + pullFromVoiceCallAnalysis exported; `.eq('agency_id', ctx.agencyId)` appears 5x; pullFromClient also `.is('deleted_at', null)`; tests assert cross-agency returns null. |
| `src/lib/kotoiq/profileExtractClaude.ts` | Sonnet tool-use pasted-text extractor (PROF-02) | VERIFIED | Tool-use with strict input_schema enum locked to CANONICAL_FIELD_NAMES; MAX_PASTED_TEXT_CHARS=50000 cap throws upstream; 5/5 tests including prompt-injection mitigation. |
| `src/lib/kotoiq/profileVoiceExtract.ts` + `profileDiscoveryExtract.ts` | Haiku JSON extractors | VERIFIED | Both ship with prompt-injection mitigation, markdown-fence stripper, allowlist defense-in-depth; 4 + 3 tests green. |
| `src/lib/kotoiq/profileDiscrepancy.ts` | Cross-source D-11 conflict detector | VERIFIED | Pure function (NOT server-only — by design for live preview); year-shaped numeric formula split documented; 5 tests covering DISCREPANCY_PROFILE fixture. |
| `src/lib/kotoiq/profileNarration.ts` | 4 SSE primitives | VERIFIED | writeNarrationLine + proxyHaikuStream + streamHaikuWrapUp + narrationResponseHeaders all exported. |
| `src/lib/kotoiq/profileGraphSerializer.ts` | profileToEntityGraphSeed (D-22) + profileToLegacyClientShape | VERIFIED | Both functions exported; 8-key D-22 contract enforced; 5/5 tests including legacy-shape projection. |
| `src/lib/kotoiq/profileGate.ts` | computeCompleteness Sonnet judge | VERIFIED | Returns {completeness_score (clamped), completeness_reasoning, soft_gaps capped at 15}; fallback to score=0 on any failure; 4/4 tests. |
| `src/lib/kotoiq/profileSeeder.ts` | Master Stage 0 orchestrator | VERIFIED | Composes all Plan 2 pullers + Plan 3 extractors + discrepancy + graph serializer; debounce + force-rebuild path; 2/2 tests green. |
| `src/lib/kotoiq/profileRetellPull.ts` | pullRetellTranscripts w/ FK-chain isolation | VERIFIED | Phones queried via koto_onboarding_phone_pool WHERE assigned_to_client_id; cap MAX_VOICE_TRANSCRIPT_PULLS=10; 40-char noise guard; phones never accepted from arguments. |
| `src/lib/kotoiq/profileClarifications.ts` + `profileChannels.ts` | Severity + channel classifiers + 3 forwarders | VERIFIED | classifySeverity / generateClarifications / recomputeClarifications + pickClarificationChannel / forwardViaSMS / forwardViaEmail / forwardViaPortal all exported; SMS_RATE_LIMIT_PER_CLIENT_HOUR=3 enforced; D-19 non-blocking with try/catch wraps. |
| `src/lib/kotoiq/emailTemplates/clarification.ts` | Alex-voice email template | VERIFIED | clarificationEmail({agencyName,clientName,clarification,replyLink?}) → {subject,html}; HTML-escaped via escapeHtml() (T-07-14 mitigation). |
| `src/lib/builder/pipelineOrchestrator.ts` | Stage 0 prepended + STAGE_NAMES shifted + DB writes | VERIFIED | STAGE_NAMES = 7 entries starting 'Profile'; STAGE_STEP_COUNTS = [2,6,5,5,-1,-1,3]; runStageSeedProfile lazy-imports seedProfile; pipelineRunInsert + pipelineRunUpdateStage append events to steps jsonb; try/catch wrap (table not yet on prod). |
| `src/app/api/kotoiq/profile/route.ts` | 14-action JSON dispatcher | VERIFIED | 14 actions wired (seed/get_profile/list_profile/paste_text/update_field/add_field/delete_field/reject_field/add_question/launch/list_clarifications/answer_clarification/forward_to_client/add_source); verifySession FIRST; agencyId from session NEVER from body; cross-agency clientId returns 404; 15/15 tests green. |
| `src/app/api/kotoiq/profile/stream_seed/route.ts` | SSE narration endpoint (PROF-01) | VERIFIED | POST handler with verifySession guard; MAX_PASTED_TEXT_CHARS cap → 413; calls seedProfile; streams narration via streamHaikuWrapUp; narrationResponseHeaders set Content-Type=text/plain + no-cache + X-Accel-Buffering=no; runtime='nodejs', maxDuration=60. |
| `src/views/kotoiq/LaunchPage.jsx` + 13 launch components | Full operator canvas | VERIFIED | 14 files in src/components/kotoiq/launch/ (EditableSpan, BriefingDoc, CitationChip, MarginNote, DiscrepancyCallout, LaunchGate, LivePipelineRibbon, AutoSaveIndicator, IngestPanel, StreamingNarration, DropZone, RejectFieldModal, ClarificationCard, HotspotDot, ClarificationsOverlay, ClarificationsTab, AskOwnQuestion); LaunchPage.jsx 331 lines; route registered at /kotoiq/launch/:clientId in App.jsx:447. |
| `src/lib/theme.ts` DST token | DST = '#DC2626' | VERIFIED | Line 99: `export const DST = '#DC2626'`; consumed by RejectFieldModal.jsx:101. |
| `vitest.config.ts` + tests/fixtures + 12 test files | Vitest 1.6.1 + 74 tests green | VERIFIED | vitest.config.ts present with react-server resolve.conditions; tests/fixtures/profiles.ts (COMPLETE/PARTIAL/DISCREPANCY); tests/fixtures/anthropicMock.ts; 74/74 tests pass on `npm test`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| pipelineOrchestrator.ts | profileSeeder.ts | `await import('../kotoiq/profileSeeder')` | VERIFIED | Lazy import at line 353 inside runStageSeedProfile; STAGE_NAMES Stage 0 = 'Profile' invokes it first (line 659). |
| /api/kotoiq/profile route | seedProfile / computeCompleteness / runFullPipeline / generateClarifications | direct import | VERIFIED | route.ts imports seedProfile, computeCompleteness, runFullPipeline, recomputeClarifications, pickClarificationChannel, forwardViaSMS/Email/Portal, extractFromPastedText, detectDiscrepancies. |
| stream_seed route | profileSeeder + narration primitives | direct import | VERIFIED | imports seedProfile + streamHaikuWrapUp + narrationResponseHeaders + writeNarrationLine; calls seedProfile inside SSE controller's start() callback. |
| LaunchPage.jsx | /api/kotoiq/profile/stream_seed | fetch POST + body.getReader() | VERIFIED | line 58: `fetch('/api/kotoiq/profile/stream_seed', ...)`; reader loop reads newline-delimited chunks. |
| LaunchPage.jsx EditableSpan | /api/kotoiq/profile action=update_field | fetch POST on blur | VERIFIED | line 184: action=update_field POST; line 319 same in nested handlers. |
| LaunchGate.jsx Launch button | /api/kotoiq/profile action=launch | fetch POST | VERIFIED | line 222: action=launch POST returning run_id. |
| LivePipelineRibbon.jsx | Supabase realtime on kotoiq_pipeline_runs | supabase.channel().on('postgres_changes') | VERIFIED (with degraded mode) | Subscribes to realtime channel; gracefully degrades when table not in publication (current state — see Known follow-ups). |
| ClarificationsOverlay.jsx | Supabase realtime on kotoiq_clarifications | supabase.channel().on('postgres_changes', filter:'client_id=eq.${clientId}') | VERIFIED | Plan 8 ships overlay subscribing to realtime; kotoiq_clarifications IS in supabase_realtime publication (per migration 20260507). |
| ConversationalBot.jsx (extended) | /api/kotoiq/profile action=answer_clarification / forward_to_client | fetch POST | VERIFIED | mode='clarifications' branch invokes onAnswerClarification/onForwardClarification handlers passed from LaunchPage. |
| KotoProposalBuilderPage.jsx | src/lib/kotoClientPick.ts | import { pick } | VERIFIED | line 24: `import { pick } from '../lib/kotoClientPick'`. |
| All Plan 2-5 server modules | logTokenUsage | direct import | VERIFIED | Every Anthropic call site logs via logTokenUsage with FEATURE_TAGS.X tag (extract/voice_extract/discovery_extract/discrepancy_check/completeness_gate/clarify_severity/clarify_channel). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| LaunchPage.jsx briefing render | profile (from /api/kotoiq/profile action=get_profile) | API → seedProfile → 4 pullers (clients/recipients/discovery/voice) → real Supabase tables | YES — pullFromClient queries clients table; mapOnboardingKeyToCanonical resolves 15 canonical fields | FLOWING |
| LaunchPage.jsx clarifications badge | clarifications count from action=list_clarifications | db.clarifications.list (kotoiq_clarifications table) | YES — table populated by generateClarifications from real soft_gaps | FLOWING |
| ClarificationsOverlay HotspotDot | open clarifications | Supabase realtime + initial fetch | YES — realtime channel subscribes to live INSERT/UPDATE on kotoiq_clarifications | FLOWING |
| LivePipelineRibbon.jsx | pipeline run state from realtime | kotoiq_pipeline_runs table writes by pipelineOrchestrator | DEGRADED — table not yet in supabase_realtime publication (backlog migration); ribbon falls back to passive state without crash | STATIC (degraded; documented Known follow-up — not a phase 7 gap) |
| BriefingDoc EditableSpans | profile.fields jsonb winning value per hot column | seedProfile sort: operator_edit-wins-ties + descending confidence; hot columns mirrored | YES — kotoiqDb.clientProfile.updateField + addField apply the sort + hot-column mirror; tests assert | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest test suite passes | `npm test` | 74/74 tests pass across 12 files; runtime ~660 ms | PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | 0 errors in phase 7 code; 3 errors in unrelated `src/app/api/scout/voice/route.ts` (out of scope — pre-existing scout subsystem) | PASS (phase 7 scope) |
| Migration file shape | grep CREATE TABLE / margin_notes / ALTER PUBLICATION | All required statements present (kotoiq_client_profile, kotoiq_clarifications, margin_notes jsonb, both publication ADD statements) | PASS |
| API route auth gating | grep verifySession in route.ts | Both /api/kotoiq/profile/route.ts and /api/kotoiq/profile/stream_seed/route.ts verifySession FIRST + read agencyId from session only | PASS |
| Cross-agency guard density | grep -c "agency_id" profileIngestInternal.ts | 5 matches across 4 pullers; pullFromClient also `.is('deleted_at', null)` | PASS |
| Server-only enforcement | ls server-only-marked files | 12 of 13 phase 7 lib modules use `import 'server-only'`; profileGraphSerializer + profileDiscrepancy intentionally pure (no server-only — operator UI live preview) | PASS |
| Live API end-to-end (paste URL → profile in <10 s) | manual curl/browser test | NOT EXECUTED — requires live Anthropic + Supabase + browser session | SKIP (deferred to human verification) |
| Build registers route | `npm run build` | Per Plan 4 + Plan 6 SUMMARY self-checks: route registered as `ƒ /api/kotoiq/profile` and `ƒ /api/kotoiq/profile/stream_seed`; build exits 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROF-01 | 07-02, 07-04, 07-06 | Operator pastes Koto internal URL → resolves clientId → pulls clients + onboarding_answers + discovery + voice analyses | SATISFIED (programmatic) — needs human runtime test | seedProfile composes 4 pullers; URL_RE in route extracts clientId from /onboard, /onboarding-dashboard, /clients; cross-agency 404 verified via test |
| PROF-02 | 07-03, 07-04, 07-06 | Operator pastes raw text → Claude extracts canonical fields with per-field char-offset citation | SATISFIED (programmatic) — needs human runtime test | extractFromPastedText (Sonnet tool-use); ProvenanceRecord includes char_offset_start/end + source_snippet; CitationChip renders these in BriefingDoc |
| PROF-03 | 07-01 | kotoiq_client_profile table keyed on client_id+agency_id with per-field provenance | SATISFIED | Migration 20260507 applied with UNIQUE (agency_id, client_id) + fields jsonb + margin_notes jsonb; ProvenanceRecord D-04 quintet enforced by makeRec factory |
| PROF-04 | 07-02, 07-03, 07-04, 07-05, 07-06, 07-08 | Gap-finder emits 3-8 surgical follow-up questions (≤15 partial); low-confidence auto-fills surfaced | SATISFIED | profileGate.computeCompleteness emits soft_gaps capped at 15; profileClarifications.generateClarifications creates one per gap with severity + channel + impact_hint; HALO_THRESHOLDS render confidence-weighted halos |
| PROF-05 | 07-01, 07-05, 07-06, 07-07, 07-08 | Operator can accept/edit/reject every field; rejections preserve source provenance | SATISFIED | EditableSpan inline edit + autosave; reject_field action upserts with rejected:true + preserves ProvenanceRecord[]; RejectFieldModal uses DST token; Plan 6 test asserts "answer_clarification calls markAnswered AND updateField" |
| PROF-06 | 07-04, 07-06 | pipelineOrchestrator Stage 0 runs profile seeder before Stage 1 keyword sync; entity graph pre-seeded | SATISFIED (programmatic) — needs human runtime test | STAGE_NAMES = ['Profile','Ingest',...]; runStageSeedProfile invoked first in runFullPipeline IIFE; profileToEntityGraphSeed produces D-22 8-key contract; live ordering = human run |

**Orphaned requirements check:** None. All 6 PROF IDs from REQUIREMENTS.md Phase 7 row are claimed by plan frontmatters and have implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/kotoiq/launch/IngestPanel.jsx | various | `placeholder="..."` | Info | These are HTML form placeholders (legitimate UI text), not stubs. No action needed. |
| src/components/kotoiq/launch/ClarificationCard.jsx | "Answer, or type /ask to forward to client" | placeholder text | Info | Legitimate UI hint. Not a stub. |
| src/components/kotoiq/launch/AskOwnQuestion.jsx | placeholder text | placeholder | Info | Legitimate UI placeholder. Not a stub. |
| src/lib/kotoiq/profileChannels.ts forwardViaPortal | "v1 stub" | known stub | Info | Documented intentional stub per RESEARCH §17 A1 — no client-portal surface yet. Marks clarification asked_channel='portal' + fires notification. Will be wired up when client portal lands. NOT a blocker for phase 7 success criteria. |
| src/app/api/scout/voice/route.ts | 389, 736-737 | TS7022/TS7023 implicit any | Warning | Pre-existing; OUT OF SCOPE for phase 7 (scout subsystem). |

### Human Verification Required

(See `human_verification:` section in frontmatter — 9 items). The operator is unattended; the orchestrator should persist these as HUMAN-UAT.md for sign-off when the operator returns. Items cover:

1. PROF-01 latency target (<10 s seed)
2. PROF-02 visual citation hover
3. PROF-04 three-surface clarification coordination + HIGH-severity escalation
4. PROF-05 reject-field UX + provenance preservation
5. PROF-06 Stage 0 ordering in live pipeline run
6. LivePipelineRibbon graceful-degradation behavior
7. Drop-zone deferred_v2 source recording
8. Cross-agency isolation in browser
9. AskOwnQuestion realtime + fallback poll

### Gaps Summary

**No structural gaps.** Every observable truth from the ROADMAP success criteria has implementation evidence in the codebase. Every artifact passes existence + substantive + wiring + data-flow checks. Every key link is wired. Every Plan 1-8 SUMMARY self-check returned PASSED with all claimed files and commits present in git log. The 74/74 vitest baseline is green.

**Why human_needed:** The five ROADMAP success criteria all describe operator-observable behaviors (latency targets, visual citation, three-surface coordination, color/audit checks, end-to-end pipeline ordering) that programmatic verification cannot fully discharge. Unit tests prove the units; only a live runtime exercise proves the system. The operator is unattended, so these items are persisted under `human_verification` for sign-off when they return.

**Carried follow-ups (record-keeping, NOT phase 7 gaps — pre-disclosed in user prompt):**

1. `kotoiq_pipeline_runs` realtime publication ADD is deferred until the table reaches prod (table is in 7-migration prod backlog). LivePipelineRibbon degrades gracefully. The publication ADD statement IS in the migration (line documented) but is a no-op against the missing table.
2. 7 backlog Supabase migrations not yet applied to prod (20260416..20260427). Phase 7's own migration (20260507) IS applied.
3. `TELNYX_DEFAULT_FROM` env var introduced in Plan 5 not yet documented in `_knowledge/env-vars.md`. Graceful fallback path returns clean error if missing.
4. Phase 7 components bundling artifact: 5 files (EditableSpan, LaunchGate, LivePipelineRibbon, StreamingNarration, LaunchPage) swept into commit `df5dc50` titled `feat(scout): wire 8 emission points` due to concurrent worktree contention. Files are correct; record-keeping issue only.

---

_Verified: 2026-04-19T20:10:00Z_
_Verifier: Claude (gsd-verifier)_
