<?php
/**
 * Verb table — single PHP-side mirror of src/lib/wp-shim/verbList.ts.
 *
 * Keys MUST stay in lock-step with the canonical 27-verb list. Drift
 * causes dispatcher 400s for otherwise-valid dashboard calls.
 *
 * Only `health.ping` ships with a real handler in Plan 10-02. All other
 * verbs point at the not-yet-implemented stub; Plans 10-04 / 10-05 / 10-06
 * replace those entries with real handlers.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

if (!function_exists('kotoiq_shim_verb_not_yet_implemented')) {
    /**
     * Stub handler — returns a 501 for verbs declared but not yet wired.
     * Plans 10-04 / 10-05 / 10-06 replace the verb-table entries pointing
     * here with real handler functions.
     */
    function kotoiq_shim_verb_not_yet_implemented($args) {
        return new WP_Error(
            'not_implemented',
            'Verb stub — implemented in a later plan',
            ['status' => 501]
        );
    }
}

if (!function_exists('kotoiq_shim_verb_health_ping')) {
    /**
     * health.ping — the only real handler at this stage. Returns enough
     * for the dashboard to confirm pairing + version + WP / PHP info.
     * Does NOT enumerate active plugins (that's health.diagnostics).
     */
    function kotoiq_shim_verb_health_ping($args) {
        return rest_ensure_response([
            'shim_version'      => KOTOIQ_SHIM_VERSION,
            'wp_version'        => get_bloginfo('version'),
            'php_version'       => phpversion(),
            'site_url'          => get_site_url(),
            'time'              => time(),
            'elementor_version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : null,
        ]);
    }
}

// ─── Verb → handler map ────────────────────────────────────────────────────
// MUST match src/lib/wp-shim/verbList.ts exactly. Vitest enforces TS side;
// Plan 02 acceptance criteria enforce PHP side via node parse of this file.

return [
    // ── Read verbs (12) ────────────────────────────────────────────────────
    'health.ping'             => 'kotoiq_shim_verb_health_ping',
    'health.diagnostics'      => 'kotoiq_shim_verb_not_yet_implemented',
    'post.get_meta_bulk'      => 'kotoiq_shim_verb_not_yet_implemented',
    'option.get'              => 'kotoiq_shim_verb_not_yet_implemented',
    'option.list_by_prefix'   => 'kotoiq_shim_verb_not_yet_implemented',
    'query.select'            => 'kotoiq_shim_verb_not_yet_implemented',
    'file.read'               => 'kotoiq_shim_verb_not_yet_implemented',
    'file.exists'             => 'kotoiq_shim_verb_not_yet_implemented',
    'events.log_tail'         => 'kotoiq_shim_verb_not_yet_implemented',
    'cron.list'               => 'kotoiq_shim_verb_not_yet_implemented',
    'plugin.list'             => 'kotoiq_shim_verb_not_yet_implemented',
    'taxonomy.list'           => 'kotoiq_shim_verb_not_yet_implemented',

    // ── Write verbs (10) ───────────────────────────────────────────────────
    'meta.update'             => 'kotoiq_shim_verb_not_yet_implemented',
    'meta.delete'             => 'kotoiq_shim_verb_not_yet_implemented',
    'option.update'           => 'kotoiq_shim_verb_not_yet_implemented',
    'option.delete'           => 'kotoiq_shim_verb_not_yet_implemented',
    'file.write'              => 'kotoiq_shim_verb_not_yet_implemented',
    'file.delete'             => 'kotoiq_shim_verb_not_yet_implemented',
    'elementor.save'          => 'kotoiq_shim_verb_not_yet_implemented',
    'elementor.clone'         => 'kotoiq_shim_verb_not_yet_implemented',
    'capability.apply'        => 'kotoiq_shim_verb_not_yet_implemented',
    'transient.delete_prefix' => 'kotoiq_shim_verb_not_yet_implemented',

    // ── Operation verbs (5) ────────────────────────────────────────────────
    'database.update_bulk'    => 'kotoiq_shim_verb_not_yet_implemented',
    'cron.trigger'            => 'kotoiq_shim_verb_not_yet_implemented',
    'cron.unschedule'         => 'kotoiq_shim_verb_not_yet_implemented',
    'plugin.toggle'           => 'kotoiq_shim_verb_not_yet_implemented',
    'webhook.set'             => 'kotoiq_shim_verb_not_yet_implemented',
];
