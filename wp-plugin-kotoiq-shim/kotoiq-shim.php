<?php
/**
 * Plugin Name:       KotoIQ
 * Plugin URI:        https://www.unifiedmktg.com
 * Description:       Connect this WordPress site to your KotoIQ dashboard. Managed by Unified Marketing.
 * Version:           4.1.0
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
define('KOTOIQ_SHIM_VERSION',      '4.1.0');
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

// Admin UI — operations-only page (pairing-window toggle + pair status).
// Loaded on every request because admin_menu + admin_post hooks must register
// during normal WP boot, not just when the page renders.
if (is_admin()) {
    require_once KOTOIQ_SHIM_DIR . 'includes/admin-page.php';
}

// Verb handler groups (registered in the order they appear in verb-table.php).
// events.php is required FIRST so the emit helper is defined before any
// other handler tries to call it for audit logging.
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-events.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-health.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-meta.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-option.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-file.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-taxonomy.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-plugin.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-cron.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-query.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-database.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-transient.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-capability.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-elementor.php';
// webhook-emitter.php defines the allowed-events constant the verb handler reads
// at validation time, so it must load before verbs-webhook.php.
require_once KOTOIQ_SHIM_DIR . 'runtime/webhook-emitter.php';
require_once KOTOIQ_SHIM_DIR . 'includes/rpc/verbs-webhook.php';

// Schema injection — registers per-post JSON-LD meta + wp_head echo.
// Keeps schema OUT of post content (KSES would strip <script>) and lets the
// dashboard write to it via /wp/v2/{pages,posts} meta:{...} since the key
// is registered with show_in_rest:true.
require_once KOTOIQ_SHIM_DIR . 'includes/schema-injection.php';

// Runtime hooks (installed on every request — not behind RPC).
require_once KOTOIQ_SHIM_DIR . 'runtime/access-filter.php';
require_once KOTOIQ_SHIM_DIR . 'runtime/snippets.php';
require_once KOTOIQ_SHIM_DIR . 'shortcodes/koto-rotate.php';
require_once KOTOIQ_SHIM_DIR . 'includes/sitemap-server.php';

// ─── Activation ────────────────────────────────────────────────────────────
register_activation_hook(__FILE__, function () {
    // Defaults: pairing window closed, no features pre-enabled.
    if (get_option(KOTOIQ_SHIM_OPT_PAIRING_READY, null) === null) {
        update_option(KOTOIQ_SHIM_OPT_PAIRING_READY, 0);
    }
    if (get_option(KOTOIQ_SHIM_OPT_FEATURES_ENABLED, null) === null) {
        update_option(KOTOIQ_SHIM_OPT_FEATURES_ENABLED, []);
    }
    // Notify rewrite-rule owners (sitemap-server.php) so they can flush.
    do_action('kotoiq_shim_activate');
    // koto_service user + kotoiq_service role are created at pair time
    // (per D-Pairing-user USER-LOCKED), NOT at activation.
});

register_deactivation_hook(__FILE__, function () {
    do_action('kotoiq_shim_deactivate');
});

// ─── i18n ──────────────────────────────────────────────────────────────────
add_action('init', function () {
    load_plugin_textdomain('kotoiq-shim', false, dirname(plugin_basename(__FILE__)) . '/languages');
});

// NOTE: this plugin INTENTIONALLY does NOT expose a public unauthenticated
// /meta endpoint. Its presence is invisible to anyone without a valid signed
// envelope. The v3.x /meta endpoint leaked plugin/module info to anyone who
// could hit /wp-json — v4 closes that hole.
