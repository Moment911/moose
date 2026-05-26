<?php
/**
 * Pairing + kill switch.
 *
 * Token model: the dashboard generates the API key. The plugin starts
 * with NO key. To pair:
 *
 *   1. Site owner enables "Ready to pair" in WP admin (manage_options).
 *      This sets KOTOIQ_OPT_PAIRING_READY = true with a 10-min expiry.
 *   2. From the dashboard, agency clicks "Pair" on the site. Dashboard
 *      generates a 40-char random key, POSTs to /wp-json/kotoiq/v1/pair
 *      with { api_key, dashboard_url } (NO Bearer required — this is
 *      the bootstrap).
 *   3. Plugin verifies the pairing flag is on and no key is stored yet,
 *      then stores the key and turns the flag OFF.
 *   4. From here on, every dashboard request includes Bearer api_key.
 *
 * Drive-by hijack risk: between pairing-ready-ON and pair-completes, any
 * unauthenticated POST to /pair can claim the site. The 10-min expiry
 * + manual toggle bounds the window. Re-toggling after a successful pair
 * is rejected because the key is already set.
 *
 * Kill switch: POST /destruct (Bearer auth) clears the api_key. With
 * options{deactivate:true} it also deactivates the plugin entirely so
 * a hostile site owner can no longer re-pair without manual reinstall.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

const KOTOIQ_PAIRING_READY_TTL = 600; // 10 minutes

add_action('rest_api_init', function () {
    // Pairing endpoint — NO permission_callback (must work unauthenticated
    // because the plugin has no key yet). Internal checks gate the request.
    register_rest_route(KOTOIQ_REST_NS, '/pair', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_pair',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route(KOTOIQ_REST_NS_LEGACY, '/pair', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_pair',
        'permission_callback' => '__return_true',
    ]);

    kotoiq_register_rest_route('/destruct', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_destruct',
        'permission_callback' => 'kotoiq_perm_write',
    ]);
});

function kotoiq_pair($req) {
    $p = $req->get_json_params();
    $api_key       = isset($p['api_key']) ? trim((string) $p['api_key']) : '';
    $dashboard_url = isset($p['dashboard_url']) ? trim((string) $p['dashboard_url']) : '';

    if (strlen($api_key) < 32) {
        return new WP_Error('bad_key', 'api_key must be at least 32 chars', ['status' => 400]);
    }

    // Drive-by hijack guard: only accept pairing while the owner has
    // explicitly opened the window and no key is stored yet.
    $existing_key = (string) get_option(KOTOIQ_OPT_API_KEY, '');
    if ($existing_key !== '') {
        return new WP_Error('already_paired', 'Site is already paired. Run /destruct to unpair before re-pairing.', ['status' => 409]);
    }
    $ready_until = (int) get_option(KOTOIQ_OPT_PAIRING_READY, 0);
    if ($ready_until === 0) {
        return new WP_Error('not_ready', 'Site is not ready to pair. Enable "Ready to pair" in WP admin → KotoIQ → Settings.', ['status' => 403]);
    }
    if ($ready_until < time()) {
        delete_option(KOTOIQ_OPT_PAIRING_READY);
        return new WP_Error('pairing_expired', 'Pairing window expired. Re-enable "Ready to pair" in WP admin.', ['status' => 403]);
    }

    update_option(KOTOIQ_OPT_API_KEY, $api_key);
    update_option(KOTOIQ_OPT_REMOTE_ALLOWED, true);
    if ($dashboard_url !== '' && stripos($dashboard_url, 'https://') === 0) {
        update_option(KOTOIQ_OPT_DASHBOARD_URL, $dashboard_url);
    }
    delete_option(KOTOIQ_OPT_PAIRING_READY);

    return rest_ensure_response([
        'ok'             => true,
        'plugin'         => 'kotoiq',
        'version'        => KOTOIQ_VERSION,
        'site_url'       => get_site_url(),
        'site_name'      => get_bloginfo('name'),
        'dashboard_url'  => (string) get_option(KOTOIQ_OPT_DASHBOARD_URL, ''),
    ]);
}

function kotoiq_destruct($req) {
    $p = $req->get_json_params();
    $deactivate = !empty($p['deactivate']);

    delete_option(KOTOIQ_OPT_API_KEY);
    update_option(KOTOIQ_OPT_REMOTE_ALLOWED, false);
    delete_option(KOTOIQ_OPT_PAIRING_READY);

    if ($deactivate) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        $basename = plugin_basename(KOTOIQ_PLUGIN_FILE);
        // Schedule deactivation for the next request — deactivating mid-request
        // can confuse the upgrader and the REST response pipeline.
        wp_schedule_single_event(time() + 1, 'kotoiq_deferred_deactivate', [$basename]);
        return rest_ensure_response([
            'ok'              => true,
            'key_cleared'     => true,
            'deactivate'      => 'scheduled',
            'note'            => 'API key cleared. Plugin will deactivate within ~1 second.',
        ]);
    }

    return rest_ensure_response([
        'ok'          => true,
        'key_cleared' => true,
        'deactivate'  => false,
    ]);
}

add_action('kotoiq_deferred_deactivate', function ($basename) {
    if (!function_exists('deactivate_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }
    deactivate_plugins($basename, true);
});

// Toggle helper invoked from the WP admin settings page.
function kotoiq_open_pairing_window() {
    update_option(KOTOIQ_OPT_PAIRING_READY, time() + KOTOIQ_PAIRING_READY_TTL);
}
function kotoiq_close_pairing_window() {
    delete_option(KOTOIQ_OPT_PAIRING_READY);
}
function kotoiq_pairing_window_remaining() {
    $until = (int) get_option(KOTOIQ_OPT_PAIRING_READY, 0);
    if ($until === 0) return 0;
    $remaining = $until - time();
    return $remaining > 0 ? $remaining : 0;
}
