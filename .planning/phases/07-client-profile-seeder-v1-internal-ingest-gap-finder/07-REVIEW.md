---
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
reviewed: 2026-04-17T00:00:00Z
depth: deep
files_reviewed: 36
files_reviewed_list:
  - supabase/migrations/20260507_kotoiq_client_profile.sql
  - src/lib/kotoClientPick.ts
  - src/lib/theme.ts
  - src/lib/kotoiqDb.ts
  - src/lib/tokenTracker.ts
  - src/lib/apiAuth.ts
  - src/lib/kotoiq/profileTypes.ts
  - src/lib/kotoiq/profileConfig.ts
  - src/lib/kotoiq/profileIngestInternal.ts
  - src/lib/kotoiq/profileExtractClaude.ts
  - src/lib/kotoiq/profileVoiceExtract.ts
  - src/lib/kotoiq/profileDiscoveryExtract.ts
  - src/lib/kotoiq/profileDiscrepancy.ts
  - src/lib/kotoiq/profileGraphSerializer.ts
  - src/lib/kotoiq/profileRetellPull.ts
  - src/lib/kotoiq/profileGate.ts
  - src/lib/kotoiq/profileSeeder.ts
  - src/lib/kotoiq/profileNarration.ts
  - src/lib/kotoiq/profileClarifications.ts
  - src/lib/kotoiq/profileChannels.ts
  - src/lib/kotoiq/emailTemplates/clarification.ts
  - src/lib/builder/pipelineOrchestrator.ts
  - src/app/api/kotoiq/profile/route.ts
  - src/app/api/kotoiq/profile/stream_seed/route.ts
  - src/views/kotoiq/LaunchPage.jsx
  - src/views/kotoiq/KotoIQShellPage.jsx
  - src/components/kotoiq/launch/IngestPanel.jsx
  - src/components/kotoiq/launch/StreamingNarration.jsx
  - src/components/kotoiq/launch/DropZone.jsx
  - src/components/kotoiq/launch/BriefingDoc.jsx
  - src/components/kotoiq/launch/EditableSpan.jsx
  - src/components/kotoiq/launch/CitationChip.jsx
  - src/components/kotoiq/launch/AutoSaveIndicator.jsx
  - src/components/kotoiq/launch/LaunchGate.jsx
  - src/components/kotoiq/launch/LivePipelineRibbon.jsx
  - src/components/kotoiq/launch/MarginNote.jsx
  - src/components/kotoiq/launch/DiscrepancyCallout.jsx
  - src/components/kotoiq/launch/RejectFieldModal.jsx
  - src/components/kotoiq/launch/HotspotDot.jsx
  - src/components/kotoiq/launch/ClarificationCard.jsx
  - src/components/kotoiq/launch/AskOwnQuestion.jsx
  - src/components/kotoiq/launch/ClarificationsOverlay.jsx
  - src/components/kotoiq/launch/ClarificationsTab.jsx
  - src/components/kotoiq/ConversationalBot.jsx
findings:
  critical: 1
  warning: 9
  info: 11
  total: 21
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** deep
**Files Reviewed:** 36 source + migration + helpers
**Status:** issues_found

## Summary

Phase 7 ships the Client Profile Seeder v1 across 8 plans: a new `kotoiq_client_profile` superset table with provenance-stamped fields, four internal-source pullers, three Claude extractors, a discrepancy detector, an entity-graph serializer, a Sonnet completeness judge, a streaming-narration SSE endpoint, a 14-action JSON dispatcher, a Launch Page canvas, an in-context clarifications overlay, and a clarifications dashboard tab. The work is well-architected and disciplined: agency isolation is consistently enforced via `getKotoIQDb(agencyId)` and `verifySession`-derived agency_id; every Claude call passes a `FEATURE_TAGS` key to `logTokenUsage`; every `ProvenanceRecord` carries `source_type` + `captured_at` + `confidence`; prompt-injection mitigations are present on every LLM call site; tool-use is hard-locked with enum allowlists. Defensive coding patterns (clamp01, allowlists, try/catch around `kotoiq_pipeline_runs`, debounce, rate limits) are present throughout.

