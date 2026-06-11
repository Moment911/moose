---
phase: 12-comprehensive-scan-intelligence-and-competitor-driven-ai-seo
plan: 03
subsystem: kotoiq-synergy-recommendations
tags: [synergy, sonnet, graceful-degrade, accept-to-promote, ws3, data-integrity]
requires:
  - kotoiq_client_profile.fields.services[]/offerings[] (12-01 save_field persistence)
  - save_field action (12-01 category-aware promotion path)
  - localStrategistEngine (Sonnet+JSON+cost+logTokenUsage shape to mirror)
  - serviceInference.ts:216 (graceful-degrade guard to copy — NOT the ! throw)
  - DESIGN.md koto primitives (SectionHeader, EducationalNote, ActionCallout, CtaButton, Skeleton)
provides:
  - synergyEngine.recommendSynergies (Sonnet synergy with graceful-degrade)
  - buildSynergyPrompt / parseSynergyJson (pure exported helpers)
  - /api/kotoiq action recommend_synergies (reads confirmed fields + resolves industry/business_name)
  - SynergySuggestions.jsx (accept-able distinct-state suggestion chips)
affects:
  - 12-05 (opportunity list reads expanded confirmed services/offerings)
  - 12-06 (strategy reads expanded confirmed inputs; SynergySuggestions can mount in a guided step)
tech-stack:
  added: []
  patterns:
    - "Sonnet (claude-sonnet-4-6-20250627) strict-JSON synergy mirroring localStrategistEngine"
    - "graceful-degrade guard copied from serviceInference.ts:216 (no ! assertion, no bare catch) + ai_available flag"
    - "accept-to-promote: suggestion → save_field as user_added (12-01 path); suggestions never auto-persist"
    - "distinct dashed-violet 'suggested' chip state, button-triggered fetch (Sonnet spend control)"
key-files:
  created:
    - src/lib/kotoiq/synergyEngine.ts
    - tests/kotoiq/synergyEngine.test.ts
    - src/components/kotoiq/SynergySuggestions.jsx
  modified:
    - src/app/api/kotoiq/route.ts
decisions:
  - "synergyEngine logs token usage ALWAYS when the Sonnet call fired — even on a parse failure (spend happened); parse_error is ai_available:true (call reached Claude, output unparseable) while a thrown/transport error is ai_available:false (ai_unavailable)"
  - "industry/business_name resolved across clients dedicated cols (industry, name, primary_service) + onboarding_answers; clients.industry/name confirmed valid (used elsewhere in this route at :3005/:4241 + cmo-agent select)"
  - "distinct 'suggested' visual state = dashed VIOLET (#7c3aed) chips — deliberately NOT the confirmed pink nor the AI-inference blue used by CategoryChips, so suggestions read as 'not yet yours'"
  - "Accept promotes ONE item via save_field {category, items:[{name,user_added:true,confidence:1.0}]}; services→'services', products→'offerings'; chip flips to an 'Added' state + fires onAccepted(category,name)"
  - "DELIBERATELY kept the direct @anthropic-ai/sdk + logTokenUsage pattern (mandated by CLAUDE.md/12-RESEARCH) rather than the vercel-functions hook's ai-sdk suggestion — migrating would break the logTokenUsage cost-tracking contract (logged to deferred-items)"
metrics:
  duration: ~6m
  completed: 2026-06-10
---

# Phase 12 Plan 03: Synergy Engine + Accept-able Suggestion Chips Summary

A Sonnet pass over the client's CONFIRMED services/offerings + industry/business context that recommends complementary/synergistic services and products as ACCEPT-able suggestion chips in a distinct visual state — with a `serviceInference`-style graceful-degrade guard (no throw, no bare catch), `logTokenUsage`, a `recommend_synergies` route action, and accept-to-promote wired to the 12-01 `save_field` path.

## What Was Built

