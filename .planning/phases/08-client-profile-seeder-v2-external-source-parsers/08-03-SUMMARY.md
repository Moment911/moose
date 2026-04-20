---
phase: 08-client-profile-seeder-v2-external-source-parsers
plan: 03
subsystem: kotoiq
tags: [kotoiq, encryption, integrations, settings, oauth-storage, aes-gcm, phase-8]
status: complete
dependency_graph:
  requires:
    - plan-08-01 (kotoiqDb.agencyIntegrations helper + DIRECT_AGENCY_TABLES + SOURCE_CONFIG)
    - plan-08-01 (deferred: supabase/migrations/20260520_kotoiq_agency_integrations.sql push)
    - src/lib/apiAuth.ts verifySession (Phase 7 canonical auth)
    - src/app/api/kotoiq/profile/route.ts (Phase 7 14-action route pattern mirrored verbatim)
  provides:
    - "profileIntegrationsVault.ts — encryptSecret/decryptSecret/testConnection with agency-bound AAD"
    - "VaultError class — DECRYPT_AAD_MISMATCH / DECRYPT_AUTH_FAIL / DECRYPT_FORMAT"
    - "EncryptedPayload v1 shape ({v,alg,iv,tag,ct,aad_agency}) — stable contract for future v2 migration"
    - "/api/kotoiq/integrations POST dispatcher — 5 actions (list/save/test/delete/get)"
    - "Deferred-migration tolerance: 'relation does not exist' → 503 integrations_table_missing"
  affects:
    - plan-08-04 (form parsers consume decryptSecret to read Typeform/Jotform/Google Forms keys)
    - plan-08-05 (website crawl does NOT touch this — no agency integration needed)
    - plan-08-06 (GBP pullers consume decryptSecret + getByKind('gbp_agency_oauth'))
    - plan-08-08 (operator UI IngestPanel binds to 5-action dispatcher + agency-settings tab)
tech-stack:
  added:
    - "node:crypto AES-256-GCM with 96-bit IV + 128-bit auth tag (no new npm deps)"
  patterns:
    - "Envelope encryption with agency_id as AAD — cross-agency decrypt throws even with stolen ciphertext"
    - "Lazy KEK loading with __resetKek() test hook — env-swappable between test runs"
    - "VaultError with discriminated `code` — callers can distinguish tampering from policy mismatch"
    - "5-action dispatcher mirrors Phase 7 profile route verbatim (verifySession → ALLOWED_ACTIONS → action switch → cross-agency 404)"
    - "Deferred-migration tolerance via isTableMissingError helper + 503 sentinel"
    - "Plaintext travels only in JSON body (POST), never querystring; never logged"
key-files:
  created:
    - src/lib/kotoiq/profileIntegrationsVault.ts
    - src/app/api/kotoiq/integrations/route.ts
    - tests/kotoiq/phase8/profileIntegrationsVault.test.ts
    - tests/kotoiq/phase8/integrationsRoute.test.ts
  modified:
    - _knowledge/env-vars.md
decisions:
  - "AES-256-GCM chosen over Supabase Vault for v1 — no new service dependency; Supabase Vault path deferred (documented in EncryptedPayload v1 shape so v2 dispatch is trivial)"
  - "96-bit IV (GCM best-practice) + 128-bit auth tag; agency_id bound as AAD so DB-dump attacker still needs the right agency binding to decrypt"
  - "Lazy KEK load (not module-level init) so tests can swap KOTO_AGENCY_INTEGRATIONS_KEK per-run via vi.stubEnv without full module re-import"
  - "VaultError code is a string-literal union (not enum) — mirrors Phase 7 idiom of no extra runtime enums in the test surface"
  - "isTableMissingError regex matches 'koto_agency_integrations' + 'does not exist|not found|relation' — downgrades to 503 until deferred migration lands; matches Phase 7 kotoiq_pipeline_runs precedent per deferred-items.md"
  - "body.agency_id silently ignored per T-08-22 Phase 7 canonical pattern; route never touches caller-supplied agency_id"
  - "get_agency_integration returns only non-secret metadata; encrypted_payload never leaves the server via this endpoint (T-08-21)"
  - "save response helper (res.data shape) unwrapped defensively — kotoiqDb.ts helper returns plain supabase chain which can surface either array or single row depending on .single() usage; supports both"
  - "Ignored the PLAN.md pseudocode's `db.client.from('...')` retry pattern for helper errors — the try/catch around the whole switch + isTableMissingError sentinel covers it without duplicating code"
