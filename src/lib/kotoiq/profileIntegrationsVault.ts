import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// D-02 envelope encryption for koto_agency_integrations.encrypted_payload.
// AES-256-GCM with agency_id bound as Additional Authenticated Data (AAD) —
// even if ciphertext is exfiltrated, decrypt requires the matching agency
// binding. Compatible with Supabase Vault migration later (payload_version
// bump on column; this code reads + migrates v=1 rows on read).

const KEK_ENV = 'KOTO_AGENCY_INTEGRATIONS_KEK'

function loadKek(): Buffer {
  const hex = process.env[KEK_ENV]
  if (!hex) {
    throw new Error(
      `[profileIntegrationsVault] Missing env ${KEK_ENV} — set a 32-byte hex key in Vercel Dashboard (64 hex chars)`
    )
  }
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) {
    throw new Error(
      `[profileIntegrationsVault] ${KEK_ENV} must decode to 32 bytes (got ${buf.length})`
    )
  }
  return buf
}

// Lazy-load so tests can swap process.env before import.
let _kek: Buffer | null = null
function kek(): Buffer { return _kek ?? (_kek = loadKek()) }

export type EncryptedPayload = {
  v: 1
  alg: 'aes-256-gcm'
  iv: string    // base64
  tag: string   // base64 (GCM auth tag)
  ct: string    // base64 (ciphertext)
  aad_agency: string   // agency_id bound as AAD
}

export function encryptSecret(plaintext: string, agencyId: string): EncryptedPayload {
  const iv = randomBytes(12)   // 96-bit IV per GCM best-practice
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
  constructor(public code: 'DECRYPT_AAD_MISMATCH' | 'DECRYPT_AUTH_FAIL' | 'DECRYPT_FORMAT', msg: string) {
    super(msg)
    this.name = 'VaultError'
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
    const decipher = createDecipheriv('aes-256-gcm', kek(), Buffer.from(payload.iv, 'base64'))
    decipher.setAAD(Buffer.from(agencyId, 'utf8'))
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
    const pt = Buffer.concat([
      decipher.update(Buffer.from(payload.ct, 'base64')),
      decipher.final(),
    ])
    return pt.toString('utf8')
  } catch (err: any) {
    if (err instanceof VaultError) throw err
    throw new VaultError('DECRYPT_AUTH_FAIL', `Authenticated decryption failed: ${err?.message ?? 'unknown'}`)
  }
}

// ── Integration kinds + live-probe test (D-32 "Test connection" button) ────

export type IntegrationKind =
  | 'typeform' | 'jotform' | 'google_forms'
  | 'gbp_agency_oauth' | 'gbp_client_oauth' | 'gbp_places_api'

export type TestResult = { ok: boolean; error?: string }

/** Fire a live probe to the vendor API to verify the key works.
 *  Writes nothing — caller persists the result via db.agencyIntegrations.markTested. */
export async function testConnection(
  kind: IntegrationKind,
  plaintext: string,
): Promise<TestResult> {
  try {
    switch (kind) {
      case 'typeform': {
        // GET /me — cheap whoami endpoint; 200 = valid token
        const r = await fetch('https://api.typeform.com/me', {
          headers: { Authorization: `Bearer ${plaintext}` },
        })
        if (r.status === 200) return { ok: true }
        if (r.status === 401 || r.status === 403) return { ok: false, error: 'Typeform rejected the API key' }
        return { ok: false, error: `Typeform returned ${r.status}` }
      }
      case 'jotform': {
        // GET /user with APIKEY header (per RESEARCH — header, not querystring, to avoid log leak)
        const r = await fetch('https://api.jotform.com/user', {
          headers: { APIKEY: plaintext },
        })
        if (r.status === 200) {
          const j = await r.json().catch(() => null) as any
          if (j?.responseCode === 200) return { ok: true }
        }
        return { ok: false, error: 'Jotform rejected the API key' }
      }
      case 'gbp_places_api': {
        // Places API (New): ping the autocomplete endpoint with a tiny query
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
        if (r.status === 400 || r.status === 403) return { ok: false, error: 'Places API key rejected or API not enabled' }
        return { ok: false, error: `Places API returned ${r.status}` }
      }
      case 'google_forms': {
        // google_forms credential is a service-account JSON; defer live probe
        // (requires token-exchange). Return ok=true on format validity; Plan 06
        // owns the real probe during OAuth flow.
        try {
          const parsed = JSON.parse(plaintext)
          if (parsed.type === 'service_account' && parsed.client_email) return { ok: true }
          return { ok: false, error: 'Expected a service-account JSON with type + client_email' }
        } catch { return { ok: false, error: 'Invalid JSON' } }
      }
      case 'gbp_agency_oauth':
      case 'gbp_client_oauth':
        // OAuth tokens aren't tested here — Plan 06 validates via refresh flow.
        return { ok: true }
      default:
        return { ok: false, error: `Unknown integration kind: ${kind}` }
    }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'network error' }
  }
}

/** Test-only reset — lets tests swap env vars between runs. */
export function __resetKek() { _kek = null }
