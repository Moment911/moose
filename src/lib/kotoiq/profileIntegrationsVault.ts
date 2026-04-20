import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 3 — envelope-encryption helper for `koto_agency_integrations`
// (D-02, D-32).
//
// AES-256-GCM with `agency_id` bound as Additional Authenticated Data (AAD) —
// even if ciphertext is exfiltrated, decrypt requires the matching agency
// binding. Compatible with Supabase Vault migration later: a future reader
// can dispatch on `payload.v` (bump to v=2) and fall back to this code for
// v=1 rows.
//
// Threats mitigated (see 08-03-PLAN.md <threat_model>):
//   T-08-20  OAuth / API key exfiltration  — KEK + AAD binding required
//   T-08-23  Altered ciphertext             — GCM auth tag detects tampering
//   T-08-25  Cross-agency decrypt attempt   — DECRYPT_AAD_MISMATCH refuses
// ─────────────────────────────────────────────────────────────────────────────

const KEK_ENV = 'KOTO_AGENCY_INTEGRATIONS_KEK'

function loadKek(): Buffer {
  const hex = process.env[KEK_ENV]
  if (!hex) {
    throw new Error(
      `[profileIntegrationsVault] Missing env ${KEK_ENV} — set a 32-byte hex key in Vercel Dashboard (64 hex chars)`,
    )
  }
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) {
    throw new Error(
      `[profileIntegrationsVault] ${KEK_ENV} must decode to 32 bytes (got ${buf.length})`,
    )
  }
  return buf
}

// Lazy-load so tests (and deferred-migration scenarios) can swap the env var
// between runs without a full module re-import.
let _kek: Buffer | null = null
function kek(): Buffer {
  return _kek ?? (_kek = loadKek())
}

/** v1 envelope payload persisted into `koto_agency_integrations.encrypted_payload`. */
export type EncryptedPayload = {
  v: 1
  alg: 'aes-256-gcm'
  iv: string // base64 — 96-bit per GCM best practice
  tag: string // base64 — 128-bit GCM auth tag
  ct: string // base64 — ciphertext
  aad_agency: string // agency_id bound as AAD; stored redundantly so readers can
  // self-describe without needing a separate column
}

export function encryptSecret(plaintext: string, agencyId: string): EncryptedPayload {
  if (typeof plaintext !== 'string') {
    throw new Error('[profileIntegrationsVault] plaintext must be a string')
  }
  if (!agencyId || typeof agencyId !== 'string') {
    throw new Error('[profileIntegrationsVault] agencyId must be a non-empty string')
  }
  const iv = randomBytes(12) // 96-bit IV per GCM best-practice
  const cipher = createCipheriv('aes-256-gcm', kek(), iv)
  cipher.setAAD(Buffer.from(agencyId, 'utf8'))
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
    aad_agency: agencyId,
  }
}

export class VaultError extends Error {
  public code: 'DECRYPT_AAD_MISMATCH' | 'DECRYPT_AUTH_FAIL' | 'DECRYPT_FORMAT'
  constructor(
    code: 'DECRYPT_AAD_MISMATCH' | 'DECRYPT_AUTH_FAIL' | 'DECRYPT_FORMAT',
    msg: string,
  ) {
    super(msg)
    this.name = 'VaultError'
    this.code = code
  }
}

export function decryptSecret(payload: EncryptedPayload, agencyId: string): string {
  if (!payload || payload.v !== 1 || payload.alg !== 'aes-256-gcm') {
    throw new VaultError('DECRYPT_FORMAT', 'Unsupported payload format')
  }
  if (payload.aad_agency !== agencyId) {
    throw new VaultError('DECRYPT_AAD_MISMATCH', 'agency binding does not match')
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      kek(),
      Buffer.from(payload.iv, 'base64'),
    )
    decipher.setAAD(Buffer.from(agencyId, 'utf8'))
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
    const pt = Buffer.concat([
      decipher.update(Buffer.from(payload.ct, 'base64')),
      decipher.final(),
    ])
    return pt.toString('utf8')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    throw new VaultError('DECRYPT_AUTH_FAIL', `Authenticated decryption failed: ${msg}`)
  }
}

// ── Integration kinds + live-probe test (D-32 "Test connection" button) ────

export type IntegrationKind =
  | 'typeform'
  | 'jotform'
  | 'google_forms'
  | 'gbp_agency_oauth'
  | 'gbp_client_oauth'
  | 'gbp_places_api'

export type TestResult = { ok: boolean; error?: string }

/**
 * Fire a live probe to the vendor API to verify the key works. Writes nothing
 * — caller persists the result via `db.agencyIntegrations.markTested`.
 *
 * Never logs `plaintext`. All API keys travel in request headers, never in
 * query strings (T-08-26 — Vercel Functions log query strings unredacted).
 */
export async function testConnection(
  kind: IntegrationKind,
  plaintext: string,
): Promise<TestResult> {
  try {
    switch (kind) {
      case 'typeform': {
        // GET /me — cheap whoami endpoint; 200 = valid token.
        const r = await fetch('https://api.typeform.com/me', {
          headers: { Authorization: `Bearer ${plaintext}` },
        })
        if (r.status === 200) return { ok: true }
        if (r.status === 401 || r.status === 403) {
          return { ok: false, error: 'Typeform rejected the API key' }
        }
        return { ok: false, error: `Typeform returned ${r.status}` }
      }
      case 'jotform': {
        // APIKEY in header per RESEARCH §Security — query-string API keys leak
        // into Vercel Function logs.
        const r = await fetch('https://api.jotform.com/user', {
          headers: { APIKEY: plaintext },
        })
        if (r.status === 200) {
          const j = (await r.json().catch(() => null)) as { responseCode?: number } | null
          if (j?.responseCode === 200) return { ok: true }
        }
        return { ok: false, error: 'Jotform rejected the API key' }
      }
      case 'gbp_places_api': {
        // Places API (New) — cheap text-search probe with field mask to
        // minimise billing.
        const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'X-Goog-Api-Key': plaintext,
            'X-Goog-FieldMask': 'places.displayName',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ textQuery: 'coffee', maxResultCount: 1 }),
        })
        if (r.status === 200) return { ok: true }
        if (r.status === 400 || r.status === 403) {
          return { ok: false, error: 'Places API key rejected or API not enabled' }
        }
        return { ok: false, error: `Places API returned ${r.status}` }
      }
      case 'google_forms': {
        // Service-account JSON — format validity only. Plan 06 runs the
        // real token-exchange probe during OAuth setup.
        try {
          const parsed = JSON.parse(plaintext) as {
            type?: string
            client_email?: string
          }
          if (parsed.type === 'service_account' && parsed.client_email) {
            return { ok: true }
          }
          return {
            ok: false,
            error: 'Expected a service-account JSON with type + client_email',
          }
        } catch {
          return { ok: false, error: 'Invalid JSON' }
        }
      }
      case 'gbp_agency_oauth':
      case 'gbp_client_oauth':
        // OAuth tokens validated by Plan 06 refresh flow — no probe here.
        return { ok: true }
      default:
        return { ok: false, error: `Unknown integration kind: ${String(kind)}` }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'network error'
    return { ok: false, error: msg }
  }
}

/** Test-only reset — lets tests swap env vars between runs. */
export function __resetKek(): void {
  _kek = null
}
