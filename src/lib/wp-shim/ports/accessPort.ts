// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 07 — accessPort — dashboard-side replacement of v3's
// modules/access.php.
//
// What v3 did vs what we do here:
//
//   v3 (modules/access.php):
//     • REST routes: access/roles (read), access/apply (write), access/snapshot,
//       access/revert.
//     • Stored policy at wp_options `kotoiq_access_policy` (or whatever the
//       KOTOIQ_OPT_ACCESS_POLICY define resolved to).
//     • The feature→cap mapping (`kotoiq_am_features_to_caps`) was hardcoded
//       in plugin source: e.g. `php_snippets: full` → grants execute_php_snippets
//       + create_text_snippets + manage_snippets. THIS IS THE IP-LEAK we close.
//     • Runtime: user_has_cap filter (kotoiq_am_user_has_cap_filter) read
//       the policy and denied caps. Plus admin_menu filter hiding theme/plugin
//       editor submenus.
//
//   v4 (this file + Plan 10-05 runtime/access-filter.php + capability.apply verb):
//     • Feature→cap mapping (`FEATURE_CAP_MAP` below) lives HERE in TypeScript.
//       The plugin source has NO knowledge of "php_snippets full grants which
//       three caps." The shim sees only "the dashboard asked us to add caps
//       X, Y, Z to role editor." Generic capability primitive.
//     • applyAccessPolicy() composes the cap diff dashboard-side, then issues
//       N capability.apply calls (one per role) + writes the policy to
//       `kotoiq_shim_access_policy`.
//     • runtime/access-filter.php (Plan 10-05) registers the user_has_cap
//       filter that reads `kotoiq_shim_access_policy` and applies denies.
//       The filter is GENERIC — knows nothing about "php_snippets" feature
//       names; it loops a policy that says {role: {denied_caps: [...]}}.
//     • The "global disable file edit" toggle (v3 KOTOIQ_OPT_DISABLE_FILE_EDIT)
//       is captured as a top-level policy field; the runtime applies it.
//
// IP-leak risk: the feature names in FEATURE_CAP_MAP describe what KotoIQ
// considers a feature ("php_snippets", "file_editor", etc.). These live in
// the dashboard source on Vercel (unreadable by clients). The plugin sees
// only the raw cap names that result from the mapping — and `manage_snippets`
// is a well-known WP cap from dozens of public plugins (Code Snippets,
// WP-Code, etc.). So the cap names alone tell a hostile reader nothing
// beyond "this plugin has features that grant common WP-snippet caps."
// ─────────────────────────────────────────────────────────────────────────────

import { optionGet, optionUpdate, capabilityApply } from '../verbs'
import type { CapabilityApplyResponse, OptionUpdateResponse } from '../verbs'
import type { ShimRpcResponse } from '../types'

export const ACCESS_POLICY_OPTION = 'kotoiq_shim_access_policy'

// ── Feature → capability map ─────────────────────────────────────────────────
// Ported verbatim from v3 modules/access.php `kotoiq_am_features_to_caps()`.
// Cap names match v3 so existing sites with these caps already granted on
// roles continue working without surgery during the cutover window.
//
// IMPORTANT: do NOT add WP-core caps (manage_options / install_plugins /
// edit_files / unfiltered_html / create_users / edit_themes / edit_plugins)
// to this map as GRANTS — they would be rejected by the shim's capability.apply
// verb (Plan 10-05 ALWAYS_DENIED_CAPS gate). v3 used `edit_themes`/`edit_plugins`
// as GRANT targets, but in v4 the runtime/access-filter.php still applies the
// DENY for those caps when a role's feature is set to "denied". So the
// FEATURE_CAP_MAP entries below are CONCEPTUAL — they describe what
// capabilities each feature would grant — and applyAccessPolicy() converts
// them into capability.apply calls ONLY for caps that pass the ALWAYS_DENIED
// gate. The denies for the core caps happen at runtime via user_has_cap filter.
//
export const FEATURE_CAP_MAP: Record<string, readonly string[]> = {
    // PHP snippets: granular three-level (full / text / none).
    // 'full' grants all three. 'text' drops execute_php_snippets only.
    // 'none' is handled by the deny path in applyAccessPolicy.
    php_snippets: ['execute_php_snippets', 'create_text_snippets', 'manage_snippets'],
    php_snippets_text_only: ['create_text_snippets', 'manage_snippets'],

    // Snippet management (orthogonal to php_snippets).
    snippet_management: ['manage_snippets'],

    // KotoIQ-managed caps (custom, never collide with WP core).
    pixels: ['manage_pixels'],
    access_management: ['manage_access'],
    redirects_admin: ['manage_redirects'],
    seo_settings: ['manage_seo_settings'],

    // WP-core caps — listed for the deny path (applyAccessPolicy translates
    // 'file_editor: denied' into a runtime policy entry). Plan 10-05's verb
    // gate REJECTS these as add_caps targets; they're only used as removals.
    file_editor: ['edit_files'],
    theme_editor: ['edit_themes'],
    plugin_editor: ['edit_plugins'],
}