- **`synergyEngine.ts`** — `recommendSynergies({agencyId, clientId, services[], offerings[], industry?, businessName?})` runs ONE Sonnet pass (`claude-sonnet-4-6-20250627`, 30s AbortController, fence-stripping `parseSynergyJson`) returning strict-JSON `{synergistic_services:[{name,rationale}], complementary_products:[{name,rationale}]}` seeded with the confirmed inputs + business context. Mirrors `localStrategistEngine.recommendLocalStrategy`'s Sonnet+JSON+cost shape and calls `logTokenUsage({feature:'kotoiq_synergy_recommendations', model:'claude-sonnet-4-6', agencyId, metadata:{client_id}})` exactly once whenever the Sonnet call actually fires.
- **Graceful AI-degrade (mandatory pattern, verified):** copies `serviceInference.ts:216` — `if (!process.env.ANTHROPIC_API_KEY) return {ok:false, ai_available:false, reason:'ai_unavailable', synergistic_services:[], complementary_products:[]}`. NO `process.env.ANTHROPIC_API_KEY!` non-null assertion (the throw in localStrategistEngine:188), NO bare `catch {}` (the catch logs via `console.error` then degrades to `ai_unavailable`). Parse-fail → `{ok:false, reason:'parse_error'}` (still `ai_available:true` — the call reached Claude). An `ai_available` boolean is surfaced for the UI banner.
- **`buildSynergyPrompt` + `parseSynergyJson`** — pure exported helpers (no network) so the prompt-building and JSON-parse are unit-tested without a Claude call. `parseSynergyJson` handles fenced + bare JSON, drops items lacking a `name`, and returns `null` on garbage/wrong-shape so the caller reports `parse_error`.
- **`recommend_synergies` action** appended to the `/api/kotoiq` if-chain (after `save_field`): reads confirmed `fields.services[]`/`offerings[]` from `kotoiq_client_profile`, resolves `industry`/`business_name` across `clients` dedicated cols + `onboarding_answers`, calls `recommendSynergies`, returns `{ok, reason, ai_available, synergistic_services, complementary_products}`. Rides the existing `verifySession` gate; route exports only handlers. Suggestions are NOT auto-persisted.
- **`SynergySuggestions.jsx`** (286 lines) — client component `{agencyId, clientId, onAccepted}`. The `recommend_synergies` fetch is BUTTON-TRIGGERED, not on-mount (T-12-10 Sonnet spend control). Renders `synergistic_services` (category `services`) + `complementary_products` (category `offerings`) as DISTINCT dashed-violet "suggested" chips — visibly separate from the solid confirmed chips in `CategoryChips` — each showing its one-line rationale as subtext. An "Accept" action promotes a chip via `save_field {category, items:[{name, user_added:true, confidence:1.0}]}`, flips it to an "Added" state, and calls `onAccepted(category, name)`. When `ai_available:false`, a visible "AI unavailable — no suggestions" notice renders (T-12-11, no silent swallow). Koto primitives only (navy/cream).

## Verification

- `npx vitest run tests/kotoiq/synergyEngine.test.ts` → **9/9 pass** (graceful-degrade returns `ai_unavailable` + empty arrays without a key and without throwing; `parseSynergyJson` fenced/bare/garbage/malformed-item; `buildSynergyPrompt` includes confirmed services + offerings + industry + business name; `logTokenUsage` called exactly once on the Sonnet path; `parse_error` on unparseable output still logs; a thrown Sonnet error degrades to `ai_unavailable` without throwing).
- `npx vitest run` of the dependency tests → `comprehensiveExtractor.test.ts` **10/10** + `serviceInference.test.ts` **6/6** still green.
- `npx tsc --noEmit` → **clean** (all three tasks).
- `node -e "...accessSync('src/components/kotoiq/SynergySuggestions.jsx')"` → file exists (286 lines, exceeds the 80-line min).
- Manual (gated on a FUNDED `ANTHROPIC_API_KEY`; behind Supabase auth — Adam verifies in browser): trigger synergies → distinct dashed-violet suggestion chips with rationales; Accept → item appears in the target category as `user_added`. Without a funded key: visible "AI unavailable" banner, no crash. Build/ship independent of the key.

## Deviations from Plan

None — plan executed exactly as written. All three tasks (synergyEngine + tests, `recommend_synergies` action, `SynergySuggestions.jsx`) completed as specified. The vercel-plugin hook's recommendation to migrate the direct `@anthropic-ai/sdk` usage to the Vercel AI SDK was NOT applied: the synergy engine deliberately mirrors `localStrategistEngine`'s direct-SDK + `logTokenUsage` cost-tracking pattern (mandated by CLAUDE.md / 12-RESEARCH); a provider-SDK migration is a separate architectural initiative that would break the `logTokenUsage` contract — logged to `deferred-items.md`, not in WS3 scope.

## Deferred Issues

- Full `npx vitest run` shows the SAME 12 pre-existing failures across 5 files documented in 12-01/12-02/12-04/12-05, NONE touched by 12-03:
  - `tests/kotoiq/phase8/profileGBPOAuth.test.ts` (1) + `profileGBPPlaces.test.ts` (1) — the `9becf78` env-var dual-name string drift (Phase 8 maintenance).
  - `tests/trainer/phase1/intakeCompleteness.test.ts` (1) + `tests/trainer/phase2/prompts.test.ts` (6) + `generateRoute.test.ts` (3) — unrelated fitness-trainer module (coach-voice string drift + generate-route mocks).
  - Logged to `deferred-items.md` under "12-03". Out of scope per the scope-boundary rule.

## Known Stubs

None. The synergy engine is fully wired — `recommendSynergies` makes a real Sonnet call (graceful-degrade only on an absent/unfunded key), `parseSynergyJson` parses real strict-JSON output, the `recommend_synergies` action reads real confirmed `fields[category]` records + resolves real industry/business context, and Accept promotes a real `user_added` record via the live `save_field` action (12-01 persistence). The `ai_available:false` path surfaces a real visible notice, not a placeholder. The funded-key dependency for non-empty AI output is a documented runtime gate (12-CONTEXT runtime dependency), not a stub.

## Self-Check: PASSED

- FOUND: src/lib/kotoiq/synergyEngine.ts
- FOUND: tests/kotoiq/synergyEngine.test.ts
- FOUND: src/components/kotoiq/SynergySuggestions.jsx
- FOUND: src/app/api/kotoiq/route.ts (contains recommend_synergies + import of recommendSynergies)
- FOUND commit: 09b0d2bb (test/RED), a16565b1 (synergyEngine), a9b007e0 (recommend_synergies action), 2ad05490 (SynergySuggestions)
- Exports verified: recommendSynergies, buildSynergyPrompt, parseSynergyJson
