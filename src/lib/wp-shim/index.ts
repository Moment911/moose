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

// ── Typed verb wrappers (Plan 10-04, 20 core verbs) ───────────────────────
// Each wrapper is a thin signature-with-types layer over shimRpc plus a
// runtime guard for high-risk verbs. The barrel below re-exports both the
// functions and their request/response interface types so downstream plans
// can pin call sites with full type safety.
export * from './verbs'

// ── Dashboard ports (Plan 10-07 — five v3 modules ported to TypeScript) ───
// Each port is a thin TypeScript layer on top of the typed verb wrappers
// that replaces a v3 PHP module. The dashboard owns the algorithm; the
// shim plugin sees only generic primitives. IP-protection win — a hostile
// reader of the WP plugin source can reconstruct none of the SEO scoring,
// redirect rules, snippet runtime, capability mapping, or search-replace
// walker logic that ships here.
export * from './ports/seoPort'
export * from './ports/redirectsPort'
export * from './ports/snippetsPort'
export * from './ports/accessPort'
export * from './ports/searchReplacePort'

// ── Dashboard ports (Plan 10-08 — sitemap composition + push + serve check) ─
export * from './ports/sitemapPort'
export * from './ports/sitemapServe'

// ── Templates (Plan 10-09 — Option B capture-and-push page-design model) ────
// Capture an Elementor page from a sandbox site as a reusable template with
// {variable} placeholders + push the template to N target sites by composing
// final Elementor JSON via variable substitution. Content rotation arrays
// wrap with [koto_rotate] shortcode (Plan 10-06 generic variant-picker).
// Push history persists every attempt for diff + replay.
export * from './templates'

// ── Dual-run shadow mode (Plan 10-10 — 7-day TypeScript port equivalence) ──
// diffEngine + dualRunRouter implement the side-by-side dual-run window per
// CONTEXT.md D-TypeScript-port-equivalence. createDualRunRouter wraps verb
// calls so a site in mode='active' fires v3 + v4 in parallel and logs the
// diff to koto_wp_dual_run_log; mode='promoted' samples 1% for monitoring.
export * from './dualRun'