// Caps that capability.apply ALWAYS_DENIED — cannot be GRANTED via the verb.
// (Mirror of the constant in verbs/index.ts; duplicated here so applyAccessPolicy
// can pre-filter add_caps before the shim rejects them.)
const ALWAYS_DENIED_CAPS = new Set<string>([
    'manage_options',
    'install_plugins',
    'edit_themes',
    'edit_plugins',
    'edit_files',
    'unfiltered_html',
    'create_users',
])

// ── Policy shape ─────────────────────────────────────────────────────────────

export type PhpSnippetLevel = 'full' | 'text' | 'none'
export type GrantLevel = 'granted' | 'denied'

/**
 * Per-role feature toggles. The shape mirrors v3's serialized option so
 * existing sites' stored data deserializes cleanly during cutover.
 */
export interface RoleFeatures {
    php_snippets?: PhpSnippetLevel
    snippet_management?: GrantLevel
    file_editor?: GrantLevel
    theme_editor?: GrantLevel
    plugin_editor?: GrantLevel
    pixels?: GrantLevel
    access_management?: GrantLevel
    redirects_admin?: GrantLevel
    seo_settings?: GrantLevel
}

export interface AccessPolicy {
    /** Map of role slug → per-role feature toggles. */
    role_features: Record<string, RoleFeatures>
    /** Global flag — when true, the runtime denies edit_themes/edit_plugins/edit_files for ALL roles. */
    global_disable_file_edit: boolean
    /** Last-applied timestamp (set by applyAccessPolicy on each successful write). */
    applied_at?: string
}

const EMPTY_POLICY: AccessPolicy = {
    role_features: {},
    global_disable_file_edit: false,
}

function isObject(v: unknown): v is Record<string, unknown> {
    return v != null && typeof v === 'object' && !Array.isArray(v)
}

function normalizePolicy(raw: unknown): AccessPolicy {
    if (!isObject(raw)) return { ...EMPTY_POLICY }
    const rf = isObject(raw.role_features) ? raw.role_features : {}
    const role_features: Record<string, RoleFeatures> = {}
    for (const [slug, val] of Object.entries(rf)) {
        if (!isObject(val)) continue
        const f: RoleFeatures = {}
        const v = val as Record<string, unknown>
        if (v.php_snippets === 'full' || v.php_snippets === 'text' || v.php_snippets === 'none') {
            f.php_snippets = v.php_snippets
        }
        const grantKeys = [
            'snippet_management',
            'file_editor',
            'theme_editor',
            'plugin_editor',
            'pixels',
            'access_management',
            'redirects_admin',
            'seo_settings',
        ] as const
        for (const k of grantKeys) {
            const x = v[k]
            if (x === 'granted' || x === 'denied') f[k] = x
        }
        role_features[slug] = f
    }
    return {
        role_features,
        global_disable_file_edit: raw.global_disable_file_edit === true,
        applied_at: typeof raw.applied_at === 'string' ? raw.applied_at : undefined,
    }
}

// ── Cap diffing ──────────────────────────────────────────────────────────────

