---
phase: 7
slug: client-profile-seeder-v1-internal-ingest-gap-finder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> See `07-RESEARCH.md` §14 for the full validation architecture this file instantiates.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TBD — planner to resolve (research §14 flags: repo has no Vitest/Jest today; options are (a) install Vitest + add `npm test`, (b) ship manual-QA-only for v1) |
| **Config file** | TBD (vitest.config.ts if installed) |
| **Quick run command** | `npm test -- --run <file>` (if Vitest) OR `npm run build && npm run lint` (if manual-only) |
| **Full suite command** | `npm test -- --run` (if Vitest) OR full manual QA walkthrough |
| **Estimated runtime** | <30s unit, 2-3min manual QA |

---

## Sampling Rate

- **After every task commit:** Run quick command for the touched file(s)
- **After every plan wave:** Run full suite + type-check + lint
- **Before `/gsd-verify-work`:** Full suite green + UAT success criteria walked
- **Max feedback latency:** 60 seconds per commit

---

## Per-Task Verification Map

*Populated by planner per task — this seed maps the 5 ROADMAP success criteria + PROF-01..06 to verification types. Planner must expand to task-level granularity once plans exist.*

| Area | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Manual Check | Status |
|------|-------------|------------|-----------------|-----------|-------------------|--------------|--------|
| kotoiq_client_profile migration applies cleanly | PROF-01, PROF-04 | T-07-01 (agency isolation) | RLS policies deny cross-agency SELECT | integration | `supabase db push && psql -c "SELECT ..."` | — | ⬜ pending |
| getKotoIQDb(agencyId) enforces agency_id filter | PROF-01, PROF-04 | T-07-01 | All kotoiq_* reads/writes go through helper; direct calls fail ESLint | unit + lint | Vitest + custom ESLint rule | — | ⬜ pending |
| Internal source pullers produce VerifiedDataSource records | PROF-02, PROF-04 | T-07-04 (PII in pasted text) | source_url + captured_at + confidence on every field | unit | Vitest fixture-based | — | ⬜ pending |
| Paste `/onboard/:clientId` → 20+ fields resolved <10s | PROF-01, PROF-02 | — | N/A | E2E | manual timer + network panel | ✅ | ⬜ pending |
| Paste raw text → Claude extracts with char-offset citation | PROF-03 | T-07-02 (prompt injection) | Tool-use schema rejects extraction attempts to override instructions | integration | Vitest with mocked Anthropic | ✅ | ⬜ pending |
| Gap-finder returns ≤8 Qs (complete) / ≤15 Qs (partial) | PROF-05 | — | N/A | integration | Vitest fixture (two profile shapes) | ✅ | ⬜ pending |
| Every field carries full provenance quintet | PROF-04 | T-07-01, T-07-04 | source_type whitelist enforced at DB | unit | Vitest schema validation | — | ⬜ pending |
| pipelineOrchestrator Stage 0 emits entity graph seed | PROF-06 | — | N/A | integration | Vitest: seed → assert node/edge shape matches hyperlocalContentEngine input contract | — | ⬜ pending |
| Discrepancy catcher flags cross-source disagreements | PROF-05 | — | N/A | unit | Vitest fixture (3 sources with conflicting years) | ✅ | ⬜ pending |
| Clarification channel classifier routes SMS/email/portal | — | T-07-03 (clarification abuse) | Rate limit per client_id; operator approves before send | unit + integration | Vitest (Haiku mocked) + manual forward | ✅ | ⬜ pending |
| Chat widget + dashboard + hotspots share one queue | — | — | N/A | E2E | manual: answer via chat, watch dashboard + hotspot update | ✅ | ⬜ pending |
| Launch Page confidence halos reflect 0.0-1.0 field score | — | — | N/A | visual | manual QA against UI-SPEC tokens | ✅ | ⬜ pending |
| Live ribbon shows durable pipeline state after page refresh | — | T-07-05 (ribbon lost on cold start) | Reads `kotoiq_pipeline_runs` row, not in-memory Map | integration | Vitest + manual refresh | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Planner MUST resolve the framework question before Wave 1 executes:

- [ ] **Decision**: install Vitest (recommended — research §14) OR commit to manual-QA-only for v1 and flag automated tests as Phase 7.5 follow-up
- [ ] If Vitest: install `vitest`, `@vitest/ui`, `jsdom`; add `vitest.config.ts`; add `npm test` script
- [ ] If Vitest: add `__tests__/` or `tests/` conventions (confirm with project maintainer)
- [ ] Shared fixtures module for profile test data (one complete profile, one partial, one with discrepancies)
- [ ] Mock module for Anthropic SDK to avoid real API calls in tests
- [ ] `agency_isolation.test.ts` — ESLint rule that flags direct Supabase calls to `kotoiq_*` tables (enforces getKotoIQDb usage)

---

## Manual-Only Verifications

*These can never be automated meaningfully — they are UX / latency / perceptual checks.*

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming narration feels alive | D-07 | Perceptual UX quality | Paste link, watch 3+ narration chunks arrive within 2s each, verify no single block >3s gap |
| Confidence halos are visually distinguishable | D-08 | Color + opacity perception | Open Launch Page with profile containing bright / pale / dashed fields; verify they're distinguishable at arm's length on a 14" MBP screen |
| Margin notes feel like Claude-observations, not nagging | D-10 | Tone and placement | Review 3 populated profiles; count margin notes per profile; <4 per screen is target |
| Discrepancy callout is the "wow" moment | D-11 | Perceptual delight | Populate profile with 3 conflicting year sources; verify pink dot + callout surfaces prominently |
| Soft launch gate readout makes sense | D-13 | Natural-language quality | Read the "94%, 3 soft gaps remain" line on 5 sample profiles; does it sound natural? |
| Chat widget answers "summarize what you know" | D-16 | LLM quality | Open widget, type "summarize what you know about [client]"; verify response is factual and grounded in profile fields |
| <10s total paste-link-to-profile latency | ROADMAP §1 | Wall clock | Stopwatch on 3 separate Koto clients with realistic data; P50 <10s |

---

## Validation Sign-Off

- [ ] Every plan's tasks have either `<automated>` verify, `<manual>` marker, or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify OR explicit manual marker
- [ ] Wave 0 covers the framework decision + fixtures + agency-isolation lint rule
- [ ] No watch-mode flags (tests must run non-interactively in CI)
- [ ] Feedback latency <60s per commit
- [ ] All 5 ROADMAP success criteria have at least one verification row above
- [ ] All 6 PROF-XX requirements have at least one verification row above
- [ ] `nyquist_compliant: true` set in frontmatter once above is true

**Approval:** pending

---

*Generated from 07-RESEARCH.md §14 — Validation Architecture. Planner expands per-task rows during plan generation.*
