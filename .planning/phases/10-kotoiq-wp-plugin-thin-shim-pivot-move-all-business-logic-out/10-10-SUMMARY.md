---
phase: 10-kotoiq-wp-plugin-thin-shim-pivot
plan: 10
subsystem: api
tags: [dual-run, shadow-mode, diff-engine, supabase, vitest, react, typescript]

# Dependency graph
requires:
  - phase: 10-kotoiq-wp-plugin-thin-shim-pivot
    provides: "koto_wp_dual_run_log schema (Plan 01), shimRpc + 27-verb whitelist (Plan 03/04), legacy /api/wp dispatcher (back-compat target), Plan 09 canonical /api/kotoiq-wp route shape"
provides:
  - "diffEngine: compareResponses + summarizeDiff + hashResponse with DIFF_IGNORE_KEYS ignore-list (timestamps, nonces, request IDs)"
  - "dualRunRouter: createDualRunRouter() wraps verb calls with parallel v3+v4 firing per mode (inactive / active / promoted / rolled_back)"
  - "V4_TO_V3_ACTION_MAP: full 27-verb coverage; resolveV3Action() handles variant routing for query.select + option.update"
  - "/api/kotoiq-wp/dual-run operator API: 5 ALLOWED_ACTIONS (get_status, list_recent_diffs, list_diff_detail, set_mode, list_sites)"
  - "KotoIQWPDualRunPanel.jsx: 3-pane operator UI with site picker + mode switcher + 7d stats + drill-down"
  - "ViewToggle + KotoIQWPPage 'dualrun' sub-tab wiring"