/**
 * Compute the (add_caps, remove_caps) tuple for one role's feature settings.
 *
 * Exported for testing; applyAccessPolicy calls this per role internally.
 *
 * Rules (mirror v3 kotoiq_am_features_to_caps + kotoiq_am_denied_caps):
 *   php_snippets=full → add [execute_php_snippets, create_text_snippets, manage_snippets]
 *   php_snippets=text → add [create_text_snippets, manage_snippets], remove [execute_php_snippets]
 *   php_snippets=none → remove all three snippet caps
 *   <other>=granted   → add the feature's caps
 *   <other>=denied    → remove the feature's caps
 *
 * Caps in ALWAYS_DENIED_CAPS are filtered out of add_caps (they can never
 * be granted via the shim — only removed). The runtime/access-filter.php
 * handles the runtime deny for core caps even on roles that WP grants
 * by default.
 */
export function computeRoleCapDiff(features: RoleFeatures): {
    add_caps: string[]
    remove_caps: string[]
} {
    const add = new Set<string>()
    const remove = new Set<string>()

    // php_snippets (three-level)
    if (features.php_snippets === 'full') {
        for (const c of FEATURE_CAP_MAP.php_snippets) add.add(c)
    } else if (features.php_snippets === 'text') {
        for (const c of FEATURE_CAP_MAP.php_snippets_text_only) add.add(c)
        remove.add('execute_php_snippets')
    } else if (features.php_snippets === 'none') {
        for (const c of FEATURE_CAP_MAP.php_snippets) remove.add(c)
    }

    // Two-level features.
    const grantPairs: Array<[keyof RoleFeatures, readonly string[]]> = [
        ['snippet_management', FEATURE_CAP_MAP.snippet_management],
        ['pixels', FEATURE_CAP_MAP.pixels],
        ['access_management', FEATURE_CAP_MAP.access_management],
        ['redirects_admin', FEATURE_CAP_MAP.redirects_admin],
        ['seo_settings', FEATURE_CAP_MAP.seo_settings],
        ['file_editor', FEATURE_CAP_MAP.file_editor],
        ['theme_editor', FEATURE_CAP_MAP.theme_editor],
        ['plugin_editor', FEATURE_CAP_MAP.plugin_editor],
    ]
    for (const [feat, caps] of grantPairs) {
        const v = features[feat]
        if (v === 'granted') {
            for (const c of caps) add.add(c)
        } else if (v === 'denied') {
            for (const c of caps) remove.add(c)
        }
    }

    // Strip ALWAYS_DENIED_CAPS from add side — the shim verb would reject
    // them. The remove side keeps them so the runtime policy + remove_cap
    // call still take effect for non-core roles.
    const add_caps = [...add].filter((c) => !ALWAYS_DENIED_CAPS.has(c))
    const remove_caps = [...remove]
    return { add_caps, remove_caps }
}

// ── Public port API ──────────────────────────────────────────────────────────

/**
 * Read the current access policy. Returns the empty default if the option
 * has never been written.
 */
export async function getAccessPolicy(
    siteUrl: string,
): Promise<
    | { ok: true; data: AccessPolicy; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const res = await optionGet(siteUrl, { name: ACCESS_POLICY_OPTION })
    if (!res.ok) return res
    return { ok: true, data: normalizePolicy(res.data?.value), status: res.status }
}

export interface ApplyAccessPolicyResult {
    applied_roles: Array<{
        role_slug: string
        add_caps: string[]
        remove_caps: string[]
        verb_response: CapabilityApplyResponse | { ok: false; error: string }
    }>
    policy_written: boolean
    errors: Array<{ role_slug: string; code: string; message: string }>
}

/**
 * Apply a policy to a site. Order of operations matters:
 *   1. Write the policy option FIRST (so the runtime filter sees the new
 *      denies even if a later capability.apply call fails).
 *   2. For each role, compute (add_caps, remove_caps) via FEATURE_CAP_MAP +
 *      issue capability.apply. Aggregate errors but don't short-circuit —
 *      partial application is recoverable (operator re-runs).
 */
