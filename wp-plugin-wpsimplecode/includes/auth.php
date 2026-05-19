<?php
/**
 * Auth — REST permission callbacks. Two modes:
 *   1. Logged-in admin via WP cookie (manage_options)  — local management
 *   2. Bearer token via Authorization header           — remote control
 *
 * Remote mode is off by default. User must:
 *   - Enable it on the Settings page (WPSC_OPT_REMOTE_ALLOWED = true)
 *   - The Bearer token in the request must match WPSC_OPT_API_KEY
 *   - Optionally lock the request origin to WPSC_OPT_REMOTE_HOST
 *
 * @package WPSimpleCode
 */

if (!defined('ABSPATH')) exit;

/**
 * Generic permission callback for non-destructive endpoints (reads).
 * Allows local admin OR remote token.
 */
function wpsc_perm_read() {
    return wpsc_check_admin_or_remote('read');
}

/**
 * Permission callback for destructive endpoints (writes, applies, search-replace runs).
 * Same as read but logged for auditability.
 */
function wpsc_perm_write() {
    return wpsc_check_admin_or_remote('write');
}

function wpsc_check_admin_or_remote($mode = 'read') {
    // Local admin
    if (current_user_can('manage_options')) return true;

    // Remote control
    if (!get_option(WPSC_OPT_REMOTE_ALLOWED, false)) {
        return new WP_Error('rest_forbidden', 'Remote control is disabled on this site.', ['status' => 403]);
    }
    $stored_key = (string) get_option(WPSC_OPT_API_KEY, '');
    if ($stored_key === '') {
        return new WP_Error('rest_forbidden', 'No API key configured.', ['status' => 403]);
    }
    $presented = wpsc_extract_bearer_token();
    if (!$presented || !hash_equals($stored_key, $presented)) {
        return new WP_Error('rest_forbidden', 'Invalid API key.', ['status' => 403]);
    }

    // Optional host pin
    $pinned_host = trim((string) get_option(WPSC_OPT_REMOTE_HOST, ''));
    if ($pinned_host !== '') {
        $origin_hdr = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
        $referer    = isset($_SERVER['HTTP_REFERER']) ? (string) $_SERVER['HTTP_REFERER'] : '';
        $x_source   = isset($_SERVER['HTTP_X_WPSC_SOURCE']) ? (string) $_SERVER['HTTP_X_WPSC_SOURCE'] : '';
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

function wpsc_extract_bearer_token() {
    // Authorization header
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
    // Fallback custom header (handles hosts that strip Authorization)
    if (isset($_SERVER['HTTP_X_WPSC_KEY'])) return (string) $_SERVER['HTTP_X_WPSC_KEY'];
    return '';
}
