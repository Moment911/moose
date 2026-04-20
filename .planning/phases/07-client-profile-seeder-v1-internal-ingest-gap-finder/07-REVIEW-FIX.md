---
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
fixed_at: 2026-04-19T20:35:00Z
review_path: .planning/phases/07-client-profile-seeder-v1-internal-ingest-gap-finder/07-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-04-19T20:35:00Z
**Source review:** .planning/phases/07-client-profile-seeder-v1-internal-ingest-gap-finder/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (1 Critical + 9 Warning; 11 Info skipped per scope `critical_warning`)
- Fixed: 10
- Skipped: 0

**Operator action required:**
- WR-07 ships a new SQL migration (`supabase/migrations/20260512_kotoiq_pipeline_runs_rls.sql`) that is NOT yet applied to live Supabase. Operator must run `supabase db push` (or paste the file into Supabase Studio's SQL editor) once the kotoiq_pipeline_runs migration backlog is cleared. The companion `20260419_kotoiq_automation.sql` is in the same backlog — apply both together.
- WR-04 changes the in-memory `runId` from a `pipe_*` string to a real uuid. The change requires the existing `kotoiq_pipeline_runs` migration backlog to be applied for inserts to actually persist (the column is `uuid PRIMARY KEY DEFAULT gen_random_uuid()`); the prior `pipe_*` string would have been rejected at the Postgres level on insert anyway, so this fix improves correctness once the migration lands. Until then, `pipelineRunInsert` continues to swallow the error per its existing try/catch pattern.

## Fixed Issues

### CR-01: `update_field` accepts arbitrary `field_name`, enabling jsonb pollution

**Files modified:** `src/app/api/kotoiq/profile/route.ts`
**Commit:** d2a327a
**Applied fix:** Added a shared `validateFieldNameShape` (regex `^[a-z][a-z0-9_]*$/i`, 1-80 chars) and `validateFieldValueSize` (string ≤ 8000 chars; non-string serialized JSON ≤ 8000 chars) helper. Wired both into `update_field`, `add_field`, `delete_field`, and `reject_field`. `update_field` now also enforces an allowlist: the field must be either canonical (`CANONICAL_FIELD_NAMES`) OR an existing custom field on the profile — otherwise the operator must use `add_field` first.

### WR-01: `kotoiq_keywords` SELECT in pipelineOrchestrator is not agency-scoped

**Files modified:** `src/lib/builder/pipelineOrchestrator.ts`
**Commit:** fab6ca3
**Applied fix:** Added `.eq('agency_id', config.agency_id)` to the existing-keyword check, matching the surrounding INSERT and the file's own preamble contract.

### WR-02: `EditableSpan` hardcodes `#dc2626` instead of importing the new `DST` token

**Files modified:** `src/components/kotoiq/launch/EditableSpan.jsx`
**Commit:** fa7e22a
**Applied fix:** Imported `DST` from `'../../../lib/theme'` and replaced the hardcoded `#dc2626` in the inline error message with `DST`.

### WR-03: `forward_to_client` calls `pickClarificationChannel` without client contact preferences

**Files modified:** `src/app/api/kotoiq/profile/route.ts`
**Commit:** d5e60a4
**Applied fix:** Switched the clients SELECT from a hand-listed column set to `select('*')` so missing-column variants (preference fields are not in the canonical schema migration) come back undefined rather than 400. Read opt-in / opt-out / preferred_channel from BOTH dedicated columns AND the `onboarding_answers` jsonb (where the web form currently stores them). Threaded the resulting preferences into `pickClarificationChannel`. Added a hard short-circuit: an explicit opt-out blocks the channel with a 409 even when the operator hand-picked it (D-18 promise). Note: the prefBool helper accepts `true`/`'true'`/`1` and the matching false variants so JSONB-stored preferences with mixed types parse correctly. **Requires human verification:** confirm that the opt-out short-circuit semantics match D-18 and that downstream UI surfaces the 409 sensibly.

### WR-04: `runId` from `runFullPipeline` has collision risk + non-uuid format

**Files modified:** `src/lib/builder/pipelineOrchestrator.ts`
**Commit:** 6a98611
**Applied fix:** Replaced `pipe_${Date.now()}_${Math.random()...}` with `randomUUID()` from Node's crypto module. Both removes the birthday-paradox collision risk under burst load and makes the runId valid as the uuid PK on `kotoiq_pipeline_runs`.

### WR-05: SSE stream in `stream_seed` ignores client disconnect

**Files modified:** `src/app/api/kotoiq/profile/stream_seed/route.ts`
**Commit:** b9565ba
**Applied fix:** Wired an `AbortController` to `req.signal` and added `cancel()` to the ReadableStream. Inserted between-stage `if (ac.signal.aborted) return` short-circuit checks at every stage transition (after Promise.all of pullers, after seedProfile, before streamHaikuWrapUp). Wrapped narration writes in an `writeIfActive` helper that no-ops once aborted. The underlying Sonnet/Haiku in-flight fetches still run to their per-fetch timeouts (full pluming would require threading the AbortSignal through `extractFromPastedText`, etc. — flagged as v1.1 in inline comment), but no NEW Claude calls fire after a disconnect. **Requires human verification:** confirm the abort flow doesn't double-close the controller in edge cases (the `try { controller.close() } catch {}` guards are defensive but worth a manual smoke test).

### WR-06: Claude extractors silently return `[]` on missing API key

**Files modified:** `src/lib/kotoiq/profileExtractClaude.ts`, `src/lib/kotoiq/profileVoiceExtract.ts`, `src/lib/kotoiq/profileDiscoveryExtract.ts`, `src/lib/kotoiq/profileGate.ts`
**Commit:** 1c54768
**Applied fix:** Replaced silent fallthroughs with structured `console.warn(JSON.stringify({...}))` logs that distinguish `extractor_disabled` (no API key) from `fetch_failed` and `non_2xx`. Each log includes agency_id + client_id + relevant ref so production telemetry can detect silent degradation. Did NOT change the return-type contract to a discriminated union (would have required cascading caller changes across 4 modules + the route + the seeder); the larger refactor is deferred to v1.1 per the reviewer's "At minimum" recommendation. `profileNarration.ts streamHaikuWrapUp` was inspected and found to already narrate the missing-API-key case to the user — no change needed there.

### WR-07: `LivePipelineRibbon` reads `kotoiq_pipeline_runs` from anon-key without RLS

**Files modified:** `supabase/migrations/20260512_kotoiq_pipeline_runs_rls.sql` (new), `src/components/kotoiq/launch/LivePipelineRibbon.jsx`
**Commit:** e775d89
**Applied fix:** Added a follow-up migration that runs `ALTER TABLE kotoiq_pipeline_runs ENABLE ROW LEVEL SECURITY` plus the standard service-role-only `USING (true) WITH CHECK (true)` policy used by every other kotoiq_* table. Updated the JSDoc on `LivePipelineRibbon.jsx` to remove the misleading "RLS handles isolation" claim and document the WR-08-style follow-up needed once the migration is pushed (move the read behind an authenticated /api/kotoiq action). **Requires operator action:** push the migration to live Supabase via `supabase db push` (deferred per agent instructions; the kotoiq_pipeline_runs base migration is already in the operator's 7-migration backlog so applying both at once is the cleanest path).

### WR-08: `ClarificationsOverlay` realtime subscription has no agency_id filter

**Files modified:** `src/components/kotoiq/launch/ClarificationsOverlay.jsx`
**Commit:** c0e56db
**Applied fix:** Removed the `eslint-disable-next-line` comment and made `agencyId` a required prop. Bailed out of the subscription entirely if `agencyId` is missing (better than subscribing with no agency scope). Included `agencyId` in the channel name (`kotoiq_clarifications:${agencyId}:${clientId}`) so per-agency channels are isolated at the channel layer. Added a payload-level guard inside the `postgres_changes` handler that drops any row whose `agency_id` doesn't match the logged-in agency — defense-in-depth against malicious client_id enumeration. Updated the useEffect dependency array to include `agencyId`. **Requires human verification:** confirm the subscription works end-to-end against a live agencyId payload (the payload guard is best-effort against a hypothetical cross-agency client_id collision; the primary defense is still uuid unguessability, which the reviewer correctly flagged as weak).

### WR-09: `pulledSourceRefs` source-type classifier misclassifies clients-table refs

**Files modified:** `src/lib/kotoiq/profileSeeder.ts`
**Commit:** 9a1182e
**Applied fix:** Added an explicit `if (ref.startsWith('clients:')) return 'onboarding_form'` branch so the classification is intentional rather than a fall-through, plus a structured warn log for unrecognised ref schemes. Did NOT introduce a new `koto_crm` SourceType (would have required a migration to extend the `SOURCE_TYPES` enum and downstream UI changes); the explicit branch + warn provides the audit trail the reviewer asked for and a clear hook for the future split.

## Skipped Issues

None — all 10 in-scope findings (1 Critical + 9 Warning) were fixed.

The 11 Info findings were out of scope (`fix_scope: critical_warning`) and have not been addressed in this iteration.

---

_Fixed: 2026-04-19T20:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