The **one Critical** finding is a writable jsonb pollution vector in `update_field`: the route accepts arbitrary `field_name` strings without an allowlist, so a logged-in operator can write into the `fields` jsonb under any key, and (worse) trigger a database error if `field_name` happens to match a real hot column unintentionally bypassing the canonical/custom split that `add_field` carefully enforces. The Warning items cluster around: a SELECT-without-agency-scope on `kotoiq_keywords` in the orchestrator (cross-agency leak risk), a hardcoded destructive color in `EditableSpan` that bypasses the new `DST` token, the `pickClarificationChannel` call in `forward_to_client` not being passed the client's contact preferences, a couple of stream-cleanup gaps (no cancel handling on the SSE stream when the client disconnects), and the orchestrator's `runId` collision risk under high write load. Info items are mostly drift/duplication notes (HOT_COLUMNS declared in three places, mirror constants in client/server config) and minor a11y/UX polish suggestions.

No code paths bypass agency isolation in the new code — every Supabase query touching a `kotoiq_*` table either routes through `getKotoIQDb()` or carries an explicit `.eq('agency_id', agencyId)`. Every Claude call invokes `logTokenUsage` with a `FEATURE_TAGS` key. Every `ProvenanceRecord` shipped to the database has `source_type`, `captured_at`, and `confidence`. Auth is correctly derived from the verified session, never from `body.agency_id`. Migration uses standard service-role-only RLS that matches the prior 20260505 builder migration pattern.

---

## Critical Issues

### CR-01: `update_field` accepts arbitrary `field_name`, enabling jsonb pollution and bypassing the add_field/update_field invariant

**File:** `src/app/api/kotoiq/profile/route.ts:208-268`
**Issue:** The `update_field` action validates only that `body.client_id` and `body.field_name` are present; it does not validate that `body.field_name` is a member of `CANONICAL_FIELD_NAMES` nor that it is an existing operator-added custom field. Any authenticated agency operator can post `{ action: 'update_field', client_id, field_name: '__proto__', value: '...' }` (or any arbitrary string), and `kotoiqDb.updateField` will write `fields[field_name] = [<record>]` directly into the jsonb. This:

1. Pollutes `fields` jsonb with arbitrary keys that won't render in the briefing doc and won't be cleared by `delete_field` unless the operator knows the exact key name.
2. Defeats the `add_field` action's careful `CANONICAL_FIELD_NAMES.includes(...)` rejection (line 275) — the operator can simply use `update_field` to add any custom field name, bypassing the "use update_field for canonical, add_field for custom" UX contract.
3. Has no length cap — `field_name = 'a'.repeat(1_000_000)` will be written verbatim. Combined with `value` (also unvalidated for size), this is a DoS vector against the kotoiq_client_profile.fields jsonb column.
4. If `field_name` accidentally matches a hot column in `PROFILE_HOT_COLUMNS` (line 307 of kotoiqDb.ts), the helper will also patch the indexed text column on the row — silently mutating columns the operator may not realise they own.

