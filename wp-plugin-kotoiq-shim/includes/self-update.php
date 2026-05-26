<?php
/**
 * Self-update — accepts a signed-envelope update request, downloads the
 * checksum-verified zip, runs WP's Plugin_Upgrader to install it.
 *
 * Trust model (v4):
 *   • Channel auth: signed Ed25519 envelope (kotoiq_shim_auth_check) —
 *     the same trust gate as /rpc. No Bearer.
 *   • Integrity: sha256 of the downloaded file MUST match what the
 *     dashboard claimed in the signed payload.
 *
 * Differences from v3:
 *   • Routes registered only under kotoiq-shim/v1 (v3 channels untouched).
 *   • Args come from the verified payload, not raw body.
 *   • No public unauthenticated info endpoint — info is part of health.diagnostics.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route(KOTOIQ_SHIM_REST_NS, '/self-update', [
        'methods'             => 'POST',
        'callback'            => 'kotoiq_shim_self_update',
        'permission_callback' => 'kotoiq_shim_auth_check',
    ]);
    register_rest_route(KOTOIQ_SHIM_REST_NS, '/self-update/info', [
        'methods'             => 'POST',
        'callback'            => 'kotoiq_shim_self_update_info',
        'permission_callback' => 'kotoiq_shim_auth_check',
    ]);
});

function kotoiq_shim_self_update_info($req) {
    return rest_ensure_response([
        'current_version' => KOTOIQ_SHIM_VERSION,
        'plugin_basename' => plugin_basename(KOTOIQ_SHIM_PLUGIN_FILE),
        'plugin_dir'      => basename(KOTOIQ_SHIM_DIR),
        'php'             => phpversion(),
        'wp_version'      => get_bloginfo('version'),
    ]);
}

function kotoiq_shim_self_update($req) {
    $payload = $req->get_param('_verified_payload');
    $args = is_array($payload) && isset($payload['args']) && is_array($payload['args'])
        ? $payload['args']
        : [];

    $url            = isset($args['download_url']) ? (string) $args['download_url'] : '';
    $expected_sha   = isset($args['sha256']) ? strtolower((string) $args['sha256']) : '';
    $target_version = isset($args['version']) ? sanitize_text_field((string) $args['version']) : '';

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
    // overwrite_package=true is correct here: we're upgrading the shim
    // in place at its own folder. The side-by-side guarantee is relative
    // to the legacy v3 plugin folder, not relative to past v4 builds.
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

    $plugin_basename = plugin_basename(KOTOIQ_SHIM_PLUGIN_FILE);
    if (!is_plugin_active($plugin_basename)) {
        $activated = activate_plugin($plugin_basename);
        if (is_wp_error($activated)) {
            return new WP_Error(
                'activate_failed',
                'Installed but not reactivated: ' . $activated->get_error_message(),
                ['status' => 500]
            );
        }
    }

    return rest_ensure_response([
        'ok'               => true,
        'previous_version' => KOTOIQ_SHIM_VERSION,
        'target_version'   => $target_version,
        'installed_at'     => current_time('mysql', true),
        'note'             => 'Old plugin code is still loaded in this request. health.ping will report the new version on the next request (~1 sec).',
    ]);
}
