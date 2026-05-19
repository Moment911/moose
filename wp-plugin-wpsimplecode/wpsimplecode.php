<?php
/**
 * Plugin Name:       WPSimpleCode
 * Plugin URI:        https://wpsimplecode.com
 * Description:       Search & replace text across your entire site (serialized-safe), manage code snippets with text-only or full-PHP role-based access, and lock down file editor / theme / plugin / pixel permissions per WordPress role. Includes 1-click undo journal for every replacement.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Tested up to:      6.6
 * Author:            Koto
 * Author URI:        https://hellokoto.com
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wpsimplecode
 * Domain Path:       /languages
 *
 * @package WPSimpleCode
 */

if (!defined('ABSPATH')) exit;

define('WPSC_VERSION', '1.0.0');
define('WPSC_PLUGIN_FILE', __FILE__);
define('WPSC_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPSC_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WPSC_REST_NS', 'wpsimplecode/v1');

// Options used across modules.
define('WPSC_OPT_API_KEY',          'wpsc_api_key');
define('WPSC_OPT_REMOTE_ALLOWED',   'wpsc_remote_allowed');
define('WPSC_OPT_REMOTE_HOST',      'wpsc_remote_host');
define('WPSC_OPT_ACCESS_POLICY',    'wpsc_access_policy');
define('WPSC_OPT_DISABLE_FILE_EDIT','wpsc_disable_file_edit_global');
define('WPSC_OPT_SNIPPETS',         'wpsc_snippets');

require_once WPSC_PLUGIN_DIR . 'includes/auth.php';
require_once WPSC_PLUGIN_DIR . 'includes/search-replace.php';
require_once WPSC_PLUGIN_DIR . 'includes/access.php';
require_once WPSC_PLUGIN_DIR . 'includes/snippets.php';
require_once WPSC_PLUGIN_DIR . 'includes/admin.php';

// Activation — generate a remote API key + sane defaults
register_activation_hook(__FILE__, function () {
    if (!get_option(WPSC_OPT_API_KEY)) {
        update_option(WPSC_OPT_API_KEY, wp_generate_password(40, false, false));
    }
    if (get_option(WPSC_OPT_REMOTE_ALLOWED, null) === null) {
        update_option(WPSC_OPT_REMOTE_ALLOWED, false); // off by default; user opts in
    }
});

// Deactivation — keep options (uninstall.php removes them on full uninstall)

// REST namespace registration — every module hooks rest_api_init separately
// via its own register_rest_route() calls under WPSC_REST_NS.

// Public meta endpoint (no auth) so external tools can detect the plugin presence + version
add_action('rest_api_init', function () {
    register_rest_route(WPSC_REST_NS, '/meta', [
        'methods'  => 'GET',
        'callback' => function () {
            return rest_ensure_response([
                'name'      => 'WPSimpleCode',
                'version'   => WPSC_VERSION,
                'wp_version'=> get_bloginfo('version'),
                'php'       => phpversion(),
                'modules'   => ['search-replace', 'access', 'snippets'],
                'remote_allowed' => (bool) get_option(WPSC_OPT_REMOTE_ALLOWED, false),
            ]);
        },
        'permission_callback' => '__return_true',
    ]);

    // Remote disconnect — turns off remote control. Called by Koto when an
    // agency clicks "Disconnect". Site admin can re-enable on the Settings page.
    register_rest_route(WPSC_REST_NS, '/disable-remote', [
        'methods'  => 'POST',
        'callback' => function () {
            update_option(WPSC_OPT_REMOTE_ALLOWED, false);
            return rest_ensure_response(['ok' => true, 'remote_allowed' => false]);
        },
        'permission_callback' => 'wpsc_perm_write',
    ]);
});

// Load text domain for translations
add_action('init', function () {
    load_plugin_textdomain('wpsimplecode', false, dirname(plugin_basename(__FILE__)) . '/languages');
});