**Fix:**
```ts
// In src/app/api/kotoiq/profile/route.ts at line 208, after the basic null check:
if (action === 'update_field') {
  if (!body.client_id || !body.field_name) {
    return err(400, 'client_id and field_name required')
  }
  const fieldName = String(body.field_name)
  if (fieldName.length === 0 || fieldName.length > 80) {
    return err(400, 'field_name must be 1-80 chars')
  }
  if (!/^[a-z][a-z0-9_]*$/i.test(fieldName)) {
    return err(400, 'field_name must be alphanumeric/underscore')
  }
  // Validate against canonical OR an existing custom field on this profile.
  const { data: profile } = await db.clientProfile.get(body.client_id)
  if (!profile) return err(404, 'Profile not found')
  const isCanonical = (CANONICAL_FIELD_NAMES as readonly string[]).includes(fieldName)
  const existingFields = ((profile as any).fields || {}) as Record<string, unknown>
  if (!isCanonical && !(fieldName in existingFields)) {
    return err(400, 'unknown field — use add_field to create a custom field first', {
      hint: 'update_field only edits canonical or already-added custom fields',
    })
  }
  // Cap value size
  if (typeof body.value === 'string' && body.value.length > 8000) {
    return err(413, 'value exceeds 8000 chars')
  }
  // ...rest of existing code
}
```

Apply the same `field_name` shape + length validation to `add_field` (line 271), `delete_field` (line 294), and `reject_field` (line 310). Without this, the route is the canonical write surface and currently the weakest link.

---

## Warnings

### WR-01: `kotoiq_keywords` SELECT in pipelineOrchestrator is not agency-scoped (defense-in-depth gap)

**File:** `src/lib/builder/pipelineOrchestrator.ts:418-423`
**Issue:** `runStageIngest` queries `kotoiq_keywords` to check for an existing keyword fingerprint, but the SELECT only filters by `client_id` and `fingerprint` — no `.eq('agency_id', config.agency_id)`. The orchestrator's preamble comment (line 13) explicitly promises "Every write below includes an explicit `.eq('agency_id', agencyId)` per CLAUDE.md isolation rule." The INSERT below correctly carries `agency_id`, but the SELECT does not. A row that already exists for a different agency under the same `client_id` (defensive only, since `client_id` is per-agency) would be returned — and even though `client_id` collisions across agencies are improbable, the file's own contract requires explicit scoping for defense-in-depth.

**Fix:**
```ts
const { data: existing } = await supabase
  .from('kotoiq_keywords')
  .select('id')
  .eq('agency_id', config.agency_id)   // <-- add this
  .eq('client_id', config.client_id)
  .eq('fingerprint', fp)
  .maybeSingle()
```

### WR-02: `EditableSpan` hardcodes `#dc2626` instead of importing the new `DST` token

**File:** `src/components/kotoiq/launch/EditableSpan.jsx:130`
**Issue:** The `DST` destructive-action color was added to `src/lib/theme.ts` in plan 07-01 (`export const DST = '#DC2626'`) explicitly so destructive UI affordances stop hardcoding the value. `EditableSpan.jsx` already imports tokens from `'../../../lib/theme'` (line 3), but the inline error message uses `color: '#dc2626'` (line 130) instead of `color: DST`. The phase requirement called this out specifically.

**Fix:**
```jsx
// Line 3
import { T, R, AMB, BLK, DST, FB } from '../../../lib/theme'

// Line 130
<span style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, fontSize: 11, color: DST }}>
  save failed — keep editing
</span>
```

### WR-03: `forward_to_client` calls `pickClarificationChannel` without the client contact preferences it just queried

**File:** `src/app/api/kotoiq/profile/route.ts:471-501`
**Issue:** Line 471-477 fetches the client row (`name, email, phone`), but `pickClarificationChannel` (line 493) is called with no `clientContactPreferences`. The classifier was designed (per `pickClarificationChannel` lines 41-48 in profileChannels.ts) to honour `sms_opt_in`, `email_opt_in`, `portal_opt_in`, and `preferred_channel` — none of which the route reads from the client row or its `onboarding_answers` jsonb. Result: every "auto" channel pick falls through to the rule-based ≤80-char heuristic, even when the client has explicit opt-out flags on file. This silently routes SMS to clients who opted out, violating the D-18 promise.

