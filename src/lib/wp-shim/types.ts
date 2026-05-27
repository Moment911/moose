// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the KotoIQ WP plugin thin-shim (v4).
//
// All row interfaces use snake_case keys to match Postgres column names — no
// camelCase mapping at this layer. Downstream callers (UI components) can
// remap if they want camelCase props.
//
// Per Phase 10 Plan 01 — these mirror the schema in
// supabase/migrations/20260626_kotoiq_shim.sql.
// ─────────────────────────────────────────────────────────────────────────────

import type { ShimVerb } from './verbList'

// ─── RPC envelope (signed by dashboard, verified by shim plugin) ───────────

/**
 * The wire shape posted to /wp-json/kotoiq-shim/v1/rpc.
 *
 * Both fields are base64url-encoded:
 *   - payload   = base64url(JSON({ verb, args, iat, exp, nonce }))
 *   - signature = base64url(Ed25519 detached signature over the payload bytes)
 *
 * The plugin verifies the signature against the pubkey stored at pair time,
 * then re-decodes the payload to dispatch on `verb`.
 */
export interface ShimRpcEnvelope {
    payload: string
    signature: string
}

/**
 * The inner JWT-shaped claims inside the envelope.payload. 60-second TTL,
 * single-use nonce (transient-cached for 90s on the WP side to defeat replay).
 */
export interface ShimRpcClaims<Args = unknown> {
    verb: ShimVerb
    args: Args
    iat: number
    exp: number
    nonce: string
}

/**
 * Discriminated-union return type for every verb call from the dashboard.
 * `status` is the HTTP status code the plugin returned (or 0 if network err).
 */
export type ShimRpcResponse<T> =
    | { ok: true; data: T; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }

// ─── Supabase row interfaces (mirror migration columns) ────────────────────

/** A captured "design once, push to N sites" template. */
export interface TemplateRow {
    id: string
    agency_id: string
    source_site_id: string
    source_post_id: number
    name: string
    description: string | null
    elementor_data: unknown
    variable_schema: TemplateVariable[]
    seo_meta_template: Record<string, string> | null
    taxonomy_template: TemplateTaxonomyRule | null
    captured_at: string
    captured_by: string | null
    archived_at: string | null
    created_at: string
    updated_at: string
}

/** One declared variable in a captured template's schema. */
export interface TemplateVariable {
    name: string
    label: string
    description?: string
    default?: string
    type: 'text' | 'image_url' | 'link_url' | 'list'
}

/** Optional taxonomy rules a template can carry (assignment at push time). */
export interface TemplateTaxonomyRule {
    categories?: Array<string | number>
    tags?: Array<string | number>
}

/** One row per template-push attempt (succeeded, failed, or rolled back). */
export interface PushHistoryRow {
    id: string
    agency_id: string
    template_id: string
    target_site_id: string
    pushed_post_id: number | null
    pushed_post_url: string | null
    variable_values: Record<string, unknown>
    rendered_elementor_data: unknown
    rendered_seo_meta: Record<string, string> | null
    idempotency_key: string
    status: 'pending' | 'succeeded' | 'failed' | 'rolled_back'
    error_code: string | null
    error_message: string | null
    pushed_at: string | null
    pushed_by: string | null
    created_at: string
    updated_at: string
}

/**
 * Append-only diff log for v3 vs v4 shadow-mode comparison.
 * NEVER stores full args / response bodies (PII risk) — only sha256 hashes.
 */
export interface DualRunLogRow {
    id: string
    agency_id: string
    site_id: string
    verb: string
    legacy_endpoint: string | null
    args_hash: string
    v3_response_hash: string | null
    v4_response_hash: string | null
    diff_status:
        | 'match'
        | 'minor_diff'
        | 'major_diff'
        | 'v3_error'
        | 'v4_error'
        | 'both_error'
        | 'v4_only'
    diff_summary: Record<string, unknown> | null
    latency_v3_ms: number | null
    latency_v4_ms: number | null
    called_at: string
}

/** Append-only per-site pairing audit. */
export interface ShimPairingRow {
    id: string
    agency_id: string
    site_id: string
    event:
        | 'pair_started'
        | 'pair_completed'
        | 'pair_failed'
        | 'app_password_issued'
        | 'promoted_to_v4'
        | 'rolled_back'
        | 'unpaired'
    dashboard_pubkey_fingerprint: string | null
    notes: Record<string, unknown> | null
    created_at: string
}
