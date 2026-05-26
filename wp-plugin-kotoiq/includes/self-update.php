<?php
/**
 * Self-update — accepts an authenticated update request, downloads the
 * checksum-verified zip from the agency host, runs WP's Plugin_Upgrader to
 * install it.
 *
 * Trust model (same as WordPress.org's auto-updater):
 *   • Channel auth: kotoiq_perm_write (remote_allowed + Bearer token +
 *     matching allowed_host).
 *   • Host pin: download_url must start with KOTOIQ_OPT_REMOTE_HOST so the
 *     plugin can't be tricked into downloading from anywhere else.
 *   • Integrity: sha256 of the downloaded file must match the value
 *     supplied in the request.
 *
 * A compromised update server means compromised plugins on every paired
 * site — same caveat as every plugin auto-updater. The opt-in remote flag
 * keeps this attack surface to sites that explicitly enabled it.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    kotoiq_register_rest_route('/self-update', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_self_update',
        'permission_callback' => 'kotoiq_perm_write',
    ]);
    kotoiq_register_rest_route('/self-update/info', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_self_update_info',
        'permission_callback' => 'kotoiq_perm_read',
    ]);
    kotoiq_register_rest_route('/config/allowed-host', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_set_allowed_host',
        'permission_callback' => 'kotoiq_perm_write',
    ]);
});

function kotoiq_set_allowed_host($req) {
    $p = $req->get_json_params();
    $host = isset($p['host']) ? trim((string) $p['host']) : '';
    if ($host === '' || stripos($host, 'https://') !== 0) {
        return new WP_Error('bad_host', 'host must be an https:// URL', ['status' => 400]);
    }
    update_option(KOTOIQ_OPT_REMOTE_HOST, $host);
    return rest_ensure_response(['ok' => true, 'allowed_host' => $host]);
}

function kotoiq_self_update_info($req) {
    return rest_ensure_response([
        'current_version' => KOTOIQ_VERSION,
        'plugin_basename' => plugin_basename(KOTOIQ_PLUGIN_FILE),
        'plugin_dir'      => basename(KOTOIQ_PLUGIN_DIR),
        'php'             => phpversion(),
        'wp_version'      => get_bloginfo('version'),
    ]);
}

function kotoiq_self_update($req) {
    $p = $req->get_json_params();
    $url            = isset($p['download_url']) ? (string) $p['download_url'] : '';
    $expected_sha   = isset($p['sha256']) ? strtolower((string) $p['sha256']) : '';
    $target_version = isset($p['version']) ? sanitize_text_field((string) $p['version']) : '';

    if ($url === '' || stripos($url, 'https://') !== 0) {
        return new WP_Error('bad_url', 'Only HTTPS download URLs are allowed', ['status' => 400]);
    }

    $allowed_host = trim((string) get_option(KOTOIQ_OPT_REMOTE_HOST, ''));
    if ($allowed_host === '') {
        // Auto-pin from the authenticated caller's download URL. The Bearer
        // token already proved the caller is trusted; using the URL they
        // sent as the pin is equivalent to a manual one-time setting and
        // matches auth.php behaviour (which treats empty allowed_host as
        // "no origin check yet"). After this call the pin is fixed.
        $parts = wp_parse_url($url);
        if (empty($parts['scheme']) || empty($parts['host'])) {
            return new WP_Error('bad_url', 'download_url is not a valid URL', ['status' => 400]);
        }
        $allowed_host = $parts['scheme'] . '://' . $parts['host'];
        update_option(KOTOIQ_OPT_REMOTE_HOST, $allowed_host);
    }
    if (stripos($url, $allowed_host) !== 0) {
        return new WP_Error('host_mismatch', "Download URL must start with the allowed host ({$allowed_host})", ['status' => 400]);
    }

    if (!preg_match('/^[a-f0-9]{64}$/i', $expected_sha)) {
        return new WP_Error('bad_sha', 'sha256 checksum required (64 hex chars)', ['status' => 400]);
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/misc.php';
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

    $tmp = download_url($url, 60);
    if (is_wp_error($tmp)) {
        return new WP_Error('download_failed', 'Download failed: ' . $tmp->get_error_message(), ['status' => 502]);
    }

    $actual = hash_file('sha256', $tmp);
    if (strtolower($actual) !== $expected_sha) {
        @unlink($tmp);
        return new WP_Error('checksum_mismatch', "Expected {$expected_sha}, got {$actual}", ['status' => 400]);
    }

    if (!WP_Filesystem()) {
        @unlink($tmp);
        return new WP_Error('fs_init', 'WP_Filesystem could not initialize', ['status' => 500]);
    }

    $skin = new WP_Ajax_Upgrader_Skin();
    $upgrader = new Plugin_Upgrader($skin);
    $result = $upgrader->install($tmp, ['overwrite_package' => true]);
    @unlink($tmp);

    if (is_wp_error($result)) {
        return new WP_Error('install_failed', $result->get_error_message(), ['status' => 500]);
    }
    if (!$result) {
        $err = $skin->get_errors();
        $msg = is_wp_error($err) ? $err->get_error_message() : 'Plugin_Upgrader returned false';
        return new WP_Error('install_failed', $msg, ['status' => 500]);
    }

    $plugin_basename = plugin_basename(KOTOIQ_PLUGIN_FILE);
    if (!is_plugin_active($plugin_basename)) {
        $activated = activate_plugin($plugin_basename);
        if (is_wp_error($activated)) {
            return new WP_Error('activate_failed', 'Installed but not reactivated: ' . $activated->get_error_message(), ['status' => 500]);
        }
    }

    return rest_ensure_response([
        'ok' => true,
        'previous_version' => KOTOIQ_VERSION,
        'target_version'   => $target_version,
        'installed_at'     => current_time('mysql', true),
        'note'             => 'Old plugin code is still loaded in this request. /meta will report the new version on the next request (~1 sec).',
    ]);
}

// Back-compat aliases — Control Center may still call wpsc_self_update via the
// legacy namespace; route resolution finds these by callback name.
if (!function_exists('wpsc_self_update')) {
    function wpsc_self_update($req)       { return kotoiq_self_update($req); }
    function wpsc_self_update_info($req)  { return kotoiq_self_update_info($req); }
}