metrics:
  duration_minutes: 7
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
  tests_added: 18
  tests_total: 107
  completed: 2026-04-20T21:12:31Z
---

# Phase 8 Plan 3: profileIntegrationsVault + /api/kotoiq/integrations Summary

Shipped the encryption-at-rest helper and agency-settings Integrations API so agency
owners can save/test/delete Typeform, Jotform, Google Forms, and Places API
credentials (D-02, D-32). Plans 04 and 06 will import `decryptSecret` to read those
keys server-side; Plan 08 will wire the agency-settings Integrations tab UI against
the 5-action dispatcher.

## EncryptedPayload v1 shape (stable contract — keep this)

```ts
{
  v: 1,
  alg: 'aes-256-gcm',
  iv: <base64 12-byte IV>,
  tag: <base64 16-byte GCM auth tag>,
  ct: <base64 ciphertext>,
  aad_agency: <agency_id string bound as AAD>,
}
```

Stored verbatim in `koto_agency_integrations.encrypted_payload` jsonb. Future v2
rollout (e.g. Supabase Vault migration) bumps `v` to 2 and the decryptor
dispatches on `payload.v` — v=1 rows continue to decrypt via this code path.

## KOTO_AGENCY_INTEGRATIONS_KEK provisioning

**Operator action required before Plan 04 ingests external data:**

```bash
# Generate a 32-byte hex key (64 chars)
openssl rand -hex 32
# Set in Vercel Dashboard → Project → Settings → Environment Variables
#   Name: KOTO_AGENCY_INTEGRATIONS_KEK
#   Value: <output of openssl command>
#   Env: Production, Preview, Development
```

Added to `_knowledge/env-vars.md` under `## App` section.

Rotation plan: when the KEK must rotate, bump `payload_version` on every row
(schema column from Plan 01 migration), write a rewrap job that reads each row
with the old KEK, re-encrypts with the new KEK, updates the row in a
transaction. Not implemented in v1 — defer to first rotation event.

## Cross-agency decrypt refusal — verification strategy

Three defenses compose:

1. **Crypto layer** — `decryptSecret(payload, 'wrong-agency')` throws
   `VaultError` with `code=DECRYPT_AAD_MISMATCH` before even touching the KEK.
   Verified by test `decryptSecret throws DECRYPT_AAD_MISMATCH for wrong
   agency_id`.
2. **Auth-tag layer** — even if a row's `aad_agency` is forged on the way in,
   the GCM auth tag computed under the original agency's AAD will not verify
   under the forged AAD: `DECRYPT_AUTH_FAIL`. Verified by ciphertext-flip
   test.
3. **Helper layer** — `db.agencyIntegrations.get(id)` auto-scopes to the
   caller's agency (DIRECT_AGENCY_TABLES), so an attacker cannot even load the
   row to try to decrypt it. Verified by `delete_agency_integration returns
   404 for cross-agency id (not 403)` and `get_agency_integration cross-agency
   returns 404`.

Defense in depth: any single layer failing still leaves the other two
blocking the attack.

## Deviations from Plan

### Rule 2 — Auto-added critical functionality

**1. [Rule 2 - Defense-in-depth] `test_agency_integration` persists VaultError
   code into `markTested` reason**
- **Found during:** Task 2 implementation review
- **Issue:** PLAN.md pseudocode persisted `'decrypt_failed'` literal — losing
  the distinction between tampering (DECRYPT_AUTH_FAIL) and policy mismatch
  (DECRYPT_AAD_MISMATCH) in the audit trail. Forensics need to know which.
- **Fix:** When `decryptSecret` throws, extract `err.code` (if
  `err instanceof VaultError`) and pass it to `markTested(id, false, code)`.
  Fallback to `'decrypt_failed'` for unknown errors.
