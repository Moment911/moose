---
phase: 11-kotoiq-wp-guided-onboarding-and-competitor-driven-gap-engine
plan: 01
subsystem: kotoiq-wp-orchestration
tags: [orchestration, webhooks, fire-and-forget, auth, wp-shim]
requires:
  - "pairSite() v4 pair handshake (Phase 10)"
  - "webhookSet() shim verb (Phase 10)"
  - "run_all_audits action /api/kotoiq (existing)"
provides:
  - "orchestrateOnboarding() — post-pair fire-and-forget chain"
  - "POST /api/kotoiq/wp-event — authenticated inbound save_post/publish_post receiver"
  - "verifyWpEvent() — capability-token auth for the inbound webhook"
affects:
  - "src/app/api/wp/route.ts (shim_pair_new_site)"
  - "Plan 11-02 (baselineSnapshot — soft consumer of both new entry points)"
tech-stack:
  added: []
  patterns:
    - "run_all_audits detached-async fetch (re-POST /api/kotoiq with CRON_SECRET)"
    - "capability-token-in-URL auth against a locked, no-auth emitter"
    - "variable import specifier for runtime-only soft dependency (tsc-clean before dependant plan lands)"
key-files:
  created:
    - "src/lib/kotoiq/wpEventAuth.ts"
    - "src/lib/kotoiq/orchestrateOnboarding.ts"
    - "src/app/api/kotoiq/wp-event/route.ts"
    - "tests/kotoiq/wpEventAuth.test.ts"
    - "tests/kotoiq/orchestrateOnboarding.test.ts"
  modified:
    - "src/app/api/wp/route.ts"
decisions:
  - "Wire orchestration at /api/wp shim_pair_new_site after pairSite success (RESEARCH A1), NOT seo/wp-register"
  - "Receiver auth = capability token in registered webhook URL — the only surface available against the locked no-auth shim emitter"
  - "WS2 baseline is a guarded variable-specifier dynamic import so 11-01 lands tsc-clean before 11-02"
metrics:
  duration: ~15min
  completed: 2026-06-09
  tasks: 3
  files: 6
---

# Phase 11 Plan 01: Orchestration Spine + Webhook Receiver Summary

JWT-free capability-token auth + a fire-and-forget post-pair chain that kicks `run_all_audits`, soft-invokes the WS2 baseline, and registers `save_post`/`publish_post` webhooks at the real v4 pair-completion point.

## What Was Built

**Task 0 — `verifyWpEvent` (`src/lib/kotoiq/wpEventAuth.ts`)**
Authenticates the inbound webhook POST. After reading the LOCKED shim emitter (`wp-plugin-kotoiq-shim/runtime/webhook-emitter.php`, v4.2.5, reference-only), the critical finding is that **the emitter sends NO auth of its own** — no shared secret, no HMAC, no signature. Each emitted POST is only `headers: {Content-Type, X-Koto-Shim-Event}` + body `{event, payload, site_url, time}`. Because the plugin is locked we cannot add plugin-side auth. The only authentication surface left is the **URL we register via `webhook.set`** (the emitter POSTs to whatever URL was stored, query string included). So the auth scheme is a **capability/bearer token carried in the registered URL** (`?token=<KOTOIQ_WP_EVENT_SECRET>`), constant-time compared against the env var. Accepts the token via `?token=` query (what the emitter sends) or `X-Koto-Webhook-Token` header (forward-compat). Fails closed on missing secret, missing/invalid token, bad JSON, or missing `site_url`. 7 tests.

**Task 1 — `orchestrateOnboarding` (`src/lib/kotoiq/orchestrateOnboarding.ts`, TDD)**
Fire-and-forget chain: (1) kicks `run_all_audits` for the client by re-POSTing `/api/kotoiq` with `Authorization: Bearer ${CRON_SECRET}` (mirrors the existing detached-async runner verbatim); (2) soft-invokes the WS2 baseline snapshot via a guarded variable-specifier dynamic import (no hard dep on Plan 11-02); (3) registers `save_post` + `publish_post` via `webhookSet(siteUrl, {event, url})` pointing at `${baseUrl}/api/kotoiq/wp-event?token=…`. Each `webhookSet` is individually try/caught (it THROWS on bad input), legs run concurrently and isolated, every leg's outcome is captured in a structured `OrchestrationResult`, and the function **never throws** to its caller. Receiver URL is computed from `baseUrl` (never hardcoded). 4 tests (all legs fire; thrown save_post doesn't abort publish_post/audits; 500 audits still resolves; network error still resolves).

**Task 2 — Receiver route + pair-success wiring**
- `src/app/api/kotoiq/wp-event/route.ts` (new `POST`): read raw body once → `verifyWpEvent` (401 on bad auth) → event allowlist `save_post`/`publish_post` (422 on unknown, ASVS V5) → map `site_url` to a `koto_wp_sites` row and resolve `agency_id`/`client_id` **from the row, never from the body** (T-11-04 cross-agency isolation; 404 if site unknown) → soft-invoke the WS2 diff (guarded import) → 200. Errors in the diff are logged and swallowed so WP never retries.
- `src/app/api/wp/route.ts`: inside `shim_pair_new_site`, after the `if (!pairResult.ok)` guard and before the success response, a `void import('@/lib/kotoiq/orchestrateOnboarding').then(...).catch(...)` fires only when `client_id` is present, never awaited, with `baseUrl: new URL(req.url).origin`. One-line comment cites CONTEXT WS1 + RESEARCH A1.

