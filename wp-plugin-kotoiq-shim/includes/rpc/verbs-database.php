<?php
/**
 * Verb handlers — database.* group.
 *
 * kotoiq_shim_verb_database_update_bulk runs a batch of one-cell updates.
 * TABLE_COLUMN_WHITELIST is hardcoded; each row's {table, pk_col, column}
 * triple is validated, pk_val must be a positive int, values bound via
 * $wpdb->update with %s/%d format specifiers, each success emits an audit
 * event.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_database_whitelist() {
    global $wpdb;
    static $W = null;
    if ($W !== null) return $W;
    $W = [
        $wpdb->posts    => ['ID',        ['post_content','post_title','post_excerpt','post_name','post_status']],
        $wpdb->postmeta => ['meta_id',   ['meta_value']],
        $wpdb->options  => ['option_id', ['option_value']],
        $wpdb->termmeta => ['meta_id',   ['meta_value']],
        $wpdb->usermeta => ['umeta_id',  ['meta_value']],
    ];
    return $W;
}

function kotoiq_shim_verb_database_update_bulk($args) {
    global $wpdb;
    $updates = isset($args['updates']) && is_array($args['updates']) ? $args['updates'] : null;
    if ($updates === null) return new WP_Error('bad_args', 'updates must be an array', ['status' => 400]);
    if (count($updates) > 200) return new WP_Error('too_many', 'updates capped at 200 per call', ['status' => 400]);
    $W = kotoiq_shim_database_whitelist();
    $applied = 0; $errors = [];
    foreach ($updates as $u) {
        if (!is_array($u)) { $errors[] = ['code' => 'bad_entry']; continue; }
        $t = isset($u['table']) ? (string) $u['table'] : ''; $pk = isset($u['pk_col']) ? (string) $u['pk_col'] : ''; $pv = isset($u['pk_val']) ? (int) $u['pk_val'] : 0; $c = isset($u['column']) ? (string) $u['column'] : ''; $v = array_key_exists('value', $u) ? (string) $u['value'] : '';
        if (!isset($W[$t])) { $errors[] = ['table' => $t, 'code' => 'table_denied']; continue; }
        if ($pk !== $W[$t][0]) { $errors[] = ['table' => $t, 'code' => 'pk_mismatch']; continue; }
        if (!in_array($c, $W[$t][1], true)) { $errors[] = ['table' => $t, 'code' => 'column_denied']; continue; }
        if ($pv <= 0) { $errors[] = ['table' => $t, 'code' => 'bad_pk_val']; continue; }
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- whitelist-gated
        $r = $wpdb->update($t, [$c => $v], [$pk => $pv], ['%s'], ['%d']);
        if ($r === false) { $errors[] = ['table' => $t, 'code' => 'update_failed', 'message' => $wpdb->last_error ?: '']; continue; }
        $applied++;
        if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('database.bulk_update_applied', ['table' => $t, 'column' => $c, 'pk' => $pv]);
    }
    return rest_ensure_response(['applied' => $applied, 'errors' => $errors]);
}