- **Files modified:** `src/app/api/kotoiq/integrations/route.ts`
- **Commit:** `07e9e9b`

**2. [Rule 2 - Defense-in-depth] Deferred-migration tolerance via
   `isTableMissingError` sentinel**
- **Found during:** Task 2 design (plan context flagged this)
- **Issue:** `.planning/phases/08-.../deferred-items.md` records that the
  `koto_agency_integrations` migration push is deferred — so `db.agencyIntegrations.*`
  calls will fail with a Postgrest "relation does not exist" error until the
  operator pushes. Without handling this, every UI call returns a generic
  500. Phase 7 `kotoiq_pipeline_runs` precedent mandates try/catch + silent
  continue.
- **Fix:** Added `isTableMissingError()` helper + `handleHelperError()`
  centralised catch block. Missing-table → 503 `integrations_table_missing`
  sentinel (so the UI can surface a "Migration pending" message). Any other
  error → 500 `internal_error`.
- **Files modified:** `src/app/api/kotoiq/integrations/route.ts`
- **Commit:** `07e9e9b`

**3. [Rule 2 - Security] Plaintext size cap + string type guard on
   `save_agency_integration`**
- **Found during:** Task 2 implementation
- **Issue:** Plan pseudocode accepted `String(body?.plaintext ?? '')` which
  would silently stringify non-string payloads (Buffer, Object, etc.). Also
  no size cap beyond the generic 10_000-char check the pseudocode hinted at.
- **Fix:** Explicit `typeof body?.plaintext === 'string'` check up-front;
  enforce 0 < len ≤ 10_000. Rejects with `400 bad_plaintext` otherwise.
- **Files modified:** `src/app/api/kotoiq/integrations/route.ts`
- **Commit:** `07e9e9b`

### Rule 1 — Auto-fixed bugs

None — plan implementation matched behavior spec 1:1 after Rule 2 additions.

### Deferred (out of scope for this plan)

**1. Plan 01 Supabase push still deferred** — documented in
`deferred-items.md`. This plan's `503 integrations_table_missing` sentinel
covers the window until the operator runs `supabase db push --linked` with
`SUPABASE_ACCESS_TOKEN`. No action in this plan — the deferral is Plan 01's
responsibility.

## Tests added (18 total)

- `tests/kotoiq/phase8/profileIntegrationsVault.test.ts` — **7 tests**:
  - encryptSecret payload shape (v=1, alg, base64 iv/tag/ct, aad_agency)
  - roundtrip decrypt returns original plaintext
  - cross-agency decrypt throws DECRYPT_AAD_MISMATCH
  - tampered ciphertext throws DECRYPT_AUTH_FAIL (GCM auth tag)
  - missing KEK env throws at call time (fail-closed via lazy load)
  - typeform 401 → ok=false with rejected-key error
  - typeform 200 → ok=true

- `tests/kotoiq/phase8/integrationsRoute.test.ts` — **11 tests**:
  - 401 when session not verified
  - 401 when verified but agencyId missing
  - 400 on unknown action (with `error: 'unknown_action'`)
  - list strips encrypted_payload from response + no ciphertext leak
  - save encrypts plaintext, upserts, ignores body.agency_id (T-08-22 assert);
    plaintext never in console.log OR console.error; upsert row's
    aad_agency matches SESSION agency, not body.agency_id
  - save rejects unsupported kind with 400
  - test decrypts + probes (real vault; mocked fetch) + persists ok=true
  - delete cross-agency returns 404 (NOT 403) per link-enumeration mitigation
  - delete happy path returns ok:true + calls delete(id)
  - get strips encrypted_payload from response + no ciphertext leak
  - get cross-agency returns 404

Phase 7 regression test count: **zero**. Suite growth: 89 → 107 (+18; plan
asked for ~15, landed 18 due to extra defense tests called out above).

## Verification signals

