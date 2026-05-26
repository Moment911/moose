<?php
/**
 * Verb handlers — option.* group.
 *
 * Provides:
 *   - kotoiq_shim_verb_option_get
 *   - kotoiq_shim_verb_option_update        (deny-list enforced)
 *   - kotoiq_shim_verb_option_delete        (deny-list enforced)
 *   - kotoiq_shim_verb_option_list_by_prefix
 *
 * DENY_LIST guards critical identity options (siteurl, home, admin_email,
 * template, stylesheet, WPLANG, blogname, blogdescription). Rewriting any
 * of these via the shim equals site takeover, so they're locked.
 *
 * Transient-style names (`_transient_*`, `_site_transient_*`) are rejected
 * for writes/deletes — callers use the transient verb group (Plan 10-05).
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

if (!defined('KOTOIQ_SHIM_OPTION_DENY_LIST')) {
    define('KOTOIQ_SHIM_OPTION_DENY_LIST', ['siteurl', 'home', 'admin_email', 'template', 'stylesheet', 'WPLANG', 'blogname', 'blogdescription']);
}

function kotoiq_shim_option_deny_check($name) {
    if (!is_string($name) || $name === '' || strlen($name) > 191) return new WP_Error('bad_name', 'name length must be 1-191', ['status' => 400]);
    if (strpos($name, '_transient_') === 0 || strpos($name, '_site_transient_') === 0) return new WP_Error('use_transient_api', 'transient ops must use the transient verb group', ['status' => 400]);
    if (in_array($name, KOTOIQ_SHIM_OPTION_DENY_LIST, true)) return new WP_Error('option_denied', 'option is on the protected deny-list', ['status' => 403]);
    return null;
}

function kotoiq_shim_verb_option_get($args) {
    $name = isset($args['name']) ? (string) $args['name'] : '';
    if ($name === '' || strlen($name) > 191) return new WP_Error('bad_name', 'name length must be 1-191', ['status' => 400]);
    $sentinel = '__kotoiq_shim_missing__';
    $value = get_option($name, $sentinel);
    $exists = ($value !== $sentinel);
    return rest_ensure_response(['value' => $exists ? $value : null, 'exists' => $exists]);
}

function kotoiq_shim_verb_option_update($args) {
    $name = isset($args['name']) ? (string) $args['name'] : '';
    $deny = kotoiq_shim_option_deny_check($name);
    if ($deny instanceof WP_Error) return $deny;
    $autoload = isset($args['autoload']) ? (bool) $args['autoload'] : false;
    $value = array_key_exists('value', $args) ? $args['value'] : null;
    $changed = (bool) update_option($name, $value, $autoload);
    if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('option_updated', ['name' => $name, 'autoload' => $autoload, 'changed' => $changed]);
    return rest_ensure_response(['ok' => true, 'changed' => $changed]);
}

function kotoiq_shim_verb_option_delete($args) {
    $name = isset($args['name']) ? (string) $args['name'] : '';
    $deny = kotoiq_shim_option_deny_check($name);
    if ($deny instanceof WP_Error) return $deny;
    $deleted = (bool) delete_option($name);
    if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('option_deleted', ['name' => $name, 'deleted' => $deleted]);
    return rest_ensure_response(['ok' => true, 'deleted' => $deleted]);
}

function kotoiq_shim_verb_option_list_by_prefix($args) {
    global $wpdb;
    $prefix = isset($args['prefix']) ? (string) $args['prefix'] : '';
    $limit = isset($args['limit']) ? (int) $args['limit'] : 100;
    if ($prefix === '' || strlen($prefix) > 100) return new WP_Error('bad_prefix', 'prefix length must be 1-100', ['status' => 400]);
    if (!preg_match('/^[A-Za-z0-9_-]+$/', $prefix)) return new WP_Error('bad_prefix', 'prefix must match /^[A-Za-z0-9_-]+$/', ['status' => 400]);
    if ($limit < 1 || $limit > 500) return new WP_Error('bad_limit', 'limit must be 1-500', ['status' => 400]);
    $like = $wpdb->esc_like($prefix) . '%';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- prefix-scoped read with prepared LIKE
    $rows = $wpdb->get_results($wpdb->prepare("SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s LIMIT %d", $like, $limit), ARRAY_A);
    if (!is_array($rows)) $rows = [];
    $options = [];
    foreach ($rows as $r) $options[] = ['name' => isset($r['option_name']) ? (string) $r['option_name'] : '', 'value' => isset($r['option_value']) ? (string) $r['option_value'] : ''];
    return rest_ensure_response(['options' => $options, 'count' => count($options)]);
}