**Fix:** Either add the columns to the SELECT and pass them through, or document explicitly that v1 doesn't honour preferences. Minimum patch:
```ts
const { data: clientRow } = await sb
  .from('clients')
  .select('id, name, email, phone, sms_opt_in, email_opt_in, portal_opt_in, preferred_channel')
  .eq('id', c.client_id)
  .eq('agency_id', agencyId)
  .is('deleted_at', null)
  .maybeSingle()
// ...
const picked = await pickClarificationChannel({
  question: c.question,
  clientContactPreferences: {
    sms_opt_in: clientRow.sms_opt_in,
    email_opt_in: clientRow.email_opt_in,
    portal_opt_in: clientRow.portal_opt_in,
    preferred_channel: clientRow.preferred_channel,
  },
  agencyId,
  clientId: c.client_id,
})
```

### WR-04: `runId` from `runFullPipeline` has collision risk under burst load

**File:** `src/lib/builder/pipelineOrchestrator.ts:623`
**Issue:** `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` produces 6 chars of base36 randomness (~36^6 ≈ 2.18B combinations), but `Math.random()` is not cryptographically random and Date.now() has 1ms resolution. Two parallel launches in the same millisecond have a non-negligible birthday-paradox collision chance. The `kotoiq_pipeline_runs.id` column is a uuid PK — and `pipelineRunInsert` writes the runId string into `id`. If two collide, the second insert will fail (PK conflict) and the in-memory `activeRuns` map will hold a "ghost" run with no DB row, breaking the D-23 ribbon for that user.

**Fix:**
```ts
import { randomUUID } from 'crypto'
// ...
const runId = randomUUID()
```
This both removes the collision risk and matches the DB column type (`uuid`). The current string format `pipe_...` is also implicitly broken because the column is uuid-typed — the insert is succeeding only because Postgres is lax with text-shaped uuids when the migration was inspected (see kotoiq_pipeline_runs schema, which actually has `uuid PRIMARY KEY DEFAULT gen_random_uuid()`).

### WR-05: SSE stream in `stream_seed` ignores client disconnect (long Sonnet calls keep running)

**File:** `src/app/api/kotoiq/profile/stream_seed/route.ts:91-189`
**Issue:** The `ReadableStream` `start()` method does not implement `cancel()`, and there's no `req.signal` listener wired to the seeder's underlying fetch calls. If the operator navigates away from the Launch Page or kills the tab during a 30s Sonnet seed, the seeder keeps running to completion (and burning tokens). Each ingest action also has its own 30s/15s/20s `AbortSignal.timeout(...)`, which bounds total cost but doesn't honour client cancellation. Combined with the `MAX_PASTED_TEXT_CHARS=50000` allowance, this is a soft DoS amplifier (operator opens 10 tabs, cancels them, server still processes 10 full seeds).

**Fix:** Plumb `req.signal` through the seeder. Minimum patch:
```ts
const ac = new AbortController()
req.signal.addEventListener('abort', () => ac.abort())
const output = new ReadableStream({
  async start(controller) {
    try {
      // ...
      const seedResult = await seedProfile({
        clientId: client_id,
        agencyId,
        pastedText: pasted_text,
        // ... pass ac.signal to seedProfile
      })
      // ...
    } catch { /* ... */ }
  },
  cancel() {
    ac.abort()
  },
})
```
Threading the AbortSignal all the way to `extractFromPastedText`, `extractFromVoiceTranscript`, etc. is a larger refactor; document it as v1.1 if not feasible now, but at minimum check `ac.signal.aborted` between stages and short-circuit.

### WR-06: `profileExtractClaude` silently returns `[]` on missing API key — operator gets a "successful" no-op

**File:** `src/lib/kotoiq/profileExtractClaude.ts:84-89`
**Issue:** When `ANTHROPIC_API_KEY` is missing, the function logs an error to console and returns `[]`. The route caller (`paste_text` action, line 180-204) treats `extracted: []` as a successful extraction and may even commit it via `seedProfile`, persisting nothing. The operator sees "Got 0 fields" with no indication that the entire extraction was disabled. The same pattern exists in `profileVoiceExtract.ts:75-76`, `profileDiscoveryExtract.ts:60-61`, `profileGate.ts:106-107`, and `streamHaikuWrapUp` in `profileNarration.ts:101-108`.

