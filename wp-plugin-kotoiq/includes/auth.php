<?php
/**
 * Auth — REST permission callbacks. Two modes:
 *   1. Logged-in admin via WP cookie (manage_options)  — local management
 *   2. Bearer token via Authorization header           — remote control
 *
 * Remote mode is off by default. Site owner must:
 *   - Enable it on the Settings page (KOTOIQ_OPT_REMOTE_ALLOWED = true)
 *   - The Bearer token in the request must match KOTOIQ_OPT_API_KEY
 *   - Optionally lock the request origin to KOTOIQ_OPT_REMOTE_HOST
 *
 * The wpsc_perm_* function names exist as aliases so module bodies that
 * still reference the old WPSimpleCode permission names continue to
 * resolve. New code should use kotoiq_perm_*.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

function kotoiq_perm_read() {
    return kotoiq_check_admin_or_remote('read');
}

function kotoiq_perm_write() {
    return kotoiq_check_admin_or_remote('write');
}

function kotoiq_check_admin_or_remote($mode = 'read') {
    if (current_user_can('manage_options')) return true;

    if (!get_option(KOTOIQ_OPT_REMOTE_ALLOWED, false)) {
        return new WP_Error('rest_forbidden', 'Remote control is disabled on this site.', ['status' => 403]);
    }
    $stored_key = (string) get_option(KOTOIQ_OPT_API_KEY, '');
    if ($stored_key === '') {
        return new WP_Error('rest_forbidden', 'No API key configured.', ['status' => 403]);
    }
    $presented = kotoiq_extract_bearer_token();
    if (!$presented || !hash_equals($stored_key, $presented)) {
        return new WP_Error('rest_forbidden', 'Invalid API key.', ['status' => 403]);
    }

    $pinned_host = trim((string) get_option(KOTOIQ_OPT_REMOTE_HOST, ''));
    if ($pinned_host !== '') {
        $origin_hdr = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
        $referer    = isset($_SERVER['HTTP_REFERER']) ? (string) $_SERVER['HTTP_REFERER'] : '';
        $x_source   = isset($_SERVER['HTTP_X_KOTOIQ_SOURCE']) ? (string) $_SERVER['HTTP_X_KOTOIQ_SOURCE'] :
                     (isset($_SERVER['HTTP_X_WPSC_SOURCE']) ? (string) $_SERVER['HTTP_X_WPSC_SOURCE'] : '');
        $candidates = array_filter([$origin_hdr, $referer, $x_source]);
        $matched = false;
        foreach ($candidates as $c) {
            if (stripos($c, $pinned_host) !== false) { $matched = true; break; }
        }
        if (!$matched && !empty($candidates)) {
            return new WP_Error('rest_forbidden', 'Origin not allowed.', ['status' => 403]);
        }
    }

    return true;
}

function kotoiq_extract_bearer_token() {
    $auth = '';
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $auth = (string) $v; break; }
        }
    }
    if ($auth === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) $auth = (string) $_SERVER['HTTP_AUTHORIZATION'];
    if ($auth === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $auth = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];

    if ($auth !== '' && stripos($auth, 'Bearer ') === 0) {
        return trim(substr($auth, 7));
    }
    if (isset($_SERVER['HTTP_X_KOTOIQ_KEY'])) return (string) $_SERVER['HTTP_X_KOTOIQ_KEY'];
    if (isset($_SERVER['HTTP_X_WPSC_KEY'])) return (string) $_SERVER['HTTP_X_WPSC_KEY'];
    return '';
}

// Legacy aliases — kept so paste-ported module bodies continue to resolve.
if (!function_exists('wpsc_perm_read')) {
    function wpsc_perm_read()  { return kotoiq_perm_read(); }
    function wpsc_perm_write() { return kotoiq_perm_write(); }
    function wpsc_check_admin_or_remote($mode = 'read') { return kotoiq_check_admin_or_remote($mode); }
    function wpsc_extract_bearer_token() { return kotoiq_extract_bearer_token(); }
}
