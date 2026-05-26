<?php
/**
 * Verb table — single PHP-side mirror of src/lib/wp-shim/verbList.ts.
 *
 * Pure data: this file MUST NOT define functions or run logic. All handler
 * functions live in the corresponding includes/rpc/verbs-*.php files,
 * which are loaded by kotoiq-shim.php before this table is required.
 *
 * Plan 10-04 fills in 20 of 27 entries with real handlers; the remaining
 * 7 stubs (query.select, capability.apply, transient.delete_prefix,
 * elementor.save, elementor.clone, database.update_bulk, webhook.set)
 * are wired in Plans 10-05 (5 entries) and 10-06 (2 entries).
 *
 * Drift between this file and src/lib/wp-shim/verbList.ts causes the
 * dispatcher to 400 otherwise-valid dashboard calls. The Plan 10-02
 * acceptance grep enforces parity from the TypeScript side; this header
 * documents the contract from the PHP side.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

// The 501 stub callback used for un-wired verbs is declared in
// includes/rpc/dispatcher.php so this file stays pure data.

return [
    // ── Read verbs (12) ────────────────────────────────────────────────────
    'health.ping'             => 'kotoiq_shim_verb_health_ping',
    'health.diagnostics'      => 'kotoiq_shim_verb_health_diagnostics',
    'post.get_meta_bulk'      => 'kotoiq_shim_verb_post_get_meta_bulk',
    'option.get'              => 'kotoiq_shim_verb_option_get',
    'option.list_by_prefix'   => 'kotoiq_shim_verb_option_list_by_prefix',
    'query.select'            => 'kotoiq_shim_verb_not_yet_implemented',
    'file.read'               => 'kotoiq_shim_verb_file_read',
    'file.exists'             => 'kotoiq_shim_verb_file_exists',
    'events.log_tail'         => 'kotoiq_shim_verb_events_log_tail',
    'cron.list'               => 'kotoiq_shim_verb_cron_list',
    'plugin.list'             => 'kotoiq_shim_verb_plugin_list',
    'taxonomy.list'           => 'kotoiq_shim_verb_taxonomy_list',

    // ── Write verbs (10) ───────────────────────────────────────────────────
    'meta.update'             => 'kotoiq_shim_verb_meta_update',
    'meta.delete'             => 'kotoiq_shim_verb_meta_delete',
    'option.update'           => 'kotoiq_shim_verb_option_update',
    'option.delete'           => 'kotoiq_shim_verb_option_delete',
    'file.write'              => 'kotoiq_shim_verb_file_write',
    'file.delete'             => 'kotoiq_shim_verb_file_delete',
    'elementor.save'          => 'kotoiq_shim_verb_not_yet_implemented',
    'elementor.clone'         => 'kotoiq_shim_verb_not_yet_implemented',
    'capability.apply'        => 'kotoiq_shim_verb_not_yet_implemented',
    'transient.delete_prefix' => 'kotoiq_shim_verb_not_yet_implemented',

    // ── Operation verbs (5) ────────────────────────────────────────────────
    'database.update_bulk'    => 'kotoiq_shim_verb_not_yet_implemented',
    'cron.trigger'            => 'kotoiq_shim_verb_cron_trigger',
    'cron.unschedule'         => 'kotoiq_shim_verb_cron_unschedule',
    'plugin.toggle'           => 'kotoiq_shim_verb_plugin_toggle',
    'webhook.set'             => 'kotoiq_shim_verb_not_yet_implemented',
];