export async function applyAccessPolicy(
    siteUrl: string,
    policy: Omit<AccessPolicy, 'applied_at'>,
): Promise<
    | { ok: true; data: ApplyAccessPolicyResult; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const normalized = normalizePolicy(policy)
    normalized.applied_at = new Date().toISOString()

    // Step 1: persist policy.
    const writeRes = await optionUpdate(siteUrl, {
        name: ACCESS_POLICY_OPTION,
        value: normalized,
        autoload: true,
    })
    if (!writeRes.ok) return writeRes

    const result: ApplyAccessPolicyResult = {
        applied_roles: [],
        policy_written: true,
        errors: [],
    }

    // Step 2: per-role capability.apply.
    for (const [role_slug, features] of Object.entries(normalized.role_features)) {
        if (role_slug === 'administrator') {
            // Per Plan 10-05 verb guard — administrator role is protected.
            // We don't even attempt the call; record explicit skip.
            result.errors.push({
                role_slug,
                code: 'role_protected',
                message: 'administrator role cannot be modified via capability.apply',
            })
            continue
        }
        const { add_caps, remove_caps } = computeRoleCapDiff(features)
        if (add_caps.length === 0 && remove_caps.length === 0) {
            result.applied_roles.push({
                role_slug,
                add_caps: [],
                remove_caps: [],
                verb_response: { ok: false, error: 'noop' },
            })
            continue
        }
        const verbRes = await capabilityApply(siteUrl, {
            role_slug,
            add_caps,
            remove_caps,
        })
        if (verbRes.ok) {
            result.applied_roles.push({
                role_slug,
                add_caps,
                remove_caps,
                verb_response: verbRes.data,
            })
        } else {
            result.errors.push({
                role_slug,
                code: verbRes.error.code,
                message: verbRes.error.message,
            })
            result.applied_roles.push({
                role_slug,
                add_caps,
                remove_caps,
                verb_response: { ok: false, error: verbRes.error.message },
            })
        }
    }

    return { ok: true, data: result, status: writeRes.status }
}

/**
 * Reset the policy — for each non-administrator role in the current policy,
 * issue capability.apply with remove_caps containing every cap the policy
 * had granted. Then delete the policy option.
 *
 * After this completes, runtime/access-filter.php sees no policy and does
 * not apply any denies; capability.apply has stripped the granted caps.
 * Sites should manually reset administrator if any operator added caps
 * outside the policy.
 */
export async function resetAccessPolicy(
    siteUrl: string,
): Promise<
    | { ok: true; data: { reset_roles: string[]; errors: ApplyAccessPolicyResult['errors'] }; status: number }
    | { ok: false; error: { code: string; message: string }; status: number }
> {
    const current = await getAccessPolicy(siteUrl)
    if (!current.ok) return current
    const reset_roles: string[] = []
    const errors: ApplyAccessPolicyResult['errors'] = []
    // Compute the full union of caps managed by FEATURE_CAP_MAP — these are
    // the caps to remove from every role this policy touched.
    const managedCaps = new Set<string>()
    for (const caps of Object.values(FEATURE_CAP_MAP)) {
        for (const c of caps) managedCaps.add(c)
    }
    const removeList = [...managedCaps].filter((c) => !ALWAYS_DENIED_CAPS.has(c))
    for (const role_slug of Object.keys(current.data.role_features)) {
        if (role_slug === 'administrator') continue
        const verbRes = await capabilityApply(siteUrl, {
            role_slug,
            remove_caps: removeList,
        })
        if (verbRes.ok) {
            reset_roles.push(role_slug)
        } else {
            errors.push({ role_slug, code: verbRes.error.code, message: verbRes.error.message })
        }
    }
    // Write an empty policy (rather than option.delete) so the runtime sees
    // a clean state explicitly. The runtime treats empty role_features as
    // "no denies" — equivalent to deleting the option.
    const writeRes = await optionUpdate(siteUrl, {
        name: ACCESS_POLICY_OPTION,
        value: { role_features: {}, global_disable_file_edit: false, applied_at: new Date().toISOString() },
        autoload: true,
    })
    if (!writeRes.ok) return writeRes
    return { ok: true, data: { reset_roles, errors }, status: writeRes.status }
}

// Re-export the response type so downstream UI can pin it.
export type { OptionUpdateResponse }