affects: [10-11 (cutover playbook reads dual-run log to gate promotion), 10-12 (sunset uses promote-state-machine)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shadow-mode dual-run with hashed (not raw) body storage for privacy + size"
    - "Mode state-machine on koto_wp_sites.dual_run_state (inactive → active → promoted | rolled_back)"
    - "Insert-fail-silent contract: shadow logging NEVER propagates DB errors to the caller"
    - "Per-call probabilistic sampling (1% via Math.random() in promoted mode)"

key-files:
  created:
    - "src/lib/wp-shim/dualRun/diffEngine.ts"
    - "src/lib/wp-shim/dualRun/diffEngine.test.ts"
    - "src/lib/wp-shim/dualRun/dualRunRouter.ts"
    - "src/lib/wp-shim/dualRun/dualRunRouter.test.ts"
    - "src/lib/wp-shim/dualRun/index.ts"
    - "src/app/api/kotoiq-wp/dual-run/route.ts"
    - "src/views/kotoiq/KotoIQWPDualRunPanel.jsx"
  modified:
    - "src/lib/wp-shim/index.ts (re-export dualRun barrel)"
    - "src/lib/wp-shim/types.ts (add 'v4_only' to DualRunLogRow.diff_status union)"
    - "src/components/kotoiq-wp/ViewToggle.jsx (add 'dualrun' segment)"
    - "src/views/KotoIQWPPage.jsx (wire KotoIQWPDualRunPanel sub-tab)"

key-decisions:
  - "Diff engine ignores timestamp-family keys at any depth (last-segment match) — minor_diff for clock skew, major_diff for any real change"
  - "Array comparison is order-sensitive (per plan) — list reorderings count as major_diff so Plan 11 catches PHP→TS sort-stability drift"
  - "callV3Endpoint prefers res.json() then falls back to res.text() + JSON.parse — handles both real fetch and common test mocks"
  - "set_mode auto-stamps dual_run_started_at on transition to 'active' and v4_promoted_at + shim_version='v4' on transition to 'promoted'"
  - "Logging insert wrapped in try/catch; failures console.error'd but never propagated — v4 result is what the caller depends on"

patterns-established:
  - "Hash-only dual-run logging: sha256(JSON.stringify with sorted keys) for args + v3 body + v4 body; full bodies never persisted"
  - "Mode-based switch point: createDualRunRouter takes mode at construction; operator UI flips via /api/kotoiq-wp/dual-run set_mode"
  - "Verbs with no v3 equivalent (file.*, transient.*, cron.*, webhook.*, database.*) log diff_status='v4_only' which counts as match for promotion gating"

requirements-completed: [SHIM-DUAL-RUN-SHADOW]

# Metrics
duration: 9min
completed: 2026-05-27
---

# Phase 10 Plan 10: 7-day dual-run shadow mode Summary

**diffEngine + dualRunRouter shadow-firing v3 alongside v4 with hash-only privacy-safe log persistence, plus operator API + 3-pane UI for per-site mode switching and 7-day match% monitoring**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-27T02:39:04Z
- **Completed:** 2026-05-27T02:48:16Z
- **Tasks:** 2 (both with TDD: RED → GREEN flow)
- **Files created:** 7
- **Files modified:** 4
- **Tests added:** 28 (17 diffEngine + 11 dualRunRouter); all pass

## Accomplishments

- diffEngine: full semantic compare with 13-key ignore-list, customizable per-call, max-5 samples cap to keep log rows small
- hashResponse: deterministic sorted-key sha256 regardless of caller input key order; null/undefined distinct; array-order sensitive
- dualRunRouter: 4-mode state machine wired into shimRpc + /api/wp legacy fetch
  - inactive / rolled_back → v3 only, no insert
  - active → v3 + v4 parallel, v4 returned, diff logged
  - promoted → v4 only, 1% sampling
  - v4_only path for verbs with no v3 equivalent
- V4_TO_V3_ACTION_MAP covers all 27 SHIM_VERBS (17 mapped, 10 null) — resolveV3Action handles variant routing for query.select + option.update
- Operator API (5 ALLOWED_ACTIONS) + 3-pane React UI panel + ViewToggle 4th-tab wiring
- DESIGN.md compliance: Unified Marketing navy/pink/cream palette + green/amber/red diff status semantics

## Task Commits

Each task committed atomically (TDD: RED → GREEN):

1. **Task 1 RED — failing tests for diffEngine + dualRunRouter** — `f2d28c01` (test)
2. **Task 1 GREEN — diffEngine + dualRunRouter implementation** — `77b3855f` (feat)
3. **Task 2 — operator API + UI panel + parent wiring** — `b88bee37` (feat)

_Task 2 was implementation-first because the plan's verify step is `npx tsc --noEmit` (no .test file in `<files>`); acceptance criteria are grep-based on the route/panel artifacts._

## Files Created/Modified

### Created
- `src/lib/wp-shim/dualRun/diffEngine.ts` — recursive object/array walker + DIFF_IGNORE_KEYS classification + sorted-key sha256
- `src/lib/wp-shim/dualRun/diffEngine.test.ts` — 17 tests
- `src/lib/wp-shim/dualRun/dualRunRouter.ts` — createDualRunRouter factory + V4_TO_V3_ACTION_MAP + callV3Endpoint + logDualRun
- `src/lib/wp-shim/dualRun/dualRunRouter.test.ts` — 11 tests covering all 4 modes
- `src/lib/wp-shim/dualRun/index.ts` — barrel
- `src/app/api/kotoiq-wp/dual-run/route.ts` — operator JSON dispatcher (verifySession → 5 actions)
- `src/views/kotoiq/KotoIQWPDualRunPanel.jsx` — 3-pane operator UI

### Modified
- `src/lib/wp-shim/index.ts` — append `export * from './dualRun'`
- `src/lib/wp-shim/types.ts` — add 'v4_only' to DualRunLogRow.diff_status union
- `src/components/kotoiq-wp/ViewToggle.jsx` — add 'dualrun' segment
- `src/views/KotoIQWPPage.jsx` — wire KotoIQWPDualRunPanel as 4th sub-tab + URL/localStorage state

## Decisions Made

- **Ignore-list scope = last segment, any depth.** A `time` key at `data.posts[0].time` matches DIFF_IGNORE_KEYS just as a top-level `time` does. Reasoning: timestamps appear at every layer of WP responses (`post_modified`, `_meta.updated_at`, etc.) — a path-prefix-only check would miss them.
- **Array order matters.** Per plan and per the spirit of the diff (PHP and TS may sort differently and the operator wants to see that). Tests cover both length-mismatch and same-length reorder.
- **`v4_only` counts as match for promotion.** Verbs with no v3 equivalent (file.write, transient.*, etc.) didn't exist in v3 — they can't diff. Plan 11 treats them as success contributing to the 7-day clean window.
- **Logging is fire-and-forget.** A DB outage on `koto_wp_dual_run_log` insert cannot block a successful v4 call; the row would be reconstructable from server logs if needed for forensic work.
- **Mode auto-stamps timestamps.** Transition → 'active' stamps `dual_run_started_at`; transition → 'promoted' stamps `v4_promoted_at` + `shim_version='v4'` so Plan 12 sunset can detect promotion state.
- **Operator UI is read-mostly with a single write (set_mode).** Matches the plan's threat-register principle that only the mode switch needs careful agency scoping — every other action is observation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] callV3Endpoint failed to parse common test-mock response shape**
- **Found during:** Task 1 GREEN (running dualRunRouter tests after implementation)
- **Issue:** The initial implementation called `res.text()` and `JSON.parse(text)` — but test mocks (and many real fetch responses) provide `.json()` as the canonical body accessor with empty `.text()`. Result: v3.data was null in tests, the diff falsely classified as `major_diff`.
- **Fix:** Try `res.json()` first; fall back to `res.text() + JSON.parse` for plain-text mocks / error pages.
- **Files modified:** src/lib/wp-shim/dualRun/dualRunRouter.ts
- **Verification:** All 28 dualRun tests pass.
- **Committed in:** 77b3855f (Task 1 GREEN commit)

**2. [Rule 2 - Missing Critical] 'v4_only' missing from DualRunLogRow.diff_status type union**
- **Found during:** Task 1 GREEN typecheck phase
- **Issue:** Plan 01 schema and the new dualRunRouter both reference `'v4_only'` as a valid diff_status (verbs with no v3 equivalent), but the existing TypeScript type union in `src/lib/wp-shim/types.ts` (defined back in Plan 01) didn't include it. Without this fix, downstream consumers (UI, future Plan 11) would type-error when reading the column.
- **Fix:** Added `'v4_only'` to the discriminated union.
- **Files modified:** src/lib/wp-shim/types.ts
- **Committed in:** 77b3855f (Task 1 GREEN commit)

**3. [Rule 2 - Missing Critical] /api/kotoiq-wp/dual-run set_mode missing audit trail**
- **Found during:** Task 2 implementation
- **Issue:** Plan's `behavior` block specified set_mode should update koto_wp_sites — but Plan 01 also created koto_wp_shim_pairings as the append-only audit log for mode transitions. Skipping the audit write would leave promotion/rollback events untraceable.
- **Fix:** After successful UPDATE, append `koto_wp_shim_pairings` row with event ∈ {promoted_to_v4, rolled_back, pair_completed}. Wrapped in try/catch (best-effort).
- **Files modified:** src/app/api/kotoiq-wp/dual-run/route.ts
- **Committed in:** b88bee37 (Task 2 commit)

**4. [Rule 2 - Missing Critical] No-v3-equivalent handling in inactive/rolled_back modes**
- **Found during:** Task 1 GREEN implementation
- **Issue:** The plan's runVerb logic for inactive/rolled_back calls callV3Endpoint directly and returns its result. But for verbs without a v3 equivalent (file.write, etc.), this would silently return `{ ok: false, _no_v3: true, ... }` as if v3 errored — a confusing failure mode.
- **Fix:** Detect `_no_v3` and return a structured `{ ok: false, error: { code: 'v3_unavailable', ... } }`. Caller sees an explicit "this verb requires v4 — site is not in v4 mode" instead of a misleading v3 error.
- **Files modified:** src/lib/wp-shim/dualRun/dualRunRouter.ts
- **Committed in:** 77b3855f (Task 1 GREEN commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 3 missing-critical) — all per Rule 1/2 (correctness + audit completeness).
**Impact on plan:** No scope creep. All fixes serve the plan's stated goals (auditable mode transitions, type-safe schema, clean error semantics).

## Issues Encountered

None — TDD flow caught the only bug (callV3Endpoint body-parsing) before commit; typecheck was clean on first run; UI compiled cleanly into the existing parent.

## Plan Output Requirements (per `<output>` block)

- **V4_TO_V3_ACTION_MAP coverage:** 27/27 verbs (full SHIM_VERBS coverage). 17 mapped to v3 action names; 10 mapped to null (no v3 equivalent). resolveV3Action() refines query.select + option.update at runtime based on args.
- **Privacy + agency scoping:** Confirmed — logDualRun always sets agency_id + site_id from router closure; args/responses always hashed (sha256, never raw); diff_summary samples capped at 5 entries.
- **Test count:** 28 total (17 diffEngine + 11 dualRunRouter), exceeds plan target of ≥15.
- **DESIGN.md compliance:** KotoIQWPDualRunPanel uses theme constants (R, BLK from `../../lib/theme`) for navy/pink/cream consistent with Phase 9 components. Status chips use green (#0d9e6e) / amber (#f59e0b) / red (#dc2626) semantics. Mode chips use the same palette. Card pattern (white background, 12px radius, #e9e6dd border) matches KotoIQWPTemplatesTab.
- **Unclean v4-to-v3 mappings (for Plan 11 review):**
  - `query.select` → varies by named query; resolveV3Action handles `posts.list_by_meta`, `posts.list_by_post_type`, `options.list_by_prefix`; others fall through to `kotoiq_seo_pages` (will produce false major_diff on those — Plan 11 should review).
  - `option.update` → varies by option name; `kotoiq_shim_snippets` → `am_save`, `kotoiq_access_*` → `access_apply`, redirect-prefixed → `update_settings`; remainder default to `update_settings` (Plan 11 should review redirect/snippet write paths).
  - `health.diagnostics` → mapped to v3 `meta` for now (v3 has no diagnostics endpoint with the same payload); will produce minor_diff or major_diff during dual-run.
  - `post.get_meta_bulk` → mapped to `kotoiq_seo_content_get` as a placeholder; v3 didn't have a bulk-meta endpoint, will likely produce major_diff for any non-trivial call.

## Known Stubs

None. All UI components are wired to real API endpoints; the API endpoints query real Supabase tables; the diffEngine + router both produce real data.

## Self-Check: PASSED

All 7 created files exist on disk and all 3 task commits exist in git history:
- diffEngine.ts / diffEngine.test.ts / dualRunRouter.ts / dualRunRouter.test.ts / index.ts / route.ts / KotoIQWPDualRunPanel.jsx
- f2d28c01 (RED) / 77b3855f (GREEN) / b88bee37 (UI)

All 28 vitest tests pass. `npx tsc --noEmit` returns 0 errors for the dualRun + dual-run paths.

## User Setup Required

None — no env vars, no external service configuration. The existing `NEXT_PUBLIC_APP_URL` env (already set in Vercel per `_knowledge/env-vars.md`) is used by callV3Endpoint to find the legacy /api/wp endpoint.

## Next Phase Readiness

- Plan 10-11 (cutover playbook) can now use `/api/kotoiq-wp/dual-run` `get_status` to gate per-site promotion on the 7-day clean window (`window.counts.major_diff === 0 && window.total > 0 && site.dual_run_started_at older than 7 days`).
- Plan 10-12 (sunset) can use the `shim_version='v4'` + `v4_promoted_at` columns set by `set_mode` to detect which sites have completed cutover.
- The operator UI is immediately usable: navigate to `/kotoiq-wp?view=dualrun`, pick a paired v4 site, see 7-day match%, drill into recent diffs, flip mode with confirmation.

---
*Phase: 10-kotoiq-wp-plugin-thin-shim-pivot*
*Completed: 2026-05-27*
