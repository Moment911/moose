<?php
/**
 * Plugin Name:       KotoIQ
 * Plugin URI:        https://hellokoto.com/kotoiq
 * Description:       All-in-one agency SEO & site management plugin. Built-in SEO engine (replaces Yoast/Rank Math), real-time sync with KotoIQ platform, search & replace, code snippets, role-based access, Elementor builder, and content rotation. One plugin per site.
 * Version:           3.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Tested up to:      6.6
 * Author:            Koto
 * Author URI:        https://hellokoto.com
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       kotoiq
 * Domain Path:       /languages
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

define('KOTOIQ_VERSION', '3.0.0');
define('KOTOIQ_PLUGIN_FILE', __FILE__);
define('KOTOIQ_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('KOTOIQ_PLUGIN_URL', plugin_dir_url(__FILE__));

// Primary REST namespace. Every endpoint also registers under the
// wpsimplecode/v1 namespace below so the existing KotoIQ Control Center
// proxy keeps working without changes.
define('KOTOIQ_REST_NS', 'kotoiq/v1');
define('KOTOIQ_REST_NS_LEGACY', 'wpsimplecode/v1');

// Option keys are intentionally kept on the wpsc_ prefix so a site that
// upgrades from WPSimpleCode 1.2.0 → KotoIQ 1.0.0 picks up its existing
// API key, allowed host, snippets, and access policy without re-pairing.
define('KOTOIQ_OPT_API_KEY',          'wpsc_api_key');
define('KOTOIQ_OPT_REMOTE_ALLOWED',   'wpsc_remote_allowed');
define('KOTOIQ_OPT_REMOTE_HOST',      'wpsc_remote_host');
define('KOTOIQ_OPT_ACCESS_POLICY',    'wpsc_access_policy');
define('KOTOIQ_OPT_DISABLE_FILE_EDIT','wpsc_disable_file_edit_global');
define('KOTOIQ_OPT_SNIPPETS',         'wpsc_snippets');

// Back-compat aliases — old WPSC_* constant names. Lets us paste-port
// module bodies verbatim during the migration; remove once every module
// is rewritten to KOTOIQ_* and the WPSimpleCode plugin is retired.
if (!defined('WPSC_VERSION'))            define('WPSC_VERSION',            KOTOIQ_VERSION);
if (!defined('WPSC_PLUGIN_FILE'))        define('WPSC_PLUGIN_FILE',        KOTOIQ_PLUGIN_FILE);
if (!defined('WPSC_PLUGIN_DIR'))         define('WPSC_PLUGIN_DIR',         KOTOIQ_PLUGIN_DIR);
if (!defined('WPSC_PLUGIN_URL'))         define('WPSC_PLUGIN_URL',         KOTOIQ_PLUGIN_URL);
if (!defined('WPSC_REST_NS'))            define('WPSC_REST_NS',            KOTOIQ_REST_NS_LEGACY);
if (!defined('WPSC_OPT_API_KEY'))        define('WPSC_OPT_API_KEY',        KOTOIQ_OPT_API_KEY);
if (!defined('WPSC_OPT_REMOTE_ALLOWED')) define('WPSC_OPT_REMOTE_ALLOWED', KOTOIQ_OPT_REMOTE_ALLOWED);
if (!defined('WPSC_OPT_REMOTE_HOST'))    define('WPSC_OPT_REMOTE_HOST',    KOTOIQ_OPT_REMOTE_HOST);
if (!defined('WPSC_OPT_ACCESS_POLICY'))  define('WPSC_OPT_ACCESS_POLICY',  KOTOIQ_OPT_ACCESS_POLICY);
if (!defined('WPSC_OPT_DISABLE_FILE_EDIT')) define('WPSC_OPT_DISABLE_FILE_EDIT', KOTOIQ_OPT_DISABLE_FILE_EDIT);
if (!defined('WPSC_OPT_SNIPPETS'))       define('WPSC_OPT_SNIPPETS',       KOTOIQ_OPT_SNIPPETS);

require_once KOTOIQ_PLUGIN_DIR . 'includes/auth.php';
require_once KOTOIQ_PLUGIN_DIR . 'includes/module-loader.php';
require_once KOTOIQ_PLUGIN_DIR . 'includes/self-update.php';
require_once KOTOIQ_PLUGIN_DIR . 'includes/modules/search-replace.php';
require_once KOTOIQ_PLUGIN_DIR . 'includes/modules/snippets.php';
require_once KOTOIQ_PLUGIN_DIR . 'includes/modules/access.php';
require_once KOTOIQ_PLUGIN_DIR . 'includes/modules/elementor-builder.php';
require_once KOTOIQ_PLUGIN_DIR . 'includes/modules/content-rotation.php';
require_once KOTOIQ_PLUGIN_DIR . 'includes/modules/seo.php';
require_once KOTOIQ_PLUGIN_DIR . 'includes/admin.php';

register_activation_hook(__FILE__, function () {
    if (!get_option(KOTOIQ_OPT_API_KEY)) {
        update_option(KOTOIQ_OPT_API_KEY, wp_generate_password(40, false, false));
    }
    if (get_option(KOTOIQ_OPT_REMOTE_ALLOWED, null) === null) {
        update_option(KOTOIQ_OPT_REMOTE_ALLOWED, false);
    }
});

// Public meta endpoint (no auth) — lets Control Center detect the plugin
// + read its version + module list. Registered under BOTH namespaces so
// existing /wp-json/wpsimplecode/v1/meta callers keep working.
add_action('rest_api_init', function () {
    $meta_route = [
        'methods'  => 'GET',
        'callback' => function () {
            $modules = function_exists('koto_modules_list') ? koto_modules_list() : [];
            return rest_ensure_response([
                'name'           => 'KotoIQ',
                'version'        => KOTOIQ_VERSION,
                'plugin'         => 'kotoiq',
                'wp_version'     => get_bloginfo('version'),
                'php'            => phpversion(),
                'modules'        => $modules,
                'remote_allowed' => (bool) get_option(KOTOIQ_OPT_REMOTE_ALLOWED, false),
            ]);
        },
        'permission_callback' => '__return_true',
    ];
    register_rest_route(KOTOIQ_REST_NS,        '/meta', $meta_route);
    register_rest_route(KOTOIQ_REST_NS_LEGACY, '/meta', $meta_route);

    $disable_route = [
        'methods'  => 'POST',
        'callback' => function () {
            update_option(KOTOIQ_OPT_REMOTE_ALLOWED, false);
            return rest_ensure_response(['ok' => true, 'remote_allowed' => false]);
        },
        'permission_callback' => 'kotoiq_perm_write',
    ];
    register_rest_route(KOTOIQ_REST_NS,        '/disable-remote', $disable_route);
    register_rest_route(KOTOIQ_REST_NS_LEGACY, '/disable-remote', $disable_route);
});

add_action('init', function () {
    load_plugin_textdomain('kotoiq', false, dirname(plugin_basename(__FILE__)) . '/languages');
});
