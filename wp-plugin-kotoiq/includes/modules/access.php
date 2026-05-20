<?php
/**
 * Access Management — REST routes + runtime cap filter.
 *
 * Routes (registered under both kotoiq/v1 and wpsimplecode/v1):
 *   POST access/roles    — current roles + their caps + the active policy
 *   POST access/apply    — accept a policy, map features → caps, write to roles
 *   POST access/snapshot — capture current roles+caps for rollback
 *   POST access/revert   — restore from a given snapshot payload
 *
 * Feature → capability map:
 *   php_snippets        full    →  + execute_php_snippets, + manage_snippets
 *                       text    →  − execute_php_snippets, + create_text_snippets, + manage_snippets
 *                       none    →  − all snippet caps
 *   snippet_management  granted →  + manage_snippets
 *                       denied  →  − manage_snippets
 *   file_editor         granted →  + edit_files
 *                       denied  →  − edit_files
 *   theme_editor        granted →  + edit_themes
 *                       denied  →  − edit_themes (runtime filter)
 *   plugin_editor       granted →  + edit_plugins
 *                       denied  →  − edit_plugins (runtime filter)
 *   pixels              granted →  + manage_pixels
 *                       denied  →  − manage_pixels
 *   access_management   granted →  + manage_access
 *                       denied  →  − manage_access
 *
 * @package KotoIQ
 */

if (!defined('ABSPATH')) exit;

koto_register_module([
    'slug'        => 'access',
    'name'        => 'Access Management',
    'description' => 'Per-role capability matrix — PHP snippets, file editor, theme/plugin editor, pixels, snapshot + revert.',
    'version'     => '1.1.0',
]);

add_action('rest_api_init', function () {
    if (!koto_is_module_enabled('access')) return;
    kotoiq_register_rest_route('/access/roles', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_am_roles',
        'permission_callback' => 'kotoiq_perm_read',
    ]);
    kotoiq_register_rest_route('/access/apply', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_am_apply',
        'permission_callback' => 'kotoiq_perm_write',
    ]);
    kotoiq_register_rest_route('/access/snapshot', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_am_snapshot',
        'permission_callback' => 'kotoiq_perm_write',
    ]);
    kotoiq_register_rest_route('/access/revert', [
        'methods'  => 'POST',
        'callback' => 'kotoiq_am_revert',
        'permission_callback' => 'kotoiq_perm_write',
    ]);
});

function kotoiq_am_roles($req) {
    $roles = wp_roles()->roles;
    $out = [];
    foreach ($roles as $slug => $r) {
        $out[$slug] = [
            'name' => $r['name'] ?? $slug,
            'caps' => array_filter($r['capabilities'] ?? [], function ($v) { return (bool) $v; }),
        ];
    }
    $policy = get_option(KOTOIQ_OPT_ACCESS_POLICY, []);
    if (!is_array($policy)) $policy = [];
    return rest_ensure_response([
        'roles' => $out,
        'policy' => $policy,
        'global_disable_file_edit' => (bool) get_option(KOTOIQ_OPT_DISABLE_FILE_EDIT, false),
    ]);
}

function kotoiq_am_apply($req) {
    $p = $req->get_json_params();
    $policy = (isset($p['policy']) && is_array($p['policy'])) ? $p['policy'] : [];
    $global_disable = !empty($p['global_disable_file_edit']);

    $clean = [];
    foreach ($policy as $role_slug => $features) {
        if (!is_string($role_slug) || !is_array($features)) continue;
        $clean[sanitize_key($role_slug)] = kotoiq_am_sanitize_features($features);
    }
    update_option(KOTOIQ_OPT_ACCESS_POLICY, $clean);
    update_option(KOTOIQ_OPT_DISABLE_FILE_EDIT, $global_disable);

    $applied = [];
    foreach ($clean as $role_slug => $features) {
        $role = get_role($role_slug);
        if (!$role) continue;
        $caps_to_set = kotoiq_am_features_to_caps($features);
        foreach ($caps_to_set as $cap => $grant) {
            if ($grant) $role->add_cap($cap); else $role->remove_cap($cap);
        }
        $applied[$role_slug] = $caps_to_set;
    }
    return rest_ensure_response([
        'ok' => true,
        'applied' => $applied,
        'applied_at' => current_time('mysql', true),
    ]);
}

function kotoiq_am_snapshot($req) {
    $roles = wp_roles()->roles;
    $snap = [];
    foreach ($roles as $slug => $r) {
        $snap[$slug] = ['caps' => $r['capabilities'] ?? []];
    }
    return rest_ensure_response([
        'snapshot' => $snap,
        'captured_at' => current_time('mysql', true),
    ]);
}

function kotoiq_am_revert($req) {
    $p = $req->get_json_params();
    $snap = (isset($p['snapshot']) && is_array($p['snapshot'])) ? $p['snapshot'] : [];
    if (!$snap) return new WP_Error('bad_snapshot', 'snapshot required', ['status' => 400]);
    foreach ($snap as $role_slug => $entry) {
        $role = get_role($role_slug);
        if (!$role) continue;
        $target_caps = isset($entry['caps']) && is_array($entry['caps']) ? $entry['caps'] : [];
        foreach (array_keys($role->capabilities) as $cap) $role->remove_cap($cap);
        foreach ($target_caps as $cap => $v) if ($v) $role->add_cap($cap);
    }
    delete_option(KOTOIQ_OPT_ACCESS_POLICY);
    return rest_ensure_response(['ok' => true]);
}

