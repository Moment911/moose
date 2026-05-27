import 'server-only'
import { encryptSecret, decryptSecret, type EncryptedPayload } from '../kotoiq/profileIntegrationsVault'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 03 — per-site WP Application Password vault.
//
// Wraps Phase 8's `profileIntegrationsVault` (AES-256-GCM with agency_id bound
// as AAD) so the same KEK (KOTO_AGENCY_INTEGRATIONS_KEK) protects both:
//   - koto_agency_integrations.encrypted_payload (Phase 8)
//   - koto_wp_sites.app_password_encrypted       (Phase 10 — this file)
//
// Threats mitigated (see 10-03-PLAN.md <threat_model>):
//   T-10-03-01  App Password leakage in logs    — only username + fingerprint
//                                                  ever logged; plaintext never
//                                                  escapes the request scope
//   T-10-03-05  Missing KEK                     — vault throws explicit error
//   T-10-03-06  Tampering at rest               — AES-GCM auth tag detects
//   T-10-03-09  Cross-agency App Password read  — .eq('agency_id', ...) on
//                                                  every read/write
//
// Public surface (consumers must import via `index.ts`):
//   - encryptAppPassword   — KEK + AAD(agency) wrap of a plaintext App Password
//   - decryptAppPassword   — inverse; throws VaultError on tag mismatch
//   - loadSiteCredentials  — agency-scoped read from koto_wp_sites
//   - storeSiteCredentials — pair-time write to koto_wp_sites
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envelope-encrypt an App Password. AAD binds the agency_id so a ciphertext
 * exfiltrated from row R of agency A cannot be decrypted in row R of agency B.
 */
export function encryptAppPassword(appPassword: string, agencyId: string): EncryptedPayload {
    if (typeof appPassword !== 'string' || appPassword === '') {
        throw new Error('[credentialsVault] appPassword must be a non-empty string')
    }
    if (typeof agencyId !== 'string' || agencyId === '') {
        throw new Error('[credentialsVault] agencyId must be a non-empty string')
    }
    return encryptSecret(appPassword, agencyId)
}

/**
 * Decrypt an envelope-encrypted App Password. Throws VaultError with
 * a specific code on AAD mismatch, format error, or auth tag failure.
 */
export function decryptAppPassword(payload: EncryptedPayload, agencyId: string): string {
    return decryptSecret(payload, agencyId)
}

export interface SiteCredentials {
    username: string
    appPassword: string
    fingerprint: string
}

/**
 * Read encrypted App Password credentials for a paired site.
 *
 * Returns null if the row exists but has not been paired with a v4 shim yet
 * (app_password_encrypted is null). Throws on cross-agency access (RLS) or
 * decrypt failure.
 */
export async function loadSiteCredentials(
    supabase: SupabaseClient,
    agencyId: string,
    siteId: string,
): Promise<SiteCredentials | null> {
    if (!agencyId) throw new Error('[credentialsVault] agencyId required')
    if (!siteId) throw new Error('[credentialsVault] siteId required')

    const { data, error } = await supabase
        .from('koto_wp_sites')
        .select('app_password_username, app_password_encrypted, dashboard_pubkey_fingerprint')
        .eq('id', siteId)
        .eq('agency_id', agencyId)
        .maybeSingle()

    if (error) {
        // Strip any data values from the message — agency_id and site_id IDs
        // are OK to surface in errors, but never the encrypted payload.
        throw new Error(`[credentialsVault] load failed for site=${siteId}: ${error.message}`)
    }
    if (!data) return null

    const username = (data as { app_password_username: string | null }).app_password_username
    const encrypted = (data as { app_password_encrypted: string | null }).app_password_encrypted
    const fingerprint = (data as { dashboard_pubkey_fingerprint: string | null }).dashboard_pubkey_fingerprint

    if (!username || !encrypted || !fingerprint) {
        return null // site row exists but is unpaired
    }

    let payload: EncryptedPayload
    try {
        payload = JSON.parse(encrypted) as EncryptedPayload
    } catch {
        throw new Error(`[credentialsVault] stored app_password_encrypted is not valid JSON for site=${siteId}`)
    }

    const appPassword = decryptAppPassword(payload, agencyId)
    return { username, appPassword, fingerprint }
}

// Synthetic module list seeded on every v4 pair so panel gating
// (ContentRotation, ElementorBuilder, SEO, SearchReplace, Access, Snippets)
// treats the site as fully enabled. v4 has no module on/off concept — every
// verb is always available — but the panels still read site.wpsc_modules to
// decide whether to render. Seeding here keeps that UI path unchanged.
//
// Keep slugs in sync with the panel files that check moduleEntry.slug.
export const V4_SYNTHETIC_MODULES = Object.freeze([
    { slug: 'content-rotation', name: 'Content Rotation', enabled: true },
    { slug: 'elementor-builder', name: 'Elementor Builder', enabled: true },
    { slug: 'seo', name: 'SEO', enabled: true },
    { slug: 'search-replace', name: 'Search & Replace', enabled: true },
    { slug: 'access', name: 'Access Management', enabled: true },
    { slug: 'snippets', name: 'Snippets', enabled: true },
])

/**
 * Persist pairing credentials. Called by `pairSite` after health.ping confirms
 * the freshly issued App Password actually works.
 *
 * Atomically updates: app_password_username, app_password_encrypted,
 * app_password_payload_version, dashboard_pubkey_fingerprint, paired_at_v4,
 * shim_version='v4', wpsc_modules (synthetic v4 module list).
 */
export async function storeSiteCredentials(
    supabase: SupabaseClient,
    agencyId: string,
    siteId: string,
    creds: SiteCredentials,
): Promise<void> {
    if (!agencyId) throw new Error('[credentialsVault] agencyId required')
    if (!siteId) throw new Error('[credentialsVault] siteId required')
    if (!creds.username || !creds.appPassword || !creds.fingerprint) {
        throw new Error('[credentialsVault] username, appPassword and fingerprint all required')
    }

    const encrypted = encryptAppPassword(creds.appPassword, agencyId)

    const { error } = await supabase
        .from('koto_wp_sites')
        .update({
            app_password_username: creds.username,
            app_password_encrypted: JSON.stringify(encrypted),
            app_password_payload_version: 1,
            dashboard_pubkey_fingerprint: creds.fingerprint,
            paired_at_v4: new Date().toISOString(),
            shim_version: 'v4',
            wpsc_modules: V4_SYNTHETIC_MODULES,
        })
        .eq('id', siteId)
        .eq('agency_id', agencyId)

    if (error) {
        // Surface the operational error — never the plaintext appPassword.
        throw new Error(`[credentialsVault] store failed for site=${siteId}: ${error.message}`)
    }
}