- `npx vitest run tests/kotoiq/phase8/profileIntegrationsVault.test.ts` — **7/7**
- `npx vitest run tests/kotoiq/phase8/integrationsRoute.test.ts` — **11/11**
- `npx vitest run tests/kotoiq/phase8/` — **33/33**
- `npx vitest run tests/` — **107/107** (16 files; zero regressions vs Plan 01's 89)
- `npx tsc --noEmit` — **clean** (no new type errors)
- `grep -c "export function encryptSecret" src/lib/kotoiq/profileIntegrationsVault.ts` → **1**
- `grep -c "export function decryptSecret" src/lib/kotoiq/profileIntegrationsVault.ts` → **1**
- `grep -c "export async function testConnection" src/lib/kotoiq/profileIntegrationsVault.ts` → **1**
- `grep -c "setAAD" src/lib/kotoiq/profileIntegrationsVault.ts` → **2** (encrypt + decrypt)
- `grep -c "DECRYPT_AAD_MISMATCH" src/lib/kotoiq/profileIntegrationsVault.ts` → **4** (union, error class, throw site, docstring)
- `grep -c "KOTO_AGENCY_INTEGRATIONS_KEK" _knowledge/env-vars.md` → **1**
- `grep -c "export async function POST" src/app/api/kotoiq/integrations/route.ts` → **1**
- `grep -c "runtime = 'nodejs'" src/app/api/kotoiq/integrations/route.ts` → **1**
- `grep -c "ALLOWED_ACTIONS" src/app/api/kotoiq/integrations/route.ts` → **4**
- `grep -c "verifySession" src/app/api/kotoiq/integrations/route.ts` → **4**
- **No `encrypted_payload` in any `json(...)` / `NextResponse.json(...)` response body** — grep confirms it appears ONLY at the sealing/upsert call site, the decrypt read site, and a comment.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| Task 1 (RED) | `ea90fd6` | test(08-03): add failing tests for profileIntegrationsVault (RED) |
| Task 1 (GREEN) | `ace6918` | feat(08-03): AES-256-GCM envelope encryption with agency-bound AAD |
| Task 2 (RED) | `bf4da82` | test(08-03): add failing tests for /api/kotoiq/integrations route (RED) |
| Task 2 (GREEN) | `07e9e9b` | feat(08-03): /api/kotoiq/integrations — 5-action agency-settings JSON dispatcher |

## Threat Flags

None. Threat surface is exactly what the plan's `<threat_model>` anticipated —
T-08-20..T-08-26 all mitigated by construction. No new network endpoints
introduced beyond the plan's `/api/kotoiq/integrations` POST. No schema
changes at trust boundaries (schema shipped in Plan 01 migration).

## Known Stubs

None. Every code path ships with working behavior:
- Encryption is real AES-256-GCM, not a placeholder.
- `testConnection` is real HTTP probes for typeform / jotform / places-api;
  `google_forms` does structural JSON validation (Plan 06 owns the OAuth
  probe — documented in the switch case comment); OAuth kinds return ok=true
  as documented (Plan 06 validates via refresh flow).
- Deferred-migration 503 sentinel is the intended behavior per deferred-items.md,
  not a placeholder.

## Downstream handoff

- **Plan 04 (form parsers):** Import `decryptSecret` + `db.agencyIntegrations.getByKind('typeform'|'jotform'|'google_forms')`. Until the Plan 01 migration push lands, every call will 404/503 — wrap in try/catch and fall back to Playwright scrape path (D-01 hybrid strategy).
- **Plan 06 (GBP pullers):** Same pattern with `'gbp_agency_oauth'`, `'gbp_client_oauth'`, `'gbp_places_api'`. Plan 06 owns the OAuth probe flow (Google Forms service-account too).
- **Plan 08 (operator UI):** Wire the agency-settings Integrations tab against these 5 actions: `list_agency_integrations` populates the table; `save_agency_integration` handles the "Add key" modal; `test_agency_integration` is the "Test connection" button; `delete_agency_integration` is the row-delete affordance; `get_agency_integration` is the row-detail drawer.

## Self-Check: PASSED

- All 5 created/modified files present on disk (4 created + 1 modified).
- All 4 task commits present in git log (`ea90fd6`, `ace6918`, `bf4da82`, `07e9e9b`).
- Full vitest run green: 107/107 across 16 files.
- tsc --noEmit clean.
- All 8 acceptance grep assertions pass (Task 1) + 5 (Task 2).
