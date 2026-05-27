<?php
/**
 * Pairing + kill switch.
 *
 * Pairing model (v4):
 *   1. Site owner enables "Ready to pair" → sets KOTOIQ_SHIM_OPT_PAIRING_READY
 *      to time()+TTL (Plan 11 ships the admin UI; for now the option is
 *      toggled via wp-cli: `wp option update kotoiq_shim_pairing_ready
 *      $(( $(date +%s) + 600 ))`).
 *   2. Dashboard POSTs {dashboard_pubkey, dashboard_url} to /pair.
 *   3. Plugin creates kotoiq_service role (if missing), creates or reuses
 *      the koto_service WP user with that role, issues an Application
 *      Password scoped to that user named "kotoiq-shim-rpc", stores the
 *      pubkey, and returns {app_password, fingerprint, ...} to the dashboard.
 *   4. Dashboard encrypts the app_password at storage with the agency KEK.
 *
 * Drive-by-hijack guard mirrors v3 pairing.php: 10-min window + manual
 * toggle + once-paired-cannot-re-pair-without-destruct.
 *
 * Per D-Pairing-user (USER-LOCKED): a DEDICATED koto_service user holds
 * the App Password. The role grants content-editing caps only — no
 * site-config, plugin-install, theme-edit, or user-management caps.
 * Defense in depth if the App Password leaks.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

const KOTOIQ_SHIM_PAIRING_READY_TTL    = 600;            // 10 minutes
const KOTOIQ_SHIM_SERVICE_USER_LOGIN   = 'koto_service'; // user_login
const KOTOIQ_SHIM_SERVICE_ROLE         = 'kotoiq_service';
const KOTOIQ_SHIM_APP_PASSWORD_NAME    = 'kotoiq-shim-rpc';

add_action('rest_api_init', function () {
    register_rest_route(KOTOIQ_SHIM_REST_NS, '/meta', [
        'methods'             => 'GET',
        'callback'            => 'kotoiq_shim_meta',
        'permission_callback' => '__return_true', // public — discovery endpoint
    ]);
    register_rest_route(KOTOIQ_SHIM_REST_NS, '/pair', [
        'methods'             => 'POST',
        'callback'            => 'kotoiq_shim_pair',
        'permission_callback' => '__return_true', // drive-by guard is inside
    ]);
    register_rest_route(KOTOIQ_SHIM_REST_NS, '/destruct', [
        'methods'             => 'POST',
        'callback'            => 'kotoiq_shim_destruct',
        'permission_callback' => 'kotoiq_shim_auth_check',
    ]);
});

/**
 * Public discovery endpoint. Returns version + WP/PHP info + pairing state.
 * No auth required — operators + dashboards use this to confirm the plugin
 * is installed and to read the pairing window status.
 *
 * Reveals nothing proprietary: just the same data the WP admin page shows.
 */
function kotoiq_shim_meta() {
    $is_paired = (string) get_option(KOTOIQ_SHIM_OPT_PUBKEY, '') !== '';
    $ready_until = (int) get_option(KOTOIQ_SHIM_OPT_PAIRING_READY, 0);
    $window_open = $ready_until > time();
    return rest_ensure_response([
        'plugin'              => 'kotoiq-shim',
        'version'             => defined('KOTOIQ_SHIM_VERSION') ? KOTOIQ_SHIM_VERSION : null,
        'wp_version'          => get_bloginfo('version'),
        'php_version'         => PHP_VERSION,
        'paired'              => $is_paired,
        'pairing_window_open' => $window_open,
        'pairing_window_remaining_seconds' => $window_open ? ($ready_until - time()) : 0,
    ]);
}

/**
 * Pair endpoint — unauthenticated by REST framework, gated internally by
 * the pairing window + first-pair-wins.
 */