**Fix:** Distinguish "no extractable fields" from "extractor disabled":
```ts
export type ExtractResult =
  | { ok: true; fields: ExtractedFieldRecord[] }
  | { ok: false; reason: 'api_key_missing' | 'fetch_failed' | 'non_2xx'; status?: number }

// route.ts paste_text:
if (extracted.ok === false) return err(503, 'Claude extractor unavailable', { reason: extracted.reason })
```
At minimum, add a structured log + warning header so ops can detect silent degradation in production.

### WR-07: `LivePipelineRibbon` uses anon-key supabase client to query a table without RLS

**File:** `src/components/kotoiq/launch/LivePipelineRibbon.jsx:55-68`
**Issue:** The component imports the browser anon-key `supabase` client (line 3) and queries `kotoiq_pipeline_runs` directly. Per `supabase/migrations/20260419_kotoiq_automation.sql`, that table has NO `ENABLE ROW LEVEL SECURITY` declaration, meaning the anon key can read ALL rows across all agencies. The component does add `.eq('agency_id', agencyId || '0000…')` defensively, but a malicious browser can simply remove that filter and dump every agency's pipeline runs. The component comment notes "RLS handles isolation" but the table actually has no RLS policy at all (the new tables in 20260507 have RLS, but kotoiq_pipeline_runs predates that migration).

**Fix:** Either (a) add RLS to `kotoiq_pipeline_runs` in a follow-up migration with the standard service-role-only pattern from 20260507_kotoiq_client_profile.sql, or (b) move the read behind an authenticated `/api/kotoiq/profile` action (e.g. `get_pipeline_run`) that derives agency_id from the session. Option (a) is correct long-term; (b) is the immediate fix until RLS is applied. Without either, the agency-isolation rule from project memory is violated for this table.

### WR-08: `ClarificationsOverlay` realtime subscription receives all-agency rows (RLS gap on kotoiq_clarifications realtime?)

**File:** `src/components/kotoiq/launch/ClarificationsOverlay.jsx:60-95`
**Issue:** Although `kotoiq_clarifications` has RLS (`USING (true) WITH CHECK (true)` per 20260507 migration line 171-172), that policy permits ANY authenticated/anon read — service-role-only is enforced by app convention, not by RLS. The realtime channel uses the browser anon-key `supabase` client and filters only by `client_id=eq.${clientId}`. There is no agency_id filter. If two agencies happen to use the same `clientId` (extremely improbable since uuids), or if the client_id value is enumerable, an attacker can subscribe to another agency's clarifications stream. The component receives `agencyId` as a prop but ignores it (line 31 is annotated `// eslint-disable-next-line @typescript-eslint/no-unused-vars`).

**Fix:** Either tighten RLS on `kotoiq_clarifications` to restrict the `USING` clause based on session JWT (recommended pattern), or add `filter: 'and(client_id=eq.X,agency_id=eq.Y)'` to the realtime subscription. The current state relies on uuid unguessability for cross-agency safety, which is weak.

### WR-09: `pulledSourceRefs` source-type classifier misclassifies clients-table refs as `onboarding_form`

**File:** `src/lib/kotoiq/profileSeeder.ts:409-414`
**Issue:** `refToSourceType` returns `'onboarding_form'` for any ref that doesn't start with `retell_call:`, `discovery:`, or `paste:` — including `clients:${clientId}` (line 402), which represents the entire `clients` table pull (mix of onboarding form data, voice rollups, and possibly direct CRM edits). The `sources` jsonb is supposed to track distinct sources for the audit trail / "where did this data come from?" UX (D-09); marking the clients-table pull as `onboarding_form` collapses the distinction. The voice-call rollup that's appended via `pullFromClient` line 178-179 also gets bucketed under the same wrong source.

