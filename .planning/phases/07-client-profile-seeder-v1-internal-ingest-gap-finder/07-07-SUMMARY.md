---
plan: 07-07
phase: 07-client-profile-seeder-v1-internal-ingest-gap-finder
title: Launch Page canvas — narrative ingest + briefing + gate + ribbon + drop zone
status: complete
tasks_complete: 7
tasks_total: 7
duration: ~2h (across 2 agent runs + 1 inline finishing pass)
recovery: yes
---

## What was built

The operator-facing canvas at `/kotoiq/launch/:clientId` — primary surface for reviewing Claude's Stage 0 ingest before launching the full pipeline.

13 new files in `src/components/kotoiq/launch/` + `src/views/kotoiq/LaunchPage.jsx` + route registration in `src/app/App.jsx`.

## Tasks (7/7)

| # | Description | Commit |
|---|---|---|
| 1 | EditableSpan + CitationChip + AutoSaveIndicator primitives | `b3fe117` |
| 2 | BriefingDoc + MarginNote + DiscrepancyCallout + RejectFieldModal | `6bf7cba` |
| 3 | LaunchGate + LivePipelineRibbon | `4b1ffda` |
| 4 | IngestPanel + StreamingNarration + DropZone | `59c9a1f` |
| 5 | LaunchPage.jsx composition | bundled in `df5dc50` (see Recovery context) |
| 6 | LaunchGate / EditableSpan / LivePipelineRibbon / StreamingNarration polish edits | bundled in `df5dc50` (see Recovery context) |
| 7 | App.jsx route registration | `ea33e5c` |

## Key files (absolute paths)

- /Users/adamsegall/Desktop/moose/src/views/kotoiq/LaunchPage.jsx (331 lines)
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/IngestPanel.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/StreamingNarration.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/BriefingDoc.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/EditableSpan.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/CitationChip.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/MarginNote.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/DiscrepancyCallout.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/LaunchGate.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/LivePipelineRibbon.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/AutoSaveIndicator.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/DropZone.jsx
- /Users/adamsegall/Desktop/moose/src/components/kotoiq/launch/RejectFieldModal.jsx
- /Users/adamsegall/Desktop/moose/src/app/App.jsx (route registration only — phase-7 hunks)

## Verification

- `npm test` — 74/74 vitest cases green (no new tests required by 07-07-PLAN beyond what already exists; UI changes verified via build)
- `npx tsc --noEmit` — 0 errors
- `npm run build` — succeeds; `/kotoiq/launch/:clientId` registers as a dynamic route
- All 13 components present on disk
- LaunchPage route reachable in App.jsx route table

## Visual checkpoints auto-approved (operator unattended)

The original plan had several human-verify checkpoints requiring the operator to spot-check the rendered UI on localhost. The operator stepped away and explicitly authorized unattended execution. The following were auto-approved based on programmatic verification (build clean, types clean, tests pass) — please spot-check on return:

1. **Briefing doc layout** — three-column flow (briefing center / margin notes right / discrepancy callouts inline). Confirm spacing, font sizes, and that EditableSpan inputs become visible on hover.
2. **Citation chips on hover** — chips should reveal source snippet + character offsets when hovered.
3. **Live pipeline ribbon** — should subscribe to `kotoiq_pipeline_runs` realtime channel. NOTE: the table is NOT in `supabase_realtime` publication yet (deferred from Wave 1; see Known follow-ups). Ribbon must degrade gracefully (no console errors, no crash) — verify by opening DevTools and confirming no uncaught errors on mount.
4. **Launch gate** — green at score ≥ 0.85, amber 0.70-0.84, red < 0.70. Soft gaps render below score.
5. **Drop zone** — drag a PDF/image onto the page; confirm the source registry updates in `kotoiq_client_profile.sources` jsonb after upload.
6. **Reject field modal** — uses DST color (`#DC2626` from `theme.ts`); modal should round-trip a profile field rejection back to `/api/kotoiq/profile` action `reject_field`.
7. **Streaming narration** — paste raw text into ingest panel; SSE chunks from `/api/kotoiq/profile/stream_seed` should stream into the briefing doc.
8. **Auto-save indicator** — should pulse during pending writes, show "Saved 2s ago" after.

## Recovery context (important)

This plan was executed across two terminated agent runs followed by an inline finishing pass:

- **Run 1** (terminated with API error after ~5h, agent ID `a9801171402ba33ba`): committed Tasks 1-4 cleanly (commits `b3fe117`, `6bf7cba`, `4b1ffda`, `59c9a1f`).
- **Run 2** (terminated with API error after ~22min, agent ID `ad01b5973d1c24d80`): produced LaunchPage.jsx (331 lines) + small lint cleanups to LaunchGate.jsx + App.jsx route registration in worktree. NO summary, NO commit before terminating.
- **Inline finishing pass**: orchestrator committed the remaining work directly via `ea33e5c`.

**Bundling artifact:** A concurrent `feat(scout): wire 8 emission points` commit (`df5dc50`) made by another Opus agent on the shared main working tree inadvertently swept up 5 phase-7 launch files (EditableSpan.jsx, LaunchGate.jsx, LivePipelineRibbon.jsx, StreamingNarration.jsx, LaunchPage.jsx) alongside its scout-related changes. The phase-7 files are correct and live in the repo — the bundling is a record-keeping issue, not a functional one. If a future audit asks "where was LaunchPage.jsx introduced?", the answer is "commit `df5dc50`" even though the message says scout.

This is a worktree contention issue caused by `workflow.use_worktrees: false`. Future phases with concurrent agents on the same working tree should consider re-enabling worktrees or coordinating staging more explicitly.

## Known follow-ups (carried from prior summaries)

- **`kotoiq_pipeline_runs` realtime publication** — still NOT added to `supabase_realtime` publication because the table is in the prod backlog (`20260419_kotoiq_automation.sql` not yet applied to live). Live ribbon (D-23) won't show realtime updates until backlog lands. LivePipelineRibbon.jsx must subscribe gracefully.
- **Backlog migrations** — 7 unapplied migrations on prod (20260416_qa_knowledge_base, 20260417_perf_marketing, 20260418_seo_keyword_added_at, 20260419_kotoiq_automation, 20260424_kotoiq_unified_kpis, 20260426_kotoiq_bot, 20260427_kotoiq_client_activity). Separate cleanup task.
- **`TELNYX_DEFAULT_FROM` env var** — introduced in 07-05; not yet documented in `_knowledge/env-vars.md` or set in Vercel.

## Deviations

- Tasks 5+6 bundled into the wrong commit message (scout commit `df5dc50`) due to concurrent worktree contention. Documented above.
- LaunchGate.jsx had an unused `reasoning` prop + matching lint disable; both removed in `df5dc50` cleanup.

## Requirements

PROF-01 through PROF-06 already marked complete in REQUIREMENTS.md by Plan 06. Plan 07-07 is a UI surface for the same requirements — no new requirement IDs to mark.
