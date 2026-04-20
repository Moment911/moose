---
status: partial
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
source: [07-VERIFICATION.md]
started: 2026-04-19T20:15:00Z
updated: 2026-04-19T20:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. PROF-01 end-to-end latency
**test:** Paste a Koto internal URL on `/kotoiq/launch/:clientId` for a client with a populated onboarding record; confirm briefing populates with ≥20 fields in <10 s
**expected:** Streaming narration starts within 500 ms; briefing renders ≥20 EditableSpans; first narration line cites internal source(s); profile row visible via `list_profile` API
**why_human:** Requires real Supabase client row + Anthropic API call; latency target observable only at runtime
**result:** [pending]

### 2. PROF-02 paste-text Sonnet extraction with citations
**test:** Paste a 1-3 page voice transcript or pasted text into IngestPanel; confirm Claude extracts canonical fields with citation chips that hover-reveal verbatim source snippet + char-offset range
**expected:** Within ~6 s, briefing updates with ≥3 new EditableSpans; each new field has a CitationChip showing the verbatim source snippet sliced from the pasted text
**why_human:** Live Anthropic Sonnet call + visual citation hover behavior
**result:** [pending]

### 3. PROF-04 gap-finder three-surface coordination
**test:** Launch a fresh seed for a partially populated client; confirm 3-15 clarifications appear in (a) Pipeline → Needs Clarity tab, (b) chat orb badge count, (c) inline HotspotDots on the briefing
**expected:** All three surfaces show the same count; severity colors match (high=pink, medium=amber, low=gray); HIGH-severity insert triggers 12 s auto-dismissing modal sheet
**why_human:** Realtime subscription + visual coordination across three surfaces
**result:** [pending]

### 4. PROF-05 reject-field UX
**test:** Open RejectFieldModal on any auto-populated field; confirm DST color (#DC2626) on the destructive button + provenance preserved
**expected:** Modal renders with red destructive button; after confirm, hot column blanks but the original ProvenanceRecord[] is still present in the fields jsonb (verifiable via `get_profile` API)
**why_human:** Visual color check + post-action data inspection
**result:** [pending]

### 5. PROF-06 Stage 0 wire-in
**test:** Trigger `/api/kotoiq/profile` action=launch and confirm pipelineOrchestrator runs Profile (Stage 0) before Ingest (Stage 1)
**expected:** `kotoiq_pipeline_runs.steps` jsonb contains a stage='Profile' entry timestamped before stage='Ingest'; STAGE_NAMES array exposes 7 stages starting with 'Profile'
**why_human:** Live pipeline trigger + steps event inspection. NOTE: `kotoiq_pipeline_runs` table not yet on prod (in 7-migration backlog) — writes will silently fail until backlog migration `20260419_kotoiq_automation.sql` is applied
**result:** [pending]

### 6. Live pipeline ribbon (D-23) graceful degradation
**test:** After launch, confirm LivePipelineRibbon subscribes to `kotoiq_pipeline_runs` realtime and degrades gracefully
**expected:** DevTools console shows no uncaught errors on mount; either ribbon updates live (if migration applied) or stays in initial state without crashing (current expected state — table not on remote yet)
**why_human:** Realtime subscription + graceful degradation observable only live
**result:** [pending]

### 7. Drop-zone deferred_v2 source recording
**test:** Drag any file onto `/kotoiq/launch/:clientId`; confirm toast appears + source registry updated
**expected:** Teal overlay appears during drag; after drop, `kotoiq_client_profile.sources` jsonb gains a row with `source_type='deferred_v2'`
**why_human:** Drag/drop interaction requires manual exercise
**result:** [pending]

### 8. Cross-agency isolation
**test:** From Agency A's session, attempt to seed a `client_id` belonging to Agency B; confirm 404 (not 403)
**expected:** `POST /api/kotoiq/profile {action:'seed', client_id:'<other-agency-uuid>'}` returns 404 with `{error:'Client not found'}`
**why_human:** Two real agency sessions to test in browser; unit test covers the code path but live cross-agency request validates the deployed surface
**result:** [pending]

### 9. AskOwnQuestion (D-12) realtime + fallback poll
**test:** On LaunchPage, click "+ Ask your own question", submit a question; confirm it surfaces in chat orb + Needs Clarity tab + (if `target_field_path` set) as HotspotDot within 20 s
**expected:** All three surfaces reflect the new clarification within ~1 s via realtime; if realtime drops, fallback poll picks it up within 20 s
**why_human:** Realtime + fallback polling behavior needs live observation
**result:** [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