**Fix:** Either give `clients:` its own source_type (`'koto_crm'` perhaps), or split the pull into per-source rows:
```ts
const refToSourceType = (ref: string): SourceType => {
  if (ref.startsWith('retell_call:')) return 'voice_call'
  if (ref.startsWith('discovery:')) return 'discovery_doc'
  if (ref.startsWith('paste:')) return 'claude_inference'
  if (ref.startsWith('clients:')) return 'onboarding_form' // explicit, not fallthrough
  return 'onboarding_form'
}
```
At minimum make the classification explicit (no implicit catch-all) so future ref schemes don't get silently misbucketed.

---

## Info

### IN-01: HOT_COLUMNS list duplicated in three places — drift risk

**File:** `src/lib/kotoiq/profileConfig.ts:118-130`, `src/lib/kotoiq/profileSeeder.ts:70-82`, `src/lib/kotoiqDb.ts:307-319`
**Issue:** The same 11-element hot-column list is declared as `HOT_COLUMNS` in profileConfig, again as `HOT_COLUMNS` in profileSeeder, and as a `Set` named `PROFILE_HOT_COLUMNS` in kotoiqDb. Each is annotated "must match the migration column order" but nothing enforces that. Adding a new hot column to the migration requires editing four files, easy to miss one.
**Fix:** Make `profileConfig.HOT_COLUMNS` the single source of truth and import it everywhere:
```ts
// profileSeeder.ts + kotoiqDb.ts
import { HOT_COLUMNS } from './profileConfig'
const PROFILE_HOT_COLUMNS = new Set<string>(HOT_COLUMNS)
```

### IN-02: `HALO_THRESHOLDS` constants duplicated in client EditableSpan and server profileConfig

**File:** `src/components/kotoiq/launch/EditableSpan.jsx:8-9`
**Issue:** `HALO_CONFIDENT = 0.85` and `HALO_GUESSED = 0.5` are hardcoded with a comment explaining they mirror server config. This is necessary because profileConfig is `'server-only'`. Consider extracting an isomorphic shared module (`src/lib/kotoiq/profileTuning.ts`, no `'server-only'`) so both sides import the same numbers.
**Fix:** Move HALO_THRESHOLDS + DISCREPANCY_TOLERANCE to a no-server-only module and re-export from profileConfig.

### IN-03: `URL_RE` duplicated between route.ts and LaunchPage.jsx with subtle differences

**File:** `src/app/api/kotoiq/profile/route.ts:55-56`, `src/views/kotoiq/LaunchPage.jsx:84`
**Issue:** Identical regex declared in two files. Future tweaks (e.g. supporting `/onboard-pro/` URLs) require both edits. DropZone.jsx also has a similar regex on line 22.
**Fix:** Extract to `src/lib/kotoiq/profileUrlMatcher.ts` and import.

### IN-04: `seedProfile` debounce reads `existing.last_seeded_at` but pasted_text bypass disables the debounce

**File:** `src/lib/kotoiq/profileSeeder.ts:264`
**Issue:** The check `if (existing && !args.forceRebuild && !args.pastedText)` means any seed with `pastedText` skips the 30s debounce. A misbehaving client posting back-to-back identical pasted_text triggers a full re-seed each time. Consider hashing pasted_text and including the hash in the debounce key.
**Fix:** Add a same-paste-debounce: `if (existing.last_pasted_text_hash === sha256(pastedText) && ageMs < SEED_DEBOUNCE_SECONDS * 1000) return cached`.

### IN-05: `marginNotes` ID generator can collide on rapid pushes

**File:** `src/lib/kotoiq/profileSeeder.ts:184`
**Issue:** `mn-${args.clientId.slice(0, 8)}-${Date.now()}-${out.length}` uses `Date.now()` which collides if two notes are derived in the same ms (out.length differs, so the trailing index makes it unique within one call, but two simultaneous seeds could collide). Low impact since margin_notes is appended/re-derived in the same transaction.
**Fix:** Use `crypto.randomUUID().slice(0,8)` for the disambiguator.