## Verification

- `npx vitest run tests/kotoiq/orchestrateOnboarding.test.ts tests/kotoiq/wpEventAuth.test.ts` → **11 passed**.
- `npx tsc --noEmit` → clean for all touched files (`wp-event`, `orchestrateOnboarding`, `wpEventAuth`, `wp/route`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WS2 soft-dependency broke `tsc --noEmit`**
- **Found during:** Task 2 verification.
- **Issue:** The plan specified `await import('@/lib/kotoiq/baselineSnapshot').catch(()=>{})` so 11-01 lands before 11-02. But a static `@/...` specifier still triggers `TS2307: Cannot find module` at compile time even though `.catch()` handles it at runtime — and Task 2's `<done>` requires "tsc clean".
- **Fix:** Use a variable import specifier (`const spec = '@/lib/kotoiq/baselineSnapshot'; await import(spec).catch(...)`) in both `orchestrateOnboarding.ts` and the receiver route. TypeScript treats variable specifiers as runtime-only, the `.catch` guard is preserved, and the vitest `vi.mock` still intercepts by module path (tests stay green).
- **Files modified:** `src/lib/kotoiq/orchestrateOnboarding.ts`, `src/app/api/kotoiq/wp-event/route.ts`.
- **Commit:** `d17a82e6` (orchestrateOnboarding fix also in `4889a09c`'s successor edit; both folded into Task 2 commit).

## OPERATOR ACTION REQUIRED — New Env Var

**`KOTOIQ_WP_EVENT_SECRET`** must be added to Vercel (production + preview) before the inbound receiver will accept events.

- **What:** a high-entropy random string. Generate with `openssl rand -hex 32`.
- **Why:** the LOCKED shim emitter (v4.2.5) sends no auth of its own, so this secret is the bearer/capability token. The SAME value is embedded in the receiver URL that `orchestrateOnboarding` registers via `webhook.set` AND is the value `verifyWpEvent` compares against. They must match.
- **Until it is set:** the receiver fails closed (every event → 401 `server misconfigured`), and `orchestrateOnboarding` registers a tokenless receiver URL (so wiring is exercised but events are rejected). No silent open endpoint at any point.
- **Rotation:** changing the secret requires re-pairing (or otherwise re-running `webhookSet`) so the registered URL carries the new token.

All other env vars this plan relies on are already present in Vercel (per RESEARCH Environment Availability): `CRON_SECRET`, `KOTOIQ_SHIM_DASHBOARD_PRIVKEY`, `NEXT_PUBLIC_APP_URL`.

## Live State Note (non-git)

`save_post`/`publish_post` webhooks are registered on the WP site (stored in the `kotoiq_shim_webhooks` wp_option via the shim, not in git). They are (re)registered on every successful pair by `orchestrateOnboarding`. If a site is unpaired/re-paired, the dashboard re-registers automatically. The registered URL contains the capability token — rotating `KOTOIQ_WP_EVENT_SECRET` requires re-registration.

## Known Stubs

- **WS2 baseline legs are soft no-ops until Plan 11-02 ships `@/lib/kotoiq/baselineSnapshot`.** Both `orchestrateOnboarding` (baseline capture leg) and the receiver route (per-post diff leg) guard the import and no-op cleanly if the module is absent. This is intentional and documented in the plan (`<behavior>`: "import is allowed to be a stubbed/optional dep in this plan — guard with a dynamic import + try/catch so 11-01 lands before 11-02 without a hard failure"). Plan 11-02 wires the real engine; no change to 11-01 is needed when it lands (matching export names `captureBaseline` / `diffChangedPost`).

## For the Next Plan (11-02)

Export from `src/lib/kotoiq/baselineSnapshot.ts`:
- `captureBaseline({ agencyId, clientId, siteId, siteUrl })` — called by `orchestrateOnboarding` at pair time.
- `diffChangedPost({ agencyId, clientId, siteId, siteUrl, postId, event })` — called by the wp-event receiver per changed post.

Once those exist, the guarded imports pick them up automatically (no edit to 11-01 code).

## Commits

- `7768538b` — feat(11-01): verifyWpEvent authenticates inbound WP webhook POSTs (Task 0)
- `1e54bb41` — test(11-01): add failing test for orchestrateOnboarding chain (Task 1 RED)
- `4889a09c` — feat(11-01): implement orchestrateOnboarding fire-and-forget chain (Task 1 GREEN)
- `d17a82e6` — feat(11-01): wire pair-success trigger + inbound wp-event receiver (Task 2)

## Self-Check: PASSED

All 6 created/modified files present on disk; all 4 task commits present in git history; orchestration trigger confirmed wired in `src/app/api/wp/route.ts`. 11/11 tests green, tsc clean for touched files.