function kotoiq_am_sanitize_features($f) {
    $allowed_keys = ['php_snippets','snippet_management','file_editor','theme_editor','plugin_editor','pixels','access_management'];
    $allowed_snippet_levels = ['full','text','none'];
    $allowed_grant_levels   = ['granted','denied'];
    $out = [];
    foreach ($f as $k => $v) {
        if (!in_array($k, $allowed_keys, true)) continue;
        if ($k === 'php_snippets') {
            if (in_array($v, $allowed_snippet_levels, true)) $out[$k] = $v;
        } else {
            if (in_array($v, $allowed_grant_levels, true)) $out[$k] = $v;
        }
    }
    return $out;
}

function kotoiq_am_features_to_caps($features) {
    $caps = [];
    $snip = $features['php_snippets'] ?? null;
    if ($snip === 'full') {
        $caps['execute_php_snippets'] = true;
        $caps['create_text_snippets'] = true;
        $caps['manage_snippets']      = true;
    } elseif ($snip === 'text') {
        $caps['execute_php_snippets'] = false;
        $caps['create_text_snippets'] = true;
        $caps['manage_snippets']      = true;
    } elseif ($snip === 'none') {
        $caps['execute_php_snippets'] = false;
        $caps['create_text_snippets'] = false;
        $caps['manage_snippets']      = false;
    }
    if (isset($features['snippet_management'])) $caps['manage_snippets']  = $features['snippet_management'] === 'granted';
    if (isset($features['file_editor']))        $caps['edit_files']       = $features['file_editor']        === 'granted';
    if (isset($features['theme_editor']))       $caps['edit_themes']      = $features['theme_editor']       === 'granted';
    if (isset($features['plugin_editor']))      $caps['edit_plugins']     = $features['plugin_editor']      === 'granted';
    if (isset($features['pixels']))             $caps['manage_pixels']    = $features['pixels']             === 'granted';
    if (isset($features['access_management']))  $caps['manage_access']    = $features['access_management']  === 'granted';
    return $caps;
}

/**
 * Runtime cap filter — enforces denials even for caps WP would grant by default
 * (e.g. an administrator role denied edit_themes).
 */
add_filter('user_has_cap', 'kotoiq_am_user_has_cap_filter', 10, 4);
function kotoiq_am_user_has_cap_filter($allcaps, $caps, $args, $user) {
    if (!koto_is_module_enabled('access')) return $allcaps;
    static $policy_cache = null;
    static $global_disable = null;
    if ($policy_cache === null) {
        $policy_cache = get_option(KOTOIQ_OPT_ACCESS_POLICY, []);
        if (!is_array($policy_cache)) $policy_cache = [];
    }
    if ($global_disable === null) {
        $global_disable = (bool) get_option(KOTOIQ_OPT_DISABLE_FILE_EDIT, false);
    }
    if ($global_disable) {
        $allcaps['edit_themes']  = false;
        $allcaps['edit_plugins'] = false;
        $allcaps['edit_files']   = false;
    }
    if (!$user || empty($user->roles)) return $allcaps;
    foreach ($user->roles as $role_slug) {
        $features = $policy_cache[$role_slug] ?? null;
        if (!is_array($features)) continue;
        foreach (kotoiq_am_denied_caps($features) as $cap) {
            if (!empty($allcaps[$cap])) $allcaps[$cap] = false;
        }
    }
    return $allcaps;
}

function kotoiq_am_denied_caps($features) {
    $d = [];
    if (($features['php_snippets'] ?? null) === 'none') {
        $d[] = 'execute_php_snippets'; $d[] = 'manage_snippets';
    } elseif (($features['php_snippets'] ?? null) === 'text') {
        $d[] = 'execute_php_snippets';
    }
    if (($features['snippet_management'] ?? null) === 'denied') $d[] = 'manage_snippets';
    if (($features['file_editor']        ?? null) === 'denied') $d[] = 'edit_files';
    if (($features['theme_editor']       ?? null) === 'denied') $d[] = 'edit_themes';
    if (($features['plugin_editor']      ?? null) === 'denied') $d[] = 'edit_plugins';
    if (($features['pixels']             ?? null) === 'denied') $d[] = 'manage_pixels';
    if (($features['access_management']  ?? null) === 'denied') $d[] = 'manage_access';
    return $d;
}

// Defensive UI lockdown — hide the file-editor admin menus if the user lacks the caps.
add_action('admin_menu', function () {
    if (!current_user_can('edit_themes'))  remove_submenu_page('themes.php',  'theme-editor.php');
    if (!current_user_can('edit_plugins')) remove_submenu_page('plugins.php', 'plugin-editor.php');
}, 999);

// Back-compat — admin.php form handler still calls these names.
if (!function_exists('wpsc_am_sanitize_features')) {
    function wpsc_am_sanitize_features($f)         { return kotoiq_am_sanitize_features($f); }
    function wpsc_am_features_to_caps($features)   { return kotoiq_am_features_to_caps($features); }
}