function kotoiq_shim_pair($req) {
    $p = $req->get_json_params();
    if (!is_array($p)) {
        return new WP_Error('bad_request', 'JSON body required', ['status' => 400]);
    }

    $pubkey_input  = isset($p['dashboard_pubkey']) ? trim((string) $p['dashboard_pubkey']) : '';
    $dashboard_url = isset($p['dashboard_url'])    ? trim((string) $p['dashboard_url'])    : '';

    if ($pubkey_input === '') {
        return new WP_Error('bad_request', 'dashboard_pubkey required', ['status' => 400]);
    }

    // Drive-by-hijack guard ----------------------------------------------------
    $existing = (string) get_option(KOTOIQ_SHIM_OPT_PUBKEY, '');
    if ($existing !== '') {
        return new WP_Error(
            'already_paired',
            'Site is already paired. Run /destruct to unpair before re-pairing.',
            ['status' => 409]
        );
    }
    $ready_until = (int) get_option(KOTOIQ_SHIM_OPT_PAIRING_READY, 0);
    if ($ready_until === 0) {
        return new WP_Error(
            'not_ready',
            'Site is not ready to pair. Enable "Ready to pair" in WP admin → KotoIQ Shim → Settings.',
            ['status' => 403]
        );
    }
    if ($ready_until < time()) {
        delete_option(KOTOIQ_SHIM_OPT_PAIRING_READY);
        return new WP_Error('pairing_expired', 'Pairing window expired.', ['status' => 403]);
    }

    // Decode the pubkey to raw 32 bytes ---------------------------------------
    // Accept base64 of raw 32 bytes (~44 chars). PEM-wrapped keys are NOT
    // accepted — the dashboard MUST extract the raw bytes before sending.
    $raw_pubkey = base64_decode($pubkey_input, true);
    if ($raw_pubkey === false || strlen($raw_pubkey) !== 32) {
        return new WP_Error(
            'bad_pubkey',
            'dashboard_pubkey must be base64(raw 32-byte Ed25519 pubkey)',
            ['status' => 400]
        );
    }

    // Create custom role if missing -------------------------------------------
    if (!get_role(KOTOIQ_SHIM_SERVICE_ROLE)) {
        add_role(KOTOIQ_SHIM_SERVICE_ROLE, 'KotoIQ Service', [
            'read'                 => true,
            'edit_posts'           => true,
            'edit_pages'           => true,
            'edit_others_posts'    => true,
            'edit_others_pages'    => true,
            'edit_published_posts' => true,
            'edit_published_pages' => true,
            'publish_posts'        => true,
            'publish_pages'        => true,
            'upload_files'         => true,
            'manage_categories'    => true,
            // NOTE: explicitly NO site-config, plugin-install, theme-edit,
            // or user-management caps. The service role can edit content
            // and meta but cannot reconfigure the site.
        ]);
    }

    // Create or reuse the koto_service user -----------------------------------
    $user = get_user_by('login', KOTOIQ_SHIM_SERVICE_USER_LOGIN);
    if (!$user) {
        $blog_id = function_exists('get_current_blog_id') ? get_current_blog_id() : 1;
        $user_id = wp_insert_user([
            'user_login'   => KOTOIQ_SHIM_SERVICE_USER_LOGIN,
            'user_pass'    => wp_generate_password(32, true, true),
            'user_email'   => 'koto-service+' . $blog_id . '@local.invalid',
            'role'         => KOTOIQ_SHIM_SERVICE_ROLE,
            'display_name' => 'KotoIQ Platform',
        ]);
        if (is_wp_error($user_id)) {
            return new WP_Error('user_create_failed', $user_id->get_error_message(), ['status' => 500]);
        }
        $user = get_user_by('id', $user_id);
    } else {
        // Existing user — add the service role if not already present.
        // Preserves any other roles the v3 setup may have assigned.
        if (!in_array(KOTOIQ_SHIM_SERVICE_ROLE, (array) $user->roles, true)) {
            $user->add_role(KOTOIQ_SHIM_SERVICE_ROLE);
        }
    }

    if (!$user || !($user instanceof WP_User)) {
        return new WP_Error('user_lookup_failed', 'Could not resolve service user', ['status' => 500]);
    }

    // Issue an Application Password -------------------------------------------
    if (!class_exists('WP_Application_Passwords')) {
        return new WP_Error(
            'app_passwords_unavailable',
            'WP_Application_Passwords class missing — requires WordPress 5.6+',
            ['status' => 503]
        );
    }
    if (function_exists('wp_is_application_passwords_available_for_user')
        && !wp_is_application_passwords_available_for_user($user)) {
        return new WP_Error(
            'app_passwords_disabled',
            'Application Passwords are disabled for the service user — re-enable in your security plugin',
            ['status' => 503]
        );
    }

    $created = WP_Application_Passwords::create_new_application_password(
        $user->ID,
        ['name' => KOTOIQ_SHIM_APP_PASSWORD_NAME, 'app_id' => '']
    );
    if (is_wp_error($created)) {
        return new WP_Error('app_password_create_failed', $created->get_error_message(), ['status' => 500]);
    }
    $app_password = is_array($created) && isset($created[0]) ? (string) $created[0] : '';
    if ($app_password === '') {
        return new WP_Error('app_password_create_failed', 'Empty App Password returned', ['status' => 500]);
    }

    // Persist pubkey + dashboard_url and close the pairing window -------------
    update_option(KOTOIQ_SHIM_OPT_PUBKEY, base64_encode($raw_pubkey));
    if ($dashboard_url !== '' && stripos($dashboard_url, 'https://') === 0) {
        update_option(KOTOIQ_SHIM_OPT_DASHBOARD_URL, $dashboard_url);
    }
    delete_option(KOTOIQ_SHIM_OPT_PAIRING_READY);

    return rest_ensure_response([
        'ok'                    => true,
        'plugin'                => 'kotoiq-shim',
        'version'               => KOTOIQ_SHIM_VERSION,
        'site_url'              => get_site_url(),
        'site_name'             => get_bloginfo('name'),
        'fingerprint'           => hash('sha256', $raw_pubkey),
        'app_password_username' => KOTOIQ_SHIM_SERVICE_USER_LOGIN,
        'app_password'          => $app_password,
        'wp_version'            => get_bloginfo('version'),
        'php_version'           => phpversion(),
    ]);
}

