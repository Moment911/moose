---
status: partial
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
source: [07-VERIFICATION.md]
started: 2026-04-19T20:15:00Z
updated: 2026-04-19T21:00:00Z
---

## Current Test

[paused — auth blocker; resume after auth investigation per outstanding_blocker]

## Outstanding Blocker (paused 2026-04-19T21:00:00Z)

All 9 tests blocked by HTTP 401 from `/api/kotoiq/profile` and `/api/kotoiq/profile/stream_seed` in production.

**Operator state at pause:**
- Logged in to hellokoto.com: yes (confirmed)
- Client URL under test: https://hellokoto.com/clients/78568874-92d4-4624-bbc2-b7b11de7d620
- Direct URL bar GET to `/api/kotoiq/profile` returns 405 (expected — POST-only route)
- Browser POSTs from LaunchPage all return 401
- IngestPanel rendered conditionally (`!clientId || !profile`); operator reported "I don't see the ingest" suggesting either deploy lag or a runtime render issue

**Root cause attempted (not yet verified live):**
Browser-side fetches in LaunchPage / KotoIQShellPage / ClarificationsTab / ClarificationsOverlay / ConversationalBot were missing the `Authorization: Bearer <token>` header. Fix landed in commit `e6a1cd5` — added `src/lib/kotoiqProfileFetch.ts` helper that pulls `supabase.auth.getSession().access_token` and attaches it. 10 fetch sites refactored to use the helper.

**Why it might still 401 even with the fix deployed:**
1. Vercel deploy lag (Vercel API was timing out when we tried to verify deploy state)
2. The `supabase.auth.getSession()` call inside the helper might not see the operator's session — possible if the supabase client proxy initializes a different instance than the one useAuth hydrates with
3. The session token might be expired
4. There's a different code path (server-side?) returning 401 that the helper doesn't address

**Next investigative steps when UAT resumes:**
1. Force a fresh Vercel production deploy (`vercel --prod --yes` from the repo when their API is responsive)
2. Hard-refresh the LaunchPage and inspect the actual `Authorization` header on the failed POST in DevTools → Network tab
3. If header is missing: the helper isn't reaching the same supabase instance as useAuth. Refactor to take the session from useAuth directly via prop drilling
4. If header is present but still 401: dig into `verifySession` — possibly the operator's user has no `agency_members` row, so even with a valid token, agencyId resolves to null

## Tests

### 1. PROF-01 end-to-end latency
**test:** Paste a Koto internal URL on `/kotoiq/launch/:clientId` for a client with a populated onboarding record; confirm briefing populates with ≥20 fields in <10 s
**expected:** Streaming narration starts within 500 ms; briefing renders ≥20 EditableSpans; first narration line cites internal source(s); profile row visible via `list_profile` API
**why_human:** Requires real Supabase client row + Anthropic API call; latency target observable only at runtime
**result:** blocked
**blocked_by:** auth
**reason:** "I hit a snag pulling — HTTP 401. I'll carry on without it."

### 2. PROF-02 paste-text Sonnet extraction with citations
**test:** Paste a 1-3 page voice transcript or pasted text into IngestPanel; confirm Claude extracts canonical fields with citation chips that hover-reveal verbatim source snippet + char-offset range
**expected:** Within ~6 s, briefing updates with ≥3 new EditableSpans; each new field has a CitationChip showing the verbatim source snippet sliced from the pasted text
**why_human:** Live Anthropic Sonnet call + visual citation hover behavior
**result:** blocked
**blocked_by:** auth

### 3. PROF-04 gap-finder three-surface coordination
**test:** Launch a fresh seed for a partially populated client; confirm 3-15 clarifications appear in (a) Pipeline → Needs Clarity tab, (b) chat orb badge count, (c) inline HotspotDots on the briefing
**expected:** All three surfaces show the same count; severity colors match (high=pink, medium=amber, low=gray); HIGH-severity insert triggers 12 s auto-dismissing modal sheet
**why_human:** Realtime subscription + visual coordination across three surfaces
**result:** blocked
**blocked_by:** auth

