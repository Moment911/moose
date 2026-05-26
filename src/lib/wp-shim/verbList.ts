// ─────────────────────────────────────────────────────────────────────────────
// Canonical 27-verb whitelist for the KotoIQ WP plugin thin-shim (v4).
//
// SINGLE SOURCE OF TRUTH. This file is mirrored in PHP at
// wp-plugin-kotoiq-shim/includes/rpc/verb-table.php (Plan 02). When you change
// the list here, regenerate or hand-update the PHP table — they MUST stay in
// sync or the dispatcher will reject otherwise-valid dashboard calls.
//
// Per CONTEXT.md D-CLAUDE-DISCRETION: the planner may refine the exact list;
// this implementation locks 10-RESEARCH.md §RPC Verb Design verbatim.
//
// Naming rule: noun.verb (kebab/snake_case allowed in each half), lowercase.
// Lock: a Vitest assertion in verbList.test.ts enforces the exact 27 entries
// and the regex shape, so accidental drift breaks `npm run test` immediately.
//
// IP-LEAKY VERB NAMES ARE FORBIDDEN. Do not add verbs that name a KotoIQ
// product capability (scoring, sitemap generation, content rotation, page
// factories, redirect management, etc.) — they reveal what KotoIQ does. Use
// generic primitives instead and put the proprietary logic in the dashboard
// (Vercel-hosted, unreadable by clients). The forbidden list lives in
// verbList.test.ts where it's enforced programmatically without polluting
// this file's grep surface.
// ─────────────────────────────────────────────────────────────────────────────

export const SHIM_VERBS = [
    // ── Read verbs (12) ─────────────────────────────────────────────────────
    'health.ping',
    'health.diagnostics',
    'post.get_meta_bulk',
    'option.get',
    'option.list_by_prefix',
    'query.select',
    'file.read',
    'file.exists',
    'events.log_tail',
    'cron.list',
    'plugin.list',
    'taxonomy.list',

    // ── Write verbs (10) ────────────────────────────────────────────────────
    'meta.update',
    'meta.delete',
    'option.update',
    'option.delete',
    'file.write',
    'file.delete',
    'elementor.save',
    'elementor.clone',
    'capability.apply',
    'transient.delete_prefix',

    // ── Operation verbs (5) ─────────────────────────────────────────────────
    'database.update_bulk',
    'cron.trigger',
    'cron.unschedule',
    'plugin.toggle',
    'webhook.set',
] as const

export type ShimVerb = (typeof SHIM_VERBS)[number]

/**
 * Runtime guard — does the given string belong to the canonical whitelist?
 * Use at the dispatcher boundary before routing to a handler.
 */
export function isShimVerb(value: unknown): value is ShimVerb {
    return typeof value === 'string' && (SHIM_VERBS as readonly string[]).includes(value)
}