/**
 * Destruct — clears pairing state. Requires a signed envelope.
 * Optional args.deactivate=true defers plugin deactivation by 1 second.
 */
function kotoiq_shim_destruct($req) {
    $payload = $req->get_param('_verified_payload');
    $args = is_array($payload) && isset($payload['args']) && is_array($payload['args'])
        ? $payload['args']
        : [];
    $deactivate = !empty($args['deactivate']);

    // Clear shim options. KOTOIQ_SHIM_OPT_LEGACY_BEARER is intentionally
    // left intact in case Plan 11 cutover seeded it.
    delete_option(KOTOIQ_SHIM_OPT_PUBKEY);
    delete_option(KOTOIQ_SHIM_OPT_PAIRING_READY);
    delete_option(KOTOIQ_SHIM_OPT_DASHBOARD_URL);
    delete_option(KOTOIQ_SHIM_OPT_FEATURES_ENABLED);

    // Revoke the App Password named "kotoiq-shim-rpc" on the service user.
    $user = get_user_by('login', KOTOIQ_SHIM_SERVICE_USER_LOGIN);
    if ($user && class_exists('WP_Application_Passwords')) {
        $items = WP_Application_Passwords::get_user_application_passwords($user->ID);
        if (is_array($items)) {
            foreach ($items as $item) {
                if (isset($item['name'], $item['uuid']) && $item['name'] === KOTOIQ_SHIM_APP_PASSWORD_NAME) {
                    WP_Application_Passwords::delete_application_password($user->ID, $item['uuid']);
                }
            }
        }
    }

    if ($deactivate) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        $basename = plugin_basename(KOTOIQ_SHIM_PLUGIN_FILE);
        wp_schedule_single_event(time() + 1, 'kotoiq_shim_deferred_deactivate', [$basename]);
        return rest_ensure_response([
            'ok'         => true,
            'key_cleared'=> true,
            'deactivate' => 'scheduled',
            'note'       => 'Pairing cleared. Plugin will deactivate within ~1 second.',
        ]);
    }

    return rest_ensure_response([
        'ok'          => true,
        'key_cleared' => true,
        'deactivate'  => false,
    ]);
}

add_action('kotoiq_shim_deferred_deactivate', function ($basename) {
    if (!function_exists('deactivate_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }
    deactivate_plugins($basename, true);
});

// ─── Pairing-window helpers (called by Plan 11 admin UI / wp-cli) ──────────
function kotoiq_shim_open_pairing_window() {
    update_option(KOTOIQ_SHIM_OPT_PAIRING_READY, time() + KOTOIQ_SHIM_PAIRING_READY_TTL);
}
function kotoiq_shim_close_pairing_window() {
    delete_option(KOTOIQ_SHIM_OPT_PAIRING_READY);
}
function kotoiq_shim_pairing_window_remaining() {
    $until = (int) get_option(KOTOIQ_SHIM_OPT_PAIRING_READY, 0);
    if ($until === 0) return 0;
    $remaining = $until - time();
    return $remaining > 0 ? $remaining : 0;
}
