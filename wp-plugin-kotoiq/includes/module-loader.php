<?php
/**
 * Module Loader — every feature in KotoIQ is a module under this contract.
 *
 * Each module file calls at the top:
 *
 *   koto_register_module([
 *     'slug'        => 'search-replace',
 *     'name'        => 'Search & Replace',
 *     'description' => 'Site-wide text/URL replacement with undo journal.',
 *     'version'     => '1.1.0',
 *   ]);
 *
 * Then guards its REST and hook registrations with:
 *
 *   add_action('rest_api_init', function () {
 *     if (!koto_is_module_enabled('search-replace')) return;
 *     register_rest_route(...);
 *   });
 *
 * Storage: wp_options['koto_modules_enabled'] = ['slug' => bool, ...]. Default
 * state when a slug is missing from the option is ENABLED (true). Setting an
 * entry to false disables that module without uninstalling anything.
 *
 * The koto_* function names are intentionally shared across the (now retired)
 * WPSimpleCode plugin and KotoIQ — sites that have both installed during a
 * transition window won't double-register and the registry is process-local.
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

if (!defined('KOTO_MODULES_OPTION')) {
    define('KOTO_MODULES_OPTION', 'koto_modules_enabled');
}

if (!isset($GLOBALS['koto_module_registry'])) {
    $GLOBALS['koto_module_registry'] = [];
}

if (!function_exists('koto_register_module')) {
    function koto_register_module($spec) {
        if (empty($spec['slug'])) return false;
        $slug = sanitize_key($spec['slug']);
        $GLOBALS['koto_module_registry'][$slug] = array_merge([
            'slug'        => $slug,
            'name'        => $slug,
            'description' => '',
            'version'     => '1.0.0',
            'depends_on'  => [],
            'always_on'   => false,
        ], $spec);
        $GLOBALS['koto_module_registry'][$slug]['slug'] = $slug;
        return true;
    }
}

if (!function_exists('koto_module_get')) {
    function koto_module_get($slug) {
        return isset($GLOBALS['koto_module_registry'][$slug]) ? $GLOBALS['koto_module_registry'][$slug] : null;
    }
}

if (!function_exists('koto_is_module_enabled')) {
    function koto_is_module_enabled($slug) {
        $mod = koto_module_get($slug);
        if (!$mod) return false;
        if (!empty($mod['always_on'])) return true;
        $stored = get_option(KOTO_MODULES_OPTION, []);
        if (!is_array($stored)) $stored = [];
        if (!array_key_exists($slug, $stored)) return true;
        return !!$stored[$slug];
    }
}

if (!function_exists('koto_modules_list')) {
    function koto_modules_list() {
        $out = [];
        foreach ($GLOBALS['koto_module_registry'] as $slug => $mod) {
            $out[] = [
                'slug'        => $mod['slug'],
                'name'        => $mod['name'],
                'description' => $mod['description'],
                'version'     => $mod['version'],
                'enabled'     => koto_is_module_enabled($slug),
                'always_on'   => !empty($mod['always_on']),
            ];
        }
        return $out;
    }
}

if (!function_exists('koto_set_module_enabled')) {
    function koto_set_module_enabled($slug, $enabled) {
        $mod = koto_module_get($slug);
        if (!$mod) return new WP_Error('unknown_module', "Module {$slug} not registered", ['status' => 404]);
        if (!empty($mod['always_on']) && !$enabled) {
            return new WP_Error('always_on', "Module {$slug} cannot be disabled", ['status' => 400]);
        }
        $stored = get_option(KOTO_MODULES_OPTION, []);
        if (!is_array($stored)) $stored = [];
        $stored[$slug] = !!$enabled;
        update_option(KOTO_MODULES_OPTION, $stored);
        return true;
    }
}

/**
 * Register a route under both kotoiq/v1 and wpsimplecode/v1.
 * Used by every module so the Control Center proxy (which currently
 * hardcodes /wp-json/wpsimplecode/v1/*) keeps working unchanged.
 */
if (!function_exists('kotoiq_register_rest_route')) {
    function kotoiq_register_rest_route($path, $args) {
        register_rest_route(KOTOIQ_REST_NS,        $path, $args);
        register_rest_route(KOTOIQ_REST_NS_LEGACY, $path, $args);
    }
}

add_action('rest_api_init', function () {
    kotoiq_register_rest_route('/modules/list', [
        'methods'  => 'POST',
        'callback' => function () {
            return rest_ensure_response(['modules' => koto_modules_list()]);
        },
        'permission_callback' => 'kotoiq_perm_read',
    ]);
    kotoiq_register_rest_route('/modules/toggle', [
        'methods'  => 'POST',
        'callback' => function ($req) {
            $p = $req->get_json_params();
            $slug = isset($p['slug']) ? sanitize_key($p['slug']) : '';
            $enabled = !empty($p['enabled']);
            if (!$slug) return new WP_Error('bad_slug', 'slug required', ['status' => 400]);
            $r = koto_set_module_enabled($slug, $enabled);
            if (is_wp_error($r)) return $r;
            return rest_ensure_response(['ok' => true, 'slug' => $slug, 'enabled' => $enabled]);
        },
        'permission_callback' => 'kotoiq_perm_write',
    ]);
});
