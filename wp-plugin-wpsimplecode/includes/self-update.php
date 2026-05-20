<?php
/**
 * Self-update — accepts an authenticated update request, downloads the
 * checksum-verified zip from the agency host, runs WP's Plugin_Upgrader to
 * install it.
 *
 * Trust model (same as WordPress.org's auto-updater):
 *   • Channel auth: existing wpsc_perm_write (remote_allowed + Bearer token
 *     + matching allowed_host).
 *   • Host pin: download_url must start with WPSC_OPT_REMOTE_HOST so the
 *     plugin can't be tricked into downloading from anywhere else.
 *   • Integrity: sha256 of the downloaded file must match the value
 *     supplied in the request.
 *
 * Same caveat as every plugin auto-updater: a compromised update server
 * means compromised plugins on every paired site. The opt-in remote flag
 * keeps this attack surface to sites that explicitly enabled it.
 *
 * @package WPSimpleCode
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route(WPSC_REST_NS, '/self-update', [
        'methods'  => 'POST',
        'callback' => 'wpsc_self_update',
        'permission_callback' => 'wpsc_perm_write',
    ]);
    register_rest_route(WPSC_REST_NS, '/self-update/info', [
        'methods'  => 'POST',
        'callback' => 'wpsc_self_update_info',
        'permission_callback' => 'wpsc_perm_read',
    ]);
});

function wpsc_self_update_info($req) {
    return rest_ensure_response([
        'current_version' => WPSC_VERSION,
        'plugin_basename' => plugin_basename(WPSC_PLUGIN_FILE),
        'plugin_dir'      => basename(WPSC_PLUGIN_DIR),
        'php'             => phpversion(),
        'wp_version'      => get_bloginfo('version'),
    ]);
}

function wpsc_self_update($req) {
    $p = $req->get_json_params();
    $url            = isset($p['download_url']) ? (string) $p['download_url'] : '';
    $expected_sha   = isset($p['sha256']) ? strtolower((string) $p['sha256']) : '';
    $target_version = isset($p['version']) ? sanitize_text_field((string) $p['version']) : '';

    // URL must be HTTPS
    if ($url === '' || stripos($url, 'https://') !== 0) {
        return new WP_Error('bad_url', 'Only HTTPS download URLs are allowed', ['status' => 400]);
    }

    // URL must match the allowed host configured in Settings — this is the
    // anti-redirect guard. If the user hasn't pinned an allowed host, we
    // refuse self-update on principle (can't verify the source).
    $allowed_host = trim((string) get_option(WPSC_OPT_REMOTE_HOST, ''));
    if ($allowed_host === '') {
        return new WP_Error('no_allowed_host', 'Self-update requires an Allowed host configured in WPSimpleCode → Settings', ['status' => 400]);
    }
    if (stripos($url, $allowed_host) !== 0) {
        return new WP_Error('host_mismatch', "Download URL must start with the allowed host ({$allowed_host})", ['status' => 400]);
    }

    // Checksum must be a hex-64 sha256
    if (!preg_match('/^[a-f0-9]{64}$/i', $expected_sha)) {
        return new WP_Error('bad_sha', 'sha256 checksum required (64 hex chars)', ['status' => 400]);
    }

    // Load the WP upgrader stack — these classes aren't loaded by default
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/misc.php';
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

    // Download the zip to a temp file
    $tmp = download_url($url, 60);
    if (is_wp_error($tmp)) {
        return new WP_Error('download_failed', 'Download failed: ' . $tmp->get_error_message(), ['status' => 502]);
    }

    // Verify checksum
    $actual = hash_file('sha256', $tmp);
    if (strtolower($actual) !== $expected_sha) {
        @unlink($tmp);
        return new WP_Error('checksum_mismatch', "Expected {$expected_sha}, got {$actual}", ['status' => 400]);
    }

    // Initialize WP_Filesystem
    if (!WP_Filesystem()) {
        @unlink($tmp);
        return new WP_Error('fs_init', 'WP_Filesystem could not initialize', ['status' => 500]);
    }

    // Run the upgrade with overwrite_package=true so it replaces the existing folder
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

    // Reactivate the plugin (overwrite_package may have left it deactivated)
    $plugin_basename = plugin_basename(WPSC_PLUGIN_FILE);
    if (!is_plugin_active($plugin_basename)) {
        $activated = activate_plugin($plugin_basename);
        if (is_wp_error($activated)) {
            return new WP_Error('activate_failed', 'Installed but not reactivated: ' . $activated->get_error_message(), ['status' => 500]);
        }
    }

    // Note: this request is still executing on the OLD plugin code in memory.
    // The next request will load the new code. /meta will report the new
    // version then.
    return rest_ensure_response([
        'ok' => true,
        'previous_version' => WPSC_VERSION,
        'target_version'   => $target_version,
        'installed_at'     => current_time('mysql', true),
        'note'             => 'Old plugin code is still loaded in this request. /meta will report the new version on the next request (~1 sec).',
    ]);
}
