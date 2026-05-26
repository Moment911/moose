<?php
/**
 * Self-update — accepts an authenticated update request, downloads the
 * checksum-verified zip, runs WP's Plugin_Upgrader to install it.
 *
 * Trust model:
 *   • Channel auth: kotoiq_perm_write (remote_allowed + Bearer token)
 *   • Integrity: sha256 of the downloaded file must match the value
 *     supplied in the request.
 *
 * No host pin. The Bearer token is the trust boundary; whoever holds it
 * can issue updates. Sites disable remote control to revoke.
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
});

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