### 4. PROF-05 reject-field UX
**test:** Open RejectFieldModal on any auto-populated field; confirm DST color (#DC2626) on the destructive button + provenance preserved
**expected:** Modal renders with red destructive button; after confirm, hot column blanks but the original ProvenanceRecord[] is still present in the fields jsonb (verifiable via `get_profile` API)
**why_human:** Visual color check + post-action data inspection
**result:** blocked
**blocked_by:** auth

### 5. PROF-06 Stage 0 wire-in
**test:** Trigger `/api/kotoiq/profile` action=launch and confirm pipelineOrchestrator runs Profile (Stage 0) before Ingest (Stage 1)
**expected:** `kotoiq_pipeline_runs.steps` jsonb contains a stage='Profile' entry timestamped before stage='Ingest'; STAGE_NAMES array exposes 7 stages starting with 'Profile'
**why_human:** Live pipeline trigger + steps event inspection. NOTE: `kotoiq_pipeline_runs` table not yet on prod (in 7-migration backlog) — writes will silently fail until backlog migration `20260419_kotoiq_automation.sql` is applied
**result:** blocked
**blocked_by:** auth-and-migration
**reason:** Compound block — requires both the auth fix to land AND the kotoiq_pipeline_runs migration backlog to be applied to live Supabase

### 6. Live pipeline ribbon (D-23) graceful degradation
**test:** After launch, confirm LivePipelineRibbon subscribes to `kotoiq_pipeline_runs` realtime and degrades gracefully
**expected:** DevTools console shows no uncaught errors on mount; either ribbon updates live (if migration applied) or stays in initial state without crashing (current expected state — table not on remote yet)
**why_human:** Realtime subscription + graceful degradation observable only live
**result:** blocked
**blocked_by:** auth

### 7. Drop-zone deferred_v2 source recording
**test:** Drag any file onto `/kotoiq/launch/:clientId`; confirm toast appears + source registry updated
**expected:** Teal overlay appears during drag; after drop, `kotoiq_client_profile.sources` jsonb gains a row with `source_type='deferred_v2'`
**why_human:** Drag/drop interaction requires manual exercise
**result:** blocked
**blocked_by:** auth

### 8. Cross-agency isolation
**test:** From Agency A's session, attempt to seed a `client_id` belonging to Agency B; confirm 404 (not 403)
**expected:** `POST /api/kotoiq/profile {action:'seed', client_id:'<other-agency-uuid>'}` returns 404 with `{error:'Client not found'}`
**why_human:** Two real agency sessions to test in browser; unit test covers the code path but live cross-agency request validates the deployed surface
**result:** blocked
**blocked_by:** auth

### 9. AskOwnQuestion (D-12) realtime + fallback poll
**test:** On LaunchPage, click "+ Ask your own question", submit a question; confirm it surfaces in chat orb + Needs Clarity tab + (if `target_field_path` set) as HotspotDot within 20 s
**expected:** All three surfaces reflect the new clarification within ~1 s via realtime; if realtime drops, fallback poll picks it up within 20 s
**why_human:** Realtime + fallback polling behavior needs live observation
**result:** blocked
**blocked_by:** auth

## Summary

total: 9
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 9

## Gaps

- truth: "Browser-side fetches from LaunchPage UI authenticate with the API"
  status: failed
  reason: "All 9 HUMAN-UAT items blocked by HTTP 401 in production. Initial fix (commit e6a1cd5 — Bearer token attached via supabase.auth.getSession() helper) is in the repo but unconfirmed live; Vercel deploy verification was unstable when paused."
  severity: blocker
  test: 1
  artifacts:
    - src/lib/kotoiqProfileFetch.ts
    - src/views/kotoiq/LaunchPage.jsx
    - src/views/kotoiq/KotoIQShellPage.jsx
    - src/components/kotoiq/launch/ClarificationsTab.jsx
    - src/components/kotoiq/launch/ClarificationsOverlay.jsx
    - src/components/kotoiq/ConversationalBot.jsx
  missing:
    - Confirmed deployment of e6a1cd5 to hellokoto.com
    - Verified Authorization header on browser POST in production
    - Possible secondary fix if helper doesn't see operator's session
