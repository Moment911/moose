<?php
/**
 * Verb handlers — transient.* group.
 *
 * Provides:
 *   - kotoiq_shim_verb_transient_delete_prefix — bulk-invalidate transients
 *
 * SECURITY: empty prefix is rejected (would otherwise wipe every transient
 * on the site). The prefix regex /^[A-Za-z0-9_-]{1,100}$/ blocks wildcard
 * injection; the LIKE pattern is built with $wpdb->esc_like as defence in
 * depth. Both _transient_{prefix}% and _transient_timeout_{prefix}% are
 * cleared in one query.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_verb_transient_delete_prefix($args) {
    global $wpdb;
    $prefix = isset($args['prefix']) ? (string) $args['prefix'] : '';
    if ($prefix === '') return new WP_Error('empty_prefix', 'empty prefix would delete every transient', ['status' => 400]);
    if (!preg_match('/^[A-Za-z0-9_-]{1,100}$/', $prefix)) return new WP_Error('bad_prefix', 'prefix must match /^[A-Za-z0-9_-]{1,100}$/', ['status' => 400]);
    $p1 = '_transient_' . $wpdb->esc_like($prefix) . '%';
    $p2 = '_transient_timeout_' . $wpdb->esc_like($prefix) . '%';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- prefix-scoped DELETE
    $n = $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s", $p1, $p2));
    if ($n === false) return new WP_Error('delete_failed', $wpdb->last_error ?: 'wpdb->query returned false', ['status' => 500]);
    if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('transient.prefix_deleted', ['prefix' => $prefix, 'count' => (int) $n]);
    return rest_ensure_response(['ok' => true, 'removed_count' => (int) $n]);
}
