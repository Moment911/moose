// ─────────────────────────────────────────────────────────────────────────────
// Public API surface for the KotoIQ WP plugin thin-shim client library.
//
// Downstream consumers (Plans 04-09) must import from this file. The bare
// modules (shimRpc, wpFetch, credentialsVault, pairSite) are implementation
// details — the only safe paths in and out are listed below.
//
// Deliberately NOT re-exported: the credential-write helper, the raw
// encryption/decryption primitives, and the raw-pubkey extractor. Those
// live in the credentialsVault and pairSite modules and are pair-time
// internals only. Re-exporting them would risk double-encryption, wrong-KEK
// encryption, or accidental plaintext persistence. Keep the surface tight.
// ─────────────────────────────────────────────────────────────────────────────

// ── Signing client (Ed25519 envelope POST to /wp-json/kotoiq-shim/v1/rpc) ──
export { shimRpc, shimRpcBatch } from './shimRpc'
export type { ShimRpcOptions } from './shimRpc'

// ── WordPress core REST helper (Basic auth Application Password) ──────────
export { wpFetch, wpFetchJson } from './wpFetch'
export type { WpCredentials, WpFetchInit } from './wpFetch'

// ── Pairing flow ──────────────────────────────────────────────────────────
export { pairSite, openPairingWindow } from './pairSite'
export type { OpenPairingWindowResult, PairData, PairSiteResult } from './pairSite'

// ── Read-only credentials access (for downstream verb callers) ────────────
export { loadSiteCredentials } from './credentialsVault'
export type { SiteCredentials } from './credentialsVault'

// ── Canonical verb whitelist + type ───────────────────────────────────────
export { SHIM_VERBS, isShimVerb } from './verbList'
export type { ShimVerb } from './verbList'

// ── Shared type surface ───────────────────────────────────────────────────
export type {
    ShimRpcEnvelope,
    ShimRpcClaims,
    ShimRpcResponse,
    TemplateRow,
    TemplateVariable,
    TemplateTaxonomyRule,
    PushHistoryRow,
    DualRunLogRow,
    ShimPairingRow,
} from './types'
