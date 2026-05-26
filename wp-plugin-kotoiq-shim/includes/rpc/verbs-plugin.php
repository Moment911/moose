<?php
/**
 * Verb handlers — plugin.* group.
 *
 * Provides:
 *   - kotoiq_shim_verb_plugin_list   — enumerate installed plugins
 *   - kotoiq_shim_verb_plugin_toggle — activate / deactivate a plugin
 *
 * Self-toggle and legacy-toggle are explicitly denied:
 *   • The shim cannot deactivate itself (only a signed /destruct envelope can).
 *   • The legacy v3 plugin slug is denied during cutover; v3 must go through
 *     its own /destruct flow so audit + option cleanup happen in the right
 *     order (Plan 10-11).
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

function kotoiq_shim_verb_plugin_list($args) {
    unset($args);
    if (!function_exists('get_plugins')) require_once ABSPATH . 'wp-admin/includes/plugin.php';
    $all = function_exists('get_plugins') ? get_plugins() : [];
    $out = [];
    foreach ($all as $file => $meta) $out[] = [
        'file'    => (string) $file,
        'name'    => isset($meta['Name']) ? (string) $meta['Name'] : '',
        'version' => isset($meta['Version']) ? (string) $meta['Version'] : '',
        'active'  => is_plugin_active($file),
    ];
    usort($out, function ($a, $b) { return strcasecmp((string) $a['name'], (string) $b['name']); });
    return rest_ensure_response(['plugins' => $out]);
}

function kotoiq_shim_verb_plugin_toggle($args) {
    $plugin_file = isset($args['plugin_file']) ? (string) $args['plugin_file'] : '';
    if ($plugin_file === '' || strlen($plugin_file) > 255) return new WP_Error('bad_plugin_file', 'plugin_file must be a 1-255 char string', ['status' => 400]);
    if (strpos($plugin_file, '..') !== false || strpos($plugin_file, "\0") !== false) return new WP_Error('bad_plugin_file', 'illegal characters in plugin_file', ['status' => 400]);
    $enable = !empty($args['enable']);
    if (!function_exists('get_plugins')) require_once ABSPATH . 'wp-admin/includes/plugin.php';
    $all = function_exists('get_plugins') ? get_plugins() : [];
    if (!isset($all[$plugin_file])) return new WP_Error('not_installed', 'plugin not installed', ['status' => 404]);
    if (defined('KOTOIQ_SHIM_PLUGIN_FILE') && $plugin_file === plugin_basename(KOTOIQ_SHIM_PLUGIN_FILE)) return new WP_Error('cannot_toggle_self', 'the shim cannot toggle itself', ['status' => 403]);
    if ($plugin_file === 'wpsimplecode/wpsimplecode.php') return new WP_Error('cannot_toggle_legacy', 'use the legacy plugin /destruct flow during cutover', ['status' => 403]);
    $was_active = is_plugin_active($plugin_file);
    if ($enable) {
        $maybe = activate_plugin($plugin_file);
        if (is_wp_error($maybe)) return $maybe;
    } else {
        deactivate_plugins([$plugin_file]);
    }
    $is_active = is_plugin_active($plugin_file);
    if (function_exists('kotoiq_shim_emit_event')) kotoiq_shim_emit_event('plugin_toggled', ['plugin_file' => $plugin_file, 'was_active' => (bool) $was_active, 'is_active' => (bool) $is_active]);
    return rest_ensure_response(['ok' => true, 'was_active' => (bool) $was_active, 'is_active' => (bool) $is_active]);
}