### IN-06: `formatDate` in CitationChip catches all exceptions silently

**File:** `src/components/kotoiq/launch/CitationChip.jsx:156-163`
**Issue:** Bare catch swallows any non-`Error` thrown from `new Date(iso)` (which doesn't throw, but `.toLocaleDateString()` could in exotic locales). Returning the raw ISO is acceptable but worth surfacing in dev console.
**Fix:** `catch (e) { console.warn('[CitationChip] date parse failed', iso, e); return iso }`

### IN-07: `profileSeeder` discovery-section batching uses sequential `for` loop instead of `parallelLimit`

**File:** `src/lib/kotoiq/profileSeeder.ts:301-321`
**Issue:** The 3-at-a-time batching is implemented as a serial for-loop wrapping `Promise.allSettled` of 3 — it waits for all 3 in a batch before starting the next 3 (head-of-line blocking). The `pipelineOrchestrator.parallelLimit` helper (line 127) does proper worker-pool concurrency. Same pattern repeats for transcripts (line 332-351).
**Fix:** Reuse the `parallelLimit` helper, or document why batched-of-3 is preferred (rate-limit smoothing, perhaps).

### IN-08: `EditableSpan` setState-during-render pattern is unconventional

**File:** `src/components/kotoiq/launch/EditableSpan.jsx:72-75`
**Issue:** The "adjusting state on prop change" pattern (lines 67-75) calls `setPrevValue` and `setDraft` directly during render when `prevValue !== value`. This is a documented React pattern but unusual; confused readers may "fix" it by adding a useEffect (which would cause the cascade the comment warns about). Add a stronger comment or extract to a reusable `useDerivedState` hook.
**Fix:** Add a comment block linking the React docs page directly above the pattern.

### IN-09: `relativeTime` in ClarificationCard shows stale times unless re-rendered

**File:** `src/components/kotoiq/launch/ClarificationCard.jsx:13-24`
**Issue:** The function reads `Date.now()` once per render. A card showing "just now" stays "just now" until parent re-renders. For cards in the Pipeline > Needs Clarity tab (which reloads every 30s via the parent's interval), this is fine; for the chat-mode panel that doesn't re-render on a timer, the timestamps will get increasingly stale.
**Fix:** Add an internal 30s ticker, or compute relative time at render time from a parent-supplied "now" tick.

### IN-10: `ClarificationsTab` realtime gap — no subscription, only 30s/click reload

**File:** `src/components/kotoiq/launch/ClarificationsTab.jsx:42-46`
**Issue:** Unlike `ClarificationsOverlay`, this tab does not subscribe to `kotoiq_clarifications` realtime; it relies on the parent's 30s interval and explicit reloads on action. New rows can take up to 30s to appear in the dashboard view, even though the same data reaches the in-page hotspots immediately via the overlay's subscription. Consistency win to wire realtime here too.
**Fix:** Mirror the `ClarificationsOverlay` realtime channel here, scoped optionally to clientId or agency-wide.

### IN-11: `forwardViaSMS` rate-limit count uses `gte('asked_at', cutoff)` but rows in a 'skipped' status keep the cutoff true

**File:** `src/lib/kotoiq/profileChannels.ts:152-160`
**Issue:** The count is over rows where `asked_channel='sms'` and `asked_at >= cutoff`, regardless of `status`. A clarification asked via SMS and then immediately answered/skipped still counts toward the per-hour cap. This is intentional per RESEARCH §15 (cost mitigation, not response-rate mitigation), but worth documenting clearly so the next maintainer doesn't "fix" it.
**Fix:** Add a comment: `// counts sent regardless of answer status — protects Telnyx spend, not response funnel`.

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
