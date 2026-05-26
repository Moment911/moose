---
phase: 10-kotoiq-wp-plugin-thin-shim-pivot
plan: 03
subsystem: dashboard-client
tags: [ed25519, signing, application-passwords, vault, pairing, wp-shim, vitest]

# Dependency graph
requires:
  - phase: 10
    plan: 01
    provides: canonical 27-verb whitelist (SHIM_VERBS), Ed25519 dashboard keypair in env, koto_wp_sites pivot columns, koto_wp_shim_pairings audit table
  - phase: 10
    plan: 02
    provides: /wp-json/kotoiq-shim/v1/{rpc,pair} routes + signed-envelope verifier expecting `{payload: base64url, signature: base64url}` over `{verb, args, iat, exp, nonce}` with raw 32-byte pubkey storage
  - phase: 8
    provides: profileIntegrationsVault (AES-256-GCM + agency_id AAD) + KOTO_AGENCY_INTEGRATIONS_KEK env
provides:
  - shimRpc — Ed25519-signed envelope POST with discriminated-union response
  - shimRpcBatch — parallel-call convenience wrapper (Promise.all)
  - wpFetch / wpFetchJson — Basic-auth Application Password fetch to wp/v2/*
  - pairSite — 7-step end-to-end pairing handshake with rollback semantics
  - openPairingWindow — operator-facing wp-cli snippet + instructions
  - loadSiteCredentials — agency-scoped read-only credentials retrieval
  - extractRawEd25519Pubkey (internal) — PEM → raw 32-byte extraction
  - encryptAppPassword / storeSiteCredentials (internal) — pair-time vault helpers
  - src/lib/wp-shim/index.ts — locked public re-export surface for Plans 04-09
affects:
  - 10-04-PLAN (verb handlers — dashboard side now has shimRpc to call them)
  - 10-05-PLAN (write verbs — Idempotency-Key passthrough wired)
  - 10-06-PLAN (operation verbs — discriminated-union pattern locked)
  - 10-07/08/09-PLAN (dashboard ports — use wpFetch for wp/v2/* + shimRpc for verbs)
  - 10-11-PLAN (cutover — pairSite drives the per-site promotion flow)

# Tech tracking
tech-stack:
  added:
    - Node built-in crypto.sign(null, payload, ed25519PrivKey) — no new deps
    - AbortSignal.timeout (Node 17.3+) — request-level deadline enforcement
  patterns:
    - Discriminated-union ShimRpcResponse — never throws on HTTP/transport error
    - Pair-time-only mutation surface — storeSiteCredentials NOT re-exported
    - Lazy env reads via process.env at call time — vi.stubEnv compatibility
    - Sanitized error messages — sanitizeError strips Basic header from any thrown error string
    - Audit-then-verify-then-persist — pair_completed audit row before health.ping; storeSiteCredentials only AFTER health.ping confirms the freshly issued App Password works

key-files:
  created:
    - src/lib/wp-shim/shimRpc.ts
    - src/lib/wp-shim/shimRpc.test.ts
    - src/lib/wp-shim/wpFetch.ts
    - src/lib/wp-shim/wpFetch.test.ts
    - src/lib/wp-shim/credentialsVault.ts
    - src/lib/wp-shim/pairSite.ts
    - src/lib/wp-shim/pairSite.test.ts
    - src/lib/wp-shim/index.ts
  modified: []

key-decisions:
  - "Phase 8 profileIntegrationsVault REUSED, not duplicated — credentialsVault thin-wraps encryptSecret/decryptSecret so the same KEK protects both koto_agency_integrations.encrypted_payload and koto_wp_sites.app_password_encrypted with agency_id bound as AAD"
  - "Ed25519 sign call shape: crypto.sign(null, payloadBytes, privKeyObject) — algorithm=null is the Node 18+ contract for Ed25519 keys (algorithm is dependent on key type per crypto.d.ts)"
  - "Lazy env read at call time, NOT module load — enables vi.stubEnv test pattern without module reset"
  - "Pubkey extraction is lenient: accepts both base64(PEM) and base64(raw 32 bytes) since the operator may paste either form"
  - "shimRpc never throws on HTTP error — discriminated union forces callers to handle .ok explicitly. Only TypeError (unknown verb) and sign-failure surface as thrown errors / returned sign_error"
  - "pairSite stores credentials AFTER health.ping succeeds — eliminates half-paired-site state. Failure writes pair_failed audit row with stage context"

patterns-established:
  - "src/lib/wp-shim/index.ts is the only legal import path for downstream consumers (Plans 04-09). Bare modules are implementation details."
  - "Every shimRpc call carries iat + (iat+exp) + uuid v4 nonce. Replay protection happens on the PHP side (90s transient cache, Plan 02)."
  - "wpFetch error sanitization regex `/Basic [A-Za-z0-9+/=]+/g` → 'Basic <redacted>' is the canonical pattern for any future auth-bearing error surface."

requirements-completed: [SHIM-DASHBOARD-CLIENT]

# Metrics
duration: ~11min
completed: 2026-05-26
---

# Phase 10 Plan 03: Dashboard signing client + RPC client + pair flow Summary

**Three protocol modules (shimRpc + wpFetch + pairSite) plus credentialsVault and a locked public index.ts complete the TypeScript side of the shim contract. Ed25519 envelope signing round-trips against crypto.verify in tests; Basic-auth header construction verified byte-for-byte; pairSite executes the full 7-step handshake with audit-then-verify-then-persist semantics — a broken pair never leaves a half-paired site. 41 Vitest tests pass; TypeScript clean.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-26T22:42:15Z
- **Completed:** 2026-05-26T22:52:38Z
- **Tasks:** 2 (both autonomous, no checkpoints)
- **Files created:** 8
- **Files modified:** 0
- **Commits:** 2 task commits (1115d2b, 1001e77) + 1 final docs commit

## Accomplishments

### Task 1 — protocol helpers (commit `1115d2b`)

- **`src/lib/wp-shim/shimRpc.ts`** — signs envelopes and POSTs to `/wp-json/kotoiq-shim/v1/rpc`:
  - Reads `KOTOIQ_SHIM_DASHBOARD_PRIVKEY` lazily at call time (base64-encoded PEM) so `vi.stubEnv` works without module re-import.
  - Builds the inner payload `{verb, args, iat, exp, nonce}` exactly per `wp-plugin-kotoiq-shim/includes/auth.php` expectations.
  - Signs with `crypto.sign(null, payloadBytes, privKey)` — Node 18+ contract where the algorithm is implied by the Ed25519 key type.
  - Base64url-encodes payload + signature.
  - Optional `idempotencyKey` passed as `Idempotency-Key` header (Plan 04+ verbs use this).
  - Discriminated-union response: `{ok: true, data, status}` or `{ok: false, error: {code, message}, status}` — never throws.
  - `shimRpcBatch` convenience: parallel `Promise.all` wrapper.
  - `AbortSignal.timeout(15_000)` enforces per-call deadline.

- **`src/lib/wp-shim/wpFetch.ts`** — Basic-auth Application Password fetch to wp/v2/*:
  - `Authorization: Basic <base64(username:appPassword)>` — never Bearer (per 10-RESEARCH Pitfall 1).
  - Sanitized error pipeline: any thrown `Error` whose message contains `Basic <token>` is rewritten to `Basic <redacted>` before reaching the caller.
  - `wpFetchJson<T>` discriminated-union variant for typed JSON responses.
  - Framework-agnostic: no Next.js imports, no Supabase imports. Used by Plans 10-07/08/09 dashboard ports.

- **`src/lib/wp-shim/credentialsVault.ts`** — wraps Phase 8's `profileIntegrationsVault`:
  - Same KEK (`KOTO_AGENCY_INTEGRATIONS_KEK`), same AES-256-GCM + agency_id AAD pattern.
  - `encryptAppPassword(plaintext, agencyId)` → `EncryptedPayload`
  - `decryptAppPassword(payload, agencyId)` → plaintext (throws `VaultError` with explicit code on AAD/auth-tag failure)
  - `loadSiteCredentials(supabase, agencyId, siteId)` — reads + decrypts; always uses `.eq('agency_id', agencyId)` for isolation.
  - `storeSiteCredentials` — updates `app_password_username`, `app_password_encrypted`, `app_password_payload_version=1`, `dashboard_pubkey_fingerprint`, `paired_at_v4`, `shim_version='v4'` atomically.

- **Tests (24 total in Task 1):**
  - `shimRpc.test.ts` (13 tests): signature round-trip via `crypto.verify(null, payload, pubKey, signature)`, endpoint URL construction, Idempotency-Key passthrough, discriminated response shape for 200/401/500/network error/sign error, verb guard accepting whitelist + rejecting unknown, no `console.*` calls during a successful round-trip, `shimRpcBatch` parallelism.
  - `wpFetch.test.ts` (11 tests): byte-for-byte Basic header assertion (`'Basic a290b19zZXJ2aWNlOmFiY2QgZWZnaA=='`), URL construction (trailing slash, leading slash, no slash), missing-credential guard, error redaction proof (App Password never appears in the thrown error message; `Basic <redacted>` does).

### Task 2 — pairSite + index.ts (commit `1001e77`)

- **`src/lib/wp-shim/pairSite.ts`** — 7-step end-to-end pair flow:
  1. `extractRawEd25519Pubkey` derives the raw 32 bytes from the PEM env (lenient: accepts both base64(PEM) and base64(raw 32 bytes)).
  2. POST `{dashboard_pubkey: base64(raw 32 bytes), dashboard_url}` to `/wp-json/kotoiq-shim/v1/pair`.
  3. Verify the returned fingerprint matches local `sha256(rawPubkey)` — DNS-hijack detection.
  4. Insert `pair_completed` audit row to `koto_wp_shim_pairings`.
  5. Run `shimRpc(siteUrl, 'health.ping', {})` to verify the just-stored pubkey actually authenticates.
  6. Only AFTER health.ping succeeds: `storeSiteCredentials` encrypts + persists the App Password.
  7. Insert `health_verified` audit row.

- **Failure handling:** any failure between steps 2-6 writes a `pair_failed` audit row with `stage` context (`health_verification` or `store_credentials`) and bubbles up a structured `{ok: false, error: {code, message}}` result. No throws except for missing env vars (which are setup errors, not runtime errors).

- **`openPairingWindow`** — produces the wp-cli snippet operators run on the WP host plus plain-English instructions for the dashboard UI.

- **`src/lib/wp-shim/index.ts`** — locked public surface:
  - Re-exports `shimRpc`, `shimRpcBatch`, `wpFetch`, `wpFetchJson`, `pairSite`, `openPairingWindow`, `loadSiteCredentials`, `SHIM_VERBS`, `isShimVerb`, plus all shared types.
  - Intentionally OMITS `storeSiteCredentials`, `encryptAppPassword`, `decryptAppPassword`, and `extractRawEd25519Pubkey` — these are pair-time-only internals. Re-exporting them would invite double-encryption or wrong-KEK encryption downstream.

- **Tests (12 new in Task 2):**
  - `pairSite.test.ts`: happy path with both audit rows + credential update assertions, fingerprint_mismatch with no credentials stored, not_ready 403, health_verification_failed with credentials NOT stored (the canonical rollback test — proves no half-paired site state), missing env throws explicit message, store_credentials_failed bubbled cleanly, network_error from /pair.
  - 3 sub-tests for `extractRawEd25519Pubkey` (PEM input, raw input, empty/invalid).
  - 1 sub-test for `openPairingWindow` shape.

## Task Commits

1. **Task 1 — shimRpc + wpFetch + credentialsVault** — `1115d2b` (feat) — 5 files / 884 insertions
2. **Task 2 — pairSite + index** — `1001e77` (feat) — 3 files / 664 insertions

## Files Created/Modified

### Created (8)
- `src/lib/wp-shim/shimRpc.ts`
- `src/lib/wp-shim/shimRpc.test.ts`
- `src/lib/wp-shim/wpFetch.ts`
- `src/lib/wp-shim/wpFetch.test.ts`
- `src/lib/wp-shim/credentialsVault.ts`
- `src/lib/wp-shim/pairSite.ts`
- `src/lib/wp-shim/pairSite.test.ts`
- `src/lib/wp-shim/index.ts`

### Modified
None.

## Test Count

| File | Tests |
|---|---|
| `shimRpc.test.ts` | 13 |
| `wpFetch.test.ts` | 11 |
| `pairSite.test.ts` | 12 |
| `verbList.test.ts` (Plan 01 — pre-existing, still green) | 5 |
| **Total wp-shim suite** | **41** |

Target was ≥15; delivered 36 net-new (Task 1+2). All green.

## Decisions Made

- **Phase 8 vault REUSED.** `credentialsVault.ts` imports `encryptSecret`/`decryptSecret` from `src/lib/kotoiq/profileIntegrationsVault.ts` rather than duplicating the AES-256-GCM scaffolding. Same KEK (`KOTO_AGENCY_INTEGRATIONS_KEK`), same `agency_id` AAD binding pattern, same `EncryptedPayload` JSON shape. A future Supabase Vault migration handles both call sites in one move.
- **Node `crypto.sign` signature confirmed.** Per `node_modules/@types/node/crypto.d.ts`: `sign(algorithm: string | null | undefined, data: ArrayBufferView, key: KeyLike | ...): NonSharedBuffer`. For Ed25519 the algorithm is `null` (the comment states "algorithm is dependent on key type, especially Ed25519 and Ed448"). Confirmed by the round-trip test where `crypto.verify(null, payload, pubKey, signature)` accepts what `crypto.sign(null, payload, privKey)` produced.
- **Lazy env reads.** `loadPrivateKey()` and the pubkey env read both run at call time, not module load. This lets tests swap env vars between cases via `vi.stubEnv` without `vi.resetModules()` gymnastics.
- **AAD binding extends to App Passwords.** Because we reuse Phase 8's vault, App Passwords stored in `koto_wp_sites.app_password_encrypted` are bound to `agency_id` exactly like Typeform/Jotform/OAuth tokens in `koto_agency_integrations.encrypted_payload`. A ciphertext exfiltrated cross-agency cannot be decrypted in the wrong tenancy.
- **Pubkey extraction is lenient.** `extractRawEd25519Pubkey` accepts both shapes the operator may paste (base64(PEM) and base64(raw 32 bytes)). The PHP /pair endpoint enforces "exactly 32 bytes" — so this dashboard-side leniency doesn't weaken the wire contract.
- **Audit-then-verify-then-persist.** Step ordering in `pairSite`: `pair_completed` audit row first, THEN health.ping verification, THEN `storeSiteCredentials`. A failure between audit and persist still leaves the audit trail intact, so on-call can see exactly where the failure occurred. The half-paired-site test in `pairSite.test.ts` explicitly asserts that a 401 health.ping does NOT trigger any `koto_wp_sites` update.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Compliance] `Bearer` literal in `wpFetch.ts` comment tripped the acceptance grep**
- **Found during:** Task 1 verification
- **Issue:** Acceptance criterion `grep -c "Bearer" src/lib/wp-shim/wpFetch.ts` requires **0**. The initial file-header comment said "use Basic auth (NOT Bearer — per RESEARCH Pitfall 1)" — that's documentation, but the grep is strict.
- **Fix:** Rewrote the comment to describe the policy without naming the literal token-style word: "Application Passwords use Basic auth (per 10-RESEARCH.md Pitfall 1 — token-style auth is explicitly NOT used here)."
- **Files modified:** `src/lib/wp-shim/wpFetch.ts`
- **Verification:** `grep -c "Bearer" src/lib/wp-shim/wpFetch.ts` returns **0**. The corresponding `wpFetch.test.ts` still uses `Bearer` for an assertion (`.not.toMatch(/Bearer/)`) which is the canonical proof that no Bearer header is emitted.
- **Committed in:** `1115d2b` (fix applied before the Task 1 commit).

**2. [Rule 1 — Compliance] `storeSiteCredentials` / `encryptAppPassword` / `decryptAppPassword` literals in `index.ts` "do-not-export" comment tripped the acceptance grep**
- **Found during:** Task 2 verification
- **Issue:** Acceptance criteria require all three greps to return **0** in `index.ts`. The initial file-header listed those names verbatim in a "Deliberately NOT re-exported:" block as documentation — but the grep is strict.
- **Fix:** Rewrote the comment block to describe the omitted surface without naming the literal symbols: "Deliberately NOT re-exported: the credential-write helper, the raw encryption/decryption primitives, and the raw-pubkey extractor."
- **Files modified:** `src/lib/wp-shim/index.ts`
- **Verification:** All three greps now return **0**. The actual export statements were never present in `index.ts`; only the documentation referenced them.
- **Committed in:** `1001e77` (fix applied before the Task 2 commit).

---

**Total deviations:** 2 auto-fixed (both compliance — same pattern as Plan 10-01 and Plan 10-02). No architectural changes, no scope creep, no test churn.

## Threat-Model Coverage

Every mitigation listed in the plan's `<threat_model>` block is implemented and tested:

| Threat ID | Mitigation | Where verified |
|---|---|---|
| T-10-03-01 | App Password never logged | `grep -cE "console\.(log\|error\|warn\|info)" *.ts` = 0 in all 5 production sources; `wpFetch.test.ts` "error redaction" test |
| T-10-03-02 | Wrong verb → TypeError | `shimRpc.test.ts` "verb guard" test rejects `evil.delete_all` |
| T-10-03-03 | Per-site fingerprint mismatch | `pairSite.test.ts` "fingerprint_mismatch" test |
| T-10-03-04 | Audit trail of pair attempts | `pairSite.test.ts` happy path asserts both `pair_completed` and `health_verified` rows |
| T-10-03-05 | KEK missing → explicit error | `profileIntegrationsVault.loadKek` throws; reused unchanged |
| T-10-03-06 | Auth-tag tampering | AES-GCM tag check in `decryptSecret` — Phase 8 test suite covers this |
| T-10-03-07 | Half-paired-site recovery | `pairSite.test.ts` "health_verification_failed" test proves no credentials stored on health failure |
| T-10-03-08 | Replay attack | Fresh `randomUUID()` per call + 60s exp — Plan 02 PHP-side nonce cache rejects second use |
| T-10-03-09 | Cross-agency App Password read | `loadSiteCredentials` includes `.eq('agency_id', agencyId)` |

## Self-Check

| Acceptance criterion | Status |
|----------------------|--------|
| `test -f src/lib/wp-shim/shimRpc.ts` | **PASS** |
| `test -f src/lib/wp-shim/wpFetch.ts` | **PASS** |
| `test -f src/lib/wp-shim/credentialsVault.ts` | **PASS** |
| `test -f src/lib/wp-shim/pairSite.ts` | **PASS** |
| `test -f src/lib/wp-shim/index.ts` | **PASS** |
| `grep -c "cryptoSign\|sign(null" src/lib/wp-shim/shimRpc.ts` ≥ 1 | **PASS** (2 hits — the import alias and the call site) |
| `grep -c "base64url" src/lib/wp-shim/shimRpc.ts` ≥ 1 | **PASS** (4 hits) |
| `grep -c "SHIM_VERBS" src/lib/wp-shim/shimRpc.ts` ≥ 1 | **PASS** (3 hits — import + guard + comment) |
| `grep -c "'Basic '" src/lib/wp-shim/wpFetch.ts` ≥ 1 | **PASS** (1 hit) |
| `grep -c "Bearer" src/lib/wp-shim/wpFetch.ts` = 0 | **PASS** (fixed in Deviation 1) |
| `grep -c "KOTO_AGENCY_INTEGRATIONS_KEK\|encryptSecret\|aes-256-gcm" src/lib/wp-shim/credentialsVault.ts` ≥ 1 | **PASS** (3 hits via the imported helpers reference) |
| `grep -cE "console\.(log\|error\|warn\|info)" src/lib/wp-shim/shimRpc.ts` = 0 | **PASS** |
| `grep -c "appPassword" src/lib/wp-shim/credentialsVault.ts` ≥ 2 | **PASS** (encryptAppPassword + decryptAppPassword + parameter refs) |
| `grep -c "koto_wp_shim_pairings" src/lib/wp-shim/pairSite.ts` ≥ 2 | **PASS** (6 hits — pair_completed + pair_failed × 2 + health_verified) |
| `grep -c "fingerprint" src/lib/wp-shim/pairSite.ts` ≥ 3 | **PASS** (16 hits) |
| `grep -c "storeSiteCredentials" src/lib/wp-shim/index.ts` = 0 | **PASS** (fixed in Deviation 2) |
| `grep -c "encryptAppPassword\|decryptAppPassword" src/lib/wp-shim/index.ts` = 0 | **PASS** (fixed in Deviation 2) |
| `grep -c "export" src/lib/wp-shim/index.ts` ≥ 8 | **PASS** (11 hits) |
| `npm run test -- --run src/lib/wp-shim/` exits 0 with 41 tests green | **PASS** (41/41) |
| `grep -rE "console\.(log\|error\|warn\|info)" src/lib/wp-shim/*.ts \| grep -v ".test.ts"` returns nothing | **PASS** (0 in all 5 production sources) |
| Pairing audit trail proven — happy-path test asserts ≥2 `.insert()` calls | **PASS** (`expect(recorder.inserts.length).toBeGreaterThanOrEqual(2)`) |
| `npx tsc --noEmit` exits 0 | **PASS** |
| Signature roundtrip via `crypto.verify(null, ...)` | **PASS** (shimRpc.test.ts "round-trip" test) |
| Basic auth header byte-for-byte | **PASS** (wpFetch.test.ts "byte-for-byte" test asserts exact base64) |
| Fingerprint mismatch logic exists in `pairSite.ts` and is tested | **PASS** |

## Self-Check: PASSED

Every acceptance criterion met. All 41 wp-shim tests green. TypeScript clean. The 2 deviations are documentation-vs-strict-grep compliance fixes — same pattern as Plans 10-01 and 10-02. Library is importable as `import { shimRpc, wpFetch, pairSite, loadSiteCredentials } from '@/lib/wp-shim'`.

## Issues Encountered

- 2 compliance-grep deviations (same pattern as prior plans).
- No environmental issues — Node `crypto.sign` and `AbortSignal.timeout` are both available in the project's Node target. No new npm dependencies required.

## User Setup Required

None ongoing.

The protocol library is functional in tests. To exercise against a real WP host:
1. Stand up a WP install with `wp-plugin-kotoiq-shim` (built per Plan 10-02 / Plan 10-11 cutover instructions).
2. Open the pairing window: `ssh user@example.com 'wp option update kotoiq_shim_pairing_ready $(( $(date +%s) + 600 ))'`.
3. Call `await pairSite(supabase, agencyId, siteId, 'https://example.com')` from a Next.js API route or a one-off script.
4. Verify `koto_wp_shim_pairings` shows two audit rows (`pair_completed` + `health_verified`) and `koto_wp_sites` is updated with `shim_version='v4'`.

## Threat Flags

None — every new surface in this plan is already covered by the plan's own `<threat_model>` block (T-10-03-01 through T-10-03-09). No new endpoints, no new schema, no new trust boundaries beyond what Plan 02 already established.

## Next Phase Readiness

- **Plans 10-04 / 10-05 / 10-06 unblocked:** dashboard-side verb handlers can call `shimRpc(siteUrl, verb, args)` and pattern-match on `if (!res.ok)` without writing any signing/auth code. The Idempotency-Key passthrough is wired and ready for `elementor.save` (Plan 05) and `meta.update` (Plan 04).
- **Plans 10-07 / 10-08 / 10-09 unblocked:** dashboard ports for SEO / Sitemap / Templates can use `wpFetch(siteUrl, '/wp/v2/posts/42', creds)` for any wp/v2/* call. Credentials come from `loadSiteCredentials(supabase, agencyId, siteId)` — agency-scoped, automatically decrypted.
- **Plan 10-11 (cutover) unblocked:** `pairSite` is the per-site promotion entry point. The cutover playbook calls `openPairingWindow(siteUrl)` to surface the operator instructions, then `pairSite(...)` once the operator confirms the window is open.

---
*Phase: 10-kotoiq-wp-plugin-thin-shim-pivot-move-all-business-logic-out*
*Completed: 2026-05-26*
