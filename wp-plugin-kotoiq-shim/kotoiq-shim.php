<?php
/**
 * Plugin Name:       KotoIQ Shim
 * Plugin URI:        https://hellokoto.com
 * Description:       Generic WordPress RPC shim. Authenticated verb dispatcher for the KotoIQ dashboard. No business logic.
 * Version:           4.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Tested up to:      6.6
 * Author:            Koto
 * Author URI:        https://hellokoto.com
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       kotoiq-shim
 * Domain Path:       /languages
 *
 * Distribution: self-hosted ONLY. Not for the WordPress.org plugin directory.
 *
 * @package KotoIQShim
 */

if (!defined('ABSPATH')) exit;

// ─── Plugin constants ──────────────────────────────────────────────────────
define('KOTOIQ_SHIM_VERSION',      '4.0.0');
define('KOTOIQ_SHIM_PLUGIN_FILE',  __FILE__);
define('KOTOIQ_SHIM_DIR',          plugin_dir_path(__FILE__));
define('KOTOIQ_SHIM_URL',          plugin_dir_url(__FILE__));
define('KOTOIQ_SHIM_REST_NS',      'kotoiq-shim/v1');

// ─── Option keys ───────────────────────────────────────────────────────────
// All keys are namespaced under kotoiq_shim_*. The shim NEVER touches the
// legacy wpsc_* / kotoiq_* options owned by the v3.x plugin (side-by-side
// install — v3 rollback path must stay intact).
define('KOTOIQ_SHIM_OPT_PUBKEY',           'kotoiq_shim_pubkey');           // base64(raw 32-byte Ed25519 pubkey)
define('KOTOIQ_SHIM_OPT_PAIRING_READY',    'kotoiq_shim_pairing_ready');    // unix ts; 0 = closed
define('KOTOIQ_SHIM_OPT_DASHBOARD_URL',    'kotoiq_shim_dashboard_url');    // https://... where pair callback came from
define('KOTOIQ_SHIM_OPT_FEATURES_ENABLED', 'kotoiq_shim_features_enabled'); // per-verb feature flags
define('KOTOIQ_SHIM_OPT_LEGACY_BEARER',    'kotoiq_shim_legacy_bearer');    // optional cutover fallback secret

// ─── Module includes ───────────────────────────────────────────────────────
require_once KOTOIQ_SHIM_DIR . 'includes/auth.php';
require_once KOTOIQ_SHIM_DIR . 'includes/pairing.php';
require_once KOTOIQ_SHIM_DIR . 'includes/self-update.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/dispatcher.php';

// ─── Activation ────────────────────────────────────────────────────────────
register_activation_hook(__FILE__, function () {
    // Defaults: pairing window closed, no features pre-enabled.
    if (get_option(KOTOIQ_SHIM_OPT_PAIRING_READY, null) === null) {
        update_option(KOTOIQ_SHIM_OPT_PAIRING_READY, 0);
    }
    if (get_option(KOTOIQ_SHIM_OPT_FEATURES_ENABLED, null) === null) {
        update_option(KOTOIQ_SHIM_OPT_FEATURES_ENABLED, []);
    }
    // koto_service user + kotoiq_service role are created at pair time
    // (per D-Pairing-user USER-LOCKED), NOT at activation.
});

// ─── i18n ──────────────────────────────────────────────────────────────────
add_action('init', function () {
    load_plugin_textdomain('kotoiq-shim', false, dirname(plugin_basename(__FILE__)) . '/languages');
});

// NOTE: this plugin INTENTIONALLY does NOT expose a public unauthenticated
// /meta endpoint. Its presence is invisible to anyone without a valid signed
// envelope. The v3.x /meta endpoint leaked plugin/module info to anyone who
// could hit /wp-json — v4 closes that hole.
